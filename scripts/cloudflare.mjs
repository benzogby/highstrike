#!/usr/bin/env node
/**
 * highstrike.com's DNS on Cloudflare, through Cloudflare's API.
 *
 *   npm run cloudflare:token                                save a Cloudflare API token (a small macOS dialog)
 *   npm run dns                                             list the zone's records
 *   npm run dns -- set A @ 76.76.21.21                      add or replace a record (DNS only, automatic TTL)
 *   npm run dns -- set CNAME www cname.vercel-dns.com --proxied
 *   npm run dns -- delete CNAME www
 *
 * A name is "@" for the zone itself, a bare label ("www") or a full name. The token is an API token made from the
 * "Edit zone DNS" template for highstrike.com (dash.cloudflare.com/profile/api-tokens), kept in the login Keychain
 * (service Highstrike, account CLOUDFLARE_API_TOKEN; scripts/lib/mac.mjs). CLOUDFLARE_API_TOKEN in the environment
 * wins over the Keychain. The zone is CLOUDFLARE_ZONE, or highstrike.com. Nothing here prints the token.
 */
import { askSecret, fail, keychainSet, notify, savedKey } from "./lib/mac.mjs";

const API = "https://api.cloudflare.com/client/v4";
const ACCOUNT = "CLOUDFLARE_API_TOKEN";
const ZONE = process.env.CLOUDFLARE_ZONE || "highstrike.com";

async function cf(token, path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok && body.success !== false, status: res.status, body };
}

function errors(body) {
  return (body.errors ?? []).map((e) => `${e.code}: ${e.message}`).join("; ") || "no details";
}

/** The zone the token sees by ZONE's name, or null. */
async function findZone(token) {
  const r = await cf(token, `/zones?name=${encodeURIComponent(ZONE)}`);
  return r.ok ? (r.body.result?.[0] ?? null) : null;
}

function fullName(name) {
  if (name === "@" || name === ZONE) return ZONE;
  return name.endsWith(`.${ZONE}`) ? name : `${name}.${ZONE}`;
}

async function saveToken() {
  let message = [
    "Cloudflare API token",
    "",
    "This lets Claude fix highstrike.com's DNS records on Cloudflare.",
    "",
    "1. In your browser, open dash.cloudflare.com/profile/api-tokens",
    "2. Click Create Token, then Use template next to Edit zone DNS.",
    "3. Under Zone Resources, pick highstrike.com. Click Continue to summary, then Create Token.",
    "4. Copy the token and paste it here.",
  ].join("\n");
  for (let attempt = 0; attempt < 3; attempt++) {
    const pasted = askSecret(message);
    if (pasted === null) fail("No token saved: the window was closed.");
    const token = pasted.replace(/\s+/g, "");
    let problem;
    if (!/^[A-Za-z0-9_-]{30,}$/.test(token)) {
      problem = "that doesn't look like an API token (one long run of letters and digits).";
    } else {
      const r = await cf(token, `/zones?name=${encodeURIComponent(ZONE)}`);
      const zone = r.ok ? r.body.result?.[0] : null;
      if (zone) {
        keychainSet(ACCOUNT, token, "Cloudflare API token");
        notify("Saved. Claude can fix highstrike.com's DNS now.");
        console.log(`Saved the Cloudflare API token in the Keychain. It can see ${zone.name} (zone status ${zone.status}${zone.paused ? ", paused" : ""}).`);
        return;
      }
      if (!r.ok) {
        problem = /^[0-9a-f]{37}$/.test(token)
          ? "that's the Global API Key. Make an API token from the Edit zone DNS template instead."
          : "Cloudflare didn't accept that token.";
      } else {
        problem = `that token can't see ${ZONE}. Under Zone Resources, pick highstrike.com.`;
      }
    }
    message = `That didn't work: ${problem}\n\nPaste the Cloudflare API token again.`;
  }
  fail("No token saved after three tries.");
}

async function zoneAndToken() {
  const token = savedKey(ACCOUNT);
  if (!token) fail("No Cloudflare API token is saved. Run npm run cloudflare:token first.");
  const zone = await findZone(token);
  if (!zone) fail(`The saved token can't see ${ZONE} on Cloudflare.`);
  return { token, zone };
}

async function records(token, zone) {
  const r = await cf(token, `/zones/${zone.id}/dns_records?per_page=500`);
  if (!r.ok) fail(`Cloudflare wouldn't list the records (${r.status}): ${errors(r.body)}`);
  return r.body.result;
}

function show(rec) {
  return `${rec.type.padEnd(6)} ${rec.name.padEnd(30)} ${rec.content}  ${rec.proxied ? "proxied" : "DNS only"}, ttl ${rec.ttl === 1 ? "auto" : rec.ttl}`;
}

async function dns(args) {
  const [action = "list", ...rest] = args;
  const proxied = rest.includes("--proxied");
  const [type, name, content] = rest.filter((a) => a !== "--proxied");
  const { token, zone } = await zoneAndToken();
  if (action === "list") {
    console.log(`${zone.name}: zone ${zone.status}${zone.paused ? ", paused" : ""}, nameservers ${zone.name_servers?.join(", ")}`);
    const all = await records(token, zone);
    console.log(all.length ? all.map(show).join("\n") : "(no records)");
    return;
  }
  if (!type || !name || (action === "set" && !content)) fail("Use: npm run dns -- set <type> <name> <content> [--proxied]  or  npm run dns -- delete <type> <name>");
  const fqdn = fullName(name);
  const matches = (await records(token, zone)).filter((r) => r.type === type.toUpperCase() && r.name === fqdn);
  if (action === "delete") {
    if (!matches.length) fail(`There's no ${type.toUpperCase()} record for ${fqdn}.`);
    for (const rec of matches) {
      const r = await cf(token, `/zones/${zone.id}/dns_records/${rec.id}`, { method: "DELETE" });
      if (!r.ok) fail(`Cloudflare wouldn't delete ${show(rec)} (${r.status}): ${errors(r.body)}`);
      console.log(`Deleted ${show(rec)}`);
    }
    return;
  }
  if (action !== "set") fail(`Unknown action "${action}": use list, set or delete.`);
  const record = { type: type.toUpperCase(), name: fqdn, content, proxied, ttl: 1 };
  const r = matches.length
    ? await cf(token, `/zones/${zone.id}/dns_records/${matches[0].id}`, { method: "PUT", body: JSON.stringify(record) })
    : await cf(token, `/zones/${zone.id}/dns_records`, { method: "POST", body: JSON.stringify(record) });
  if (!r.ok) fail(`Cloudflare refused ${record.type} ${fqdn} (${r.status}): ${errors(r.body)}`);
  console.log(`${matches.length ? "Updated" : "Added"} ${show(r.body.result)}`);
}

const [command, ...args] = process.argv.slice(2);
if (command === "token") await saveToken();
else if (command === "dns") await dns(args);
else fail('Use: node scripts/cloudflare.mjs token  or  node scripts/cloudflare.mjs dns [list | set <type> <name> <content> | delete <type> <name>]');
