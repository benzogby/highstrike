#!/usr/bin/env node
/**
 * highstrike.com as a sending domain on Resend (resend.com), through Resend's API.
 *
 *   node scripts/resend.mjs token     save a Resend API key (a small macOS dialog)
 *   node scripts/resend.mjs domain [name]   add highstrike.com (or a subdomain of it, such as mail.highstrike.com) to
 *                                           Resend, put its DNS records on Cloudflare (scripts/cloudflare.mjs), and
 *                                           have Resend verify it
 *   node scripts/resend.mjs status [name]   where that domain stands on Resend
 *
 * Why (2026-11-02): the server's Resend account (newhighstrike@gmail.com) had no verified domain, so Resend delivered
 * only to that address, and the sale alert to ben.zogby@gmail.com came back 403. With highstrike.com verified, the site
 * sends from it to anyone. The key is a Resend API key with full access (resend.com/api-keys, in that account), kept in
 * the login Keychain (service Highstrike, account RESEND_API_KEY; scripts/lib/mac.mjs). RESEND_API_KEY in the environment
 * wins over the Keychain. Nothing here prints the key.
 */
import { spawnSync } from "node:child_process";
import { askSecret, fail, keychainSet, notify, ROOT, savedKey } from "./lib/mac.mjs";

const API = "https://api.resend.com";
const ACCOUNT = "RESEND_API_KEY";
/** The Cloudflare zone every sending domain sits in. */
const ZONE = "highstrike.com";
const DOMAIN = (process.argv[3] || process.env.RESEND_DOMAIN || ZONE).toLowerCase();
if (DOMAIN !== ZONE && !DOMAIN.endsWith(`.${ZONE}`)) fail(`${DOMAIN} isn't in the ${ZONE} zone this script can write.`);
/** The subdomain's own label ("mail" for mail.highstrike.com), or "" for the zone itself. */
const SUB = DOMAIN === ZONE ? "" : DOMAIN.slice(0, -(ZONE.length + 1));

/**
 * A record's full name. Resend names records relative to the zone ("resend._domainkey.mail") or, for some accounts,
 * to the domain itself ("resend._domainkey"); either way the full name lands under the right domain, so a
 * subdomain's records never replace the zone's own.
 */
function fullName(name) {
  if (!name || name === "@") return DOMAIN;
  if (name === ZONE || name.endsWith(`.${ZONE}`)) return name;
  if (SUB && name !== SUB && !name.endsWith(`.${SUB}`)) return `${name}.${DOMAIN}`;
  return `${name}.${ZONE}`;
}
/** A Resend key: re_ and letters, digits or underscores (anything else is a paste slip). */
const KEY_RE = /^re_[A-Za-z0-9_]{16,}$/;

async function resend(key, path, init = {}) {
  const res = await fetch(`${API}${path}`, { ...init, headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) fail(`Resend refused ${init.method ?? "GET"} ${path} (${res.status}): ${body.message ?? body.name ?? "no reason given"}`);
  return body;
}

function savedResendKey() {
  const key = savedKey(ACCOUNT);
  if (!key) fail("There's no Resend key yet. Run `node scripts/resend.mjs token` first.");
  return key;
}

async function saveToken() {
  const pasted = askSecret(
    "Paste a Resend API key for HighStrike (resend.com → API Keys → Create API key, with Full access, in the newhighstrike@gmail.com account). It's kept in your Mac's Keychain, never in a file."
  );
  if (pasted === null) fail("No key was saved: the dialog was cancelled, closed, or left for 15 minutes.");
  const key = pasted.trim();
  if (!KEY_RE.test(key)) fail("That doesn't look like a Resend API key (they start with re_). Nothing was saved.");
  // Only a key that works is kept.
  const res = await fetch(`${API}/domains`, { headers: { Authorization: `Bearer ${key}` } });
  if (!res.ok) fail(`Resend turned that key down (${res.status}); it needs Full access. Nothing was saved.`);
  keychainSet(ACCOUNT, key, "Resend API key");
  notify("Resend key saved.");
  console.log("Saved the Resend key in the Keychain (service Highstrike, account RESEND_API_KEY).");
}

/** highstrike.com on Resend, added if it isn't there yet, with its DNS records. */
async function ourDomain(key, { add }) {
  const { data } = await resend(key, "/domains");
  let id = data?.find((d) => d.name === DOMAIN)?.id;
  if (!id) {
    if (!add) fail(`${DOMAIN} isn't on Resend yet. Run \`node scripts/resend.mjs domain\`.`);
    id = (await resend(key, "/domains", { method: "POST", body: JSON.stringify({ name: DOMAIN, region: "us-east-1" }) })).id;
    console.log(`Added ${DOMAIN} to Resend.`);
  }
  return resend(key, `/domains/${id}`);
}

/** One record on Cloudflare through scripts/cloudflare.mjs (its own Keychain token). */
function cloudflare(...args) {
  const r = spawnSync(process.execPath, ["scripts/cloudflare.mjs", "dns", ...args], { cwd: ROOT, encoding: "utf8" });
  if (r.status !== 0) fail(`Cloudflare didn't take ${args.slice(0, 3).join(" ")}: ${(r.stderr || r.stdout).trim()}`);
  return r.stdout.trim();
}

function printDomain(domain) {
  console.log(`${domain.name}: ${domain.status}`);
  for (const r of domain.records ?? []) console.log(`  ${r.record.padEnd(5)} ${r.type.padEnd(4)} ${r.name.padEnd(22)} ${r.status}`);
}

async function setupDomain() {
  const key = savedResendKey();
  let domain = await ourDomain(key, { add: true });
  // Resend's records sit on subdomains of their own (send., resend._domainkey.), so the site's Google mail records at
  // the zone's root are never touched.
  for (const r of domain.records ?? []) {
    const content = String(r.value).replace(/^"(.*)"$/, "$1");
    const name = fullName(r.name);
    if (r.type === "MX") cloudflare("set", "MX", name, content, "--priority", String(r.priority ?? 10));
    else cloudflare("set", r.type, name, content);
    console.log(`Cloudflare: ${r.type} ${name} set for Resend's ${r.record}.`);
  }
  await resend(key, `/domains/${domain.id}/verify`, { method: "POST" });
  // Cloudflare answers with new records within seconds; Resend checks them on its own schedule. Wait up to ~3 minutes.
  for (let i = 0; i < 18 && domain.status !== "verified"; i++) {
    await new Promise((r) => setTimeout(r, 10_000));
    domain = await resend(key, `/domains/${domain.id}`);
  }
  printDomain(domain);
  if (domain.status === "verified") notify(`${DOMAIN} is verified on Resend.`);
  else console.log("Not verified yet: Resend keeps checking. Run `node scripts/resend.mjs status` in a few minutes.");
}

async function status() {
  printDomain(await ourDomain(savedResendKey(), { add: false }));
}

const [cmd] = process.argv.slice(2);
if (cmd === "token") await saveToken();
else if (cmd === "domain") await setupDomain();
else if (cmd === "status") await status();
else fail("Use: node scripts/resend.mjs token | domain | status");
