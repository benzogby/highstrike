#!/usr/bin/env node
/**
 * Run SQL on Highstrike's Supabase database from this Mac, through Supabase's Management API.
 *
 *   npm run supabase:token                       save a Supabase access token (a small macOS dialog)
 *   npm run sql -- "select now()"                run SQL, print the rows as JSON
 *   npm run sql -- supabase/migrations/x.sql     run a file
 *   npm run sql -- --read-only "<sql>"           the database refuses anything that writes
 *
 * The token is a personal access token (supabase.com/dashboard/account/tokens), kept in the login Keychain
 * (service Highstrike, account SUPABASE_ACCESS_TOKEN; scripts/lib/mac.mjs), never in the repo or .env.local.
 * SUPABASE_ACCESS_TOKEN in the environment wins over the Keychain. The project is the one NEXT_PUBLIC_SUPABASE_URL in
 * .env.local points at (or SUPABASE_PROJECT_REF). Nothing here prints the token.
 */
import { existsSync, readFileSync } from "node:fs";
import { askSecret, envFile, fail, keychainSet, notify, savedKey } from "./lib/mac.mjs";

const API = "https://api.supabase.com/v1";
const ACCOUNT = "SUPABASE_ACCESS_TOKEN";
/** A personal access token: sbp_ and letters, digits or underscores (anything else is a paste slip). */
const TOKEN_RE = /^sbp_[A-Za-z0-9_]{20,}$/;

function projectRef() {
  const env = { ...envFile(), ...process.env };
  if (env.SUPABASE_PROJECT_REF) return env.SUPABASE_PROJECT_REF;
  if (!env.NEXT_PUBLIC_SUPABASE_URL) fail("NEXT_PUBLIC_SUPABASE_URL isn't set in .env.local, so there's no project to run SQL on.");
  return new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
}

async function api(token, path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  const text = await res.text();
  let body = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* not JSON: keep the text */
  }
  return { ok: res.ok, status: res.status, body };
}

async function saveToken() {
  const ref = projectRef();
  let message = [
    "Supabase access token",
    "",
    "This lets Claude run SQL on the Highstrike database.",
    "",
    "1. In your browser, open supabase.com/dashboard/account/tokens",
    "2. Click Generate new token, name it Claude Code, and generate it.",
    "3. Copy the token (it starts with sbp_ and is shown only once) and paste it here.",
  ].join("\n");
  for (let attempt = 0; attempt < 3; attempt++) {
    const pasted = askSecret(message);
    if (pasted === null) fail("No token saved: the window was closed.");
    const token = pasted.replace(/\s+/g, "");
    let problem;
    if (!TOKEN_RE.test(token)) {
      problem = /^(sb_|eyJ)/.test(token)
        ? "that's one of the project's API keys. This needs a personal access token from your account's Access Tokens page; it starts with sbp_."
        : "a Supabase access token starts with sbp_.";
    } else {
      const r = await api(token, `/projects/${ref}`);
      if (r.ok) {
        keychainSet(ACCOUNT, token, "Supabase access token");
        notify("Saved. Claude can run SQL on Highstrike now.");
        console.log(`Saved the Supabase access token in the Keychain. It can see project "${r.body.name}" (${ref}), status ${r.body.status}.`);
        return;
      }
      problem =
        r.status === 401
          ? "Supabase didn't accept that token."
          : `that token can't see the Highstrike project (${ref}). Make it while signed in to the Supabase account that owns Highstrike.`;
    }
    message = `That didn't work: ${problem}\n\nPaste the Supabase access token again.`;
  }
  fail("No token saved after three tries.");
}

async function sql(args) {
  const readOnly = args.includes("--read-only");
  const rest = args.filter((a) => a !== "--read-only");
  if (!rest.length) fail('Give it SQL or a .sql file: npm run sql -- "select now()"');
  let query = rest.join(" ");
  if (rest.length === 1 && rest[0].endsWith(".sql")) {
    if (!existsSync(rest[0])) fail(`There's no file at ${rest[0]}.`);
    query = readFileSync(rest[0], "utf8");
  }
  const token = savedKey(ACCOUNT);
  if (!token) fail("No Supabase access token is saved. Run npm run supabase:token first.");
  const r = await api(token, `/projects/${projectRef()}/database/query`, {
    method: "POST",
    body: JSON.stringify(readOnly ? { query, read_only: true } : { query }),
  });
  if (!r.ok) fail(`Supabase refused it (${r.status}): ${typeof r.body === "string" ? r.body : (r.body.message ?? JSON.stringify(r.body))}`);
  console.log(JSON.stringify(r.body, null, 2));
}

const [command, ...args] = process.argv.slice(2);
if (command === "sql") await sql(args);
else if (command === "token") await saveToken();
else fail('Use: node scripts/supabase.mjs sql "<sql>"  or  node scripts/supabase.mjs token');
