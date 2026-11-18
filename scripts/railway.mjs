#!/usr/bin/env node
/**
 * Set up and update HighStrike's always-on worker (worker/) on Railway, through Railway's API.
 *
 *   npm run worker:deploy        asks for a Railway token once (Mac dialog → Keychain, account RAILWAY_TOKEN), then
 *                                makes sure the project "highstrike-worker" has a service "worker" built from this
 *                                repository's worker/ folder, sets its variables (the Alpaca keys from the Keychain,
 *                                the Supabase URL and service key from Supabase's Management API) and deploys it.
 *
 * Nothing here prints a key or token.
 */
import { askSecret, envFile, fail, keychainSet, notify, savedKey } from "./lib/mac.mjs";

const API = "https://backboard.railway.com/graphql/v2";
const REPO = "benzogby/highstrike";
const PROJECT = "highstrike-worker";

let token = savedKey("RAILWAY_TOKEN");
async function gql(query, variables = {}) {
  const res = await fetch(API, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ query, variables }) });
  const body = await res.json().catch(() => ({}));
  if (body.errors?.length) throw new Error(body.errors.map((e) => e.message).join("; "));
  if (!res.ok) throw new Error(`Railway ${res.status}`);
  return body.data;
}

// 1. The token
for (let attempt = 0; ; attempt++) {
  if (!token) {
    const pasted = askSecret(
      attempt === 0
        ? "Railway token\n\nPaste the token you just created at railway.com/account/tokens (it's shown once)."
        : "Railway didn't accept that token. Paste it again (or make a new one at railway.com/account/tokens)."
    );
    if (pasted == null) fail("Nothing saved: the window was closed.");
    token = pasted.replace(/\s+/g, "");
  }
  // An account token can say who it is; a workspace token can't (that's "Not Authorized") but can list projects.
  let ok = false;
  let why = "";
  for (const q of ["query { me { id } }", "query { projects { edges { node { id } } } }"]) {
    try {
      await gql(q);
      ok = true;
      break;
    } catch (e) {
      why = e.message;
    }
  }
  if (ok) {
    keychainSet("RAILWAY_TOKEN", token, "Railway API token");
    break;
  }
  if (attempt >= 1) fail(`Railway didn't accept the token (${why}).`);
  token = "";
}
console.log("railway: token works");
if (process.argv.includes("--check")) process.exit(0);

// 2. The secrets the worker needs
const env = { ...envFile(), ...process.env };
const ref = env.SUPABASE_PROJECT_REF || new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
const supaToken = savedKey("SUPABASE_ACCESS_TOKEN");
const keys = await (await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys?reveal=true`, { headers: { Authorization: `Bearer ${supaToken}` } })).json();
const serviceKey = (Array.isArray(keys) ? keys : []).find((k) => k.name === "service_role")?.api_key;
const alpacaId = savedKey("ALPACA_KEY_ID");
const alpacaSecret = savedKey("ALPACA_SECRET");
if (!serviceKey || !alpacaId || !alpacaSecret) fail("Missing a key for the worker (Supabase service key, or the Alpaca keys: npm run alpaca:key).");

// 3. Project, environment, service
const workspaceId = await gql("query { me { workspaces { id name } } }")
  .then((d) => d.me.workspaces?.[0]?.id ?? null)
  .catch(() => null);
const projects = await gql("query { projects { edges { node { id name environments { edges { node { id name } } } services { edges { node { id name } } } } } } }");
let project = projects.projects.edges.map((e) => e.node).find((p) => p.name === PROJECT);
if (!project) {
  const made = await gql(
    "mutation($input: ProjectCreateInput!) { projectCreate(input: $input) { id name environments { edges { node { id name } } } services { edges { node { id name } } } } }",
    { input: { name: PROJECT, description: "HighStrike: records Alpaca's real-time minute bars for the charts", ...(workspaceId ? { workspaceId } : {}) } }
  );
  project = made.projectCreate;
  console.log("railway: made the project");
}
const environment = project.environments.edges.map((e) => e.node).find((e) => e.name === "production") ?? project.environments.edges[0]?.node;
if (!environment) fail("The Railway project has no environment.");
let service = project.services.edges.map((e) => e.node).find((s) => s.name === "worker");
if (!service) {
  const made = await gql("mutation($input: ServiceCreateInput!) { serviceCreate(input: $input) { id name } }", {
    input: { projectId: project.id, name: "worker", source: { repo: REPO }, branch: "main" },
  });
  service = made.serviceCreate;
  console.log("railway: made the worker service from the repository");
}

// 4. Build from worker/, settings, deploy
await gql("mutation($serviceId: String!, $environmentId: String, $input: ServiceInstanceUpdateInput!) { serviceInstanceUpdate(serviceId: $serviceId, environmentId: $environmentId, input: $input) }", {
  serviceId: service.id,
  environmentId: environment.id,
  // Rebuilt only when worker/ changes (the app's own pushes don't restart it and drop Alpaca's one connection).
  input: { rootDirectory: "/worker", startCommand: "npm start", restartPolicyType: "ALWAYS", watchPatterns: ["/worker/**"] },
});
await gql("mutation($input: VariableCollectionUpsertInput!) { variableCollectionUpsert(input: $input) }", {
  input: {
    projectId: project.id,
    environmentId: environment.id,
    serviceId: service.id,
    variables: {
      ALPACA_KEY_ID: alpacaId,
      ALPACA_SECRET: alpacaSecret,
      SUPABASE_URL: `https://${ref}.supabase.co`,
      SUPABASE_SERVICE_ROLE_KEY: serviceKey,
      NIXPACKS_NODE_VERSION: "22",
    },
  },
});
console.log("railway: settings saved");
await gql("mutation($serviceId: String!, $environmentId: String!) { serviceInstanceDeployV2(serviceId: $serviceId, environmentId: $environmentId) }", {
  serviceId: service.id,
  environmentId: environment.id,
});
notify("HighStrike's worker is deploying on Railway.");
console.log(`railway: deploying (project ${project.id}, service ${service.id}, environment ${environment.id})`);
