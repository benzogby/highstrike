#!/usr/bin/env node
/**
 * Run SQL on Highstrike's Supabase database from this Mac, through Supabase's Management API.
 *
 *   npm run supabase:token                       save a Supabase access token (a small macOS dialog)
 *   npm run sql -- "select now()"                run SQL, print the rows as JSON
 *   npm run sql -- supabase/migrations/x.sql     run a file
 *   npm run sql -- --read-only "<sql>"           the database refuses anything that writes
 *
 * The token is a personal access token (supabase.com/dashboard/account/tokens). It lives in the login Keychain
 * (service "Highstrike", account SUPABASE_ACCESS_TOKEN), never in the repo or .env.local. Only /usr/bin/security
 * saves and reads it, so a read never shows a Keychain prompt, and the value reaches `security` on stdin, never in a
 * process's arguments. SUPABASE_ACCESS_TOKEN in the environment wins over the Keychain. The project is the one
 * NEXT_PUBLIC_SUPABASE_URL in .env.local points at (or SUPABASE_PROJECT_REF). Nothing here prints the token.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const API = "https://api.supabase.com/v1";
const SERVICE = "Highstrike";
const ACCOUNT = "SUPABASE_ACCESS_TOKEN";
const TITLE = "Highstrike setup";
/** A personal access token: sbp_ and letters, digits or underscores (anything else is a paste slip). */
const TOKEN_RE = /^sbp_[A-Za-z0-9_]{20,}$/;

function fail(message) {
  console.error(message);
  process.exit(1);
}

/** .env.local's values (an empty object when there's none). */
function envFile() {
  const file = `${ROOT}.env.local`;
  if (!existsSync(file)) return {};
  const out = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
  return out;
}

function projectRef() {
  const env = { ...envFile(), ...process.env };
  if (env.SUPABASE_PROJECT_REF) return env.SUPABASE_PROJECT_REF;
  if (!env.NEXT_PUBLIC_SUPABASE_URL) fail("NEXT_PUBLIC_SUPABASE_URL isn't set in .env.local, so there's no project to run SQL on.");
  return new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
}

function keychainGet() {
  const r = spawnSync("/usr/bin/security", ["find-generic-password", "-s", SERVICE, "-a", ACCOUNT, "-w"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    timeout: 20_000,
  });
  return r.status === 0 ? r.stdout.trim() : "";
}

function keychainSet(token) {
  // -U replaces a saved token in place. TOKEN_RE already ruled out quotes and spaces.
  spawnSync("/usr/bin/security", ["-i"], {
    input: `add-generic-password -U -s ${SERVICE} -a ${ACCOUNT} -l "${SERVICE} Supabase access token" -w "${token}"\n`,
    stdio: ["pipe", "ignore", "ignore"],
    timeout: 20_000,
  });
  if (keychainGet() !== token) fail("The token didn't save in the Keychain. Try again.");
}

function savedToken() {
  return process.env.SUPABASE_ACCESS_TOKEN?.trim() || keychainGet();
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

/** The pasted text, or null when the dialog was cancelled, closed or left for 15 minutes. */
function dialog(message) {
  // The message goes in as an argument, so nothing in it is read as AppleScript.
  const script = [
    "on run argv",
    "activate",
    `set r to display dialog (item 1 of argv) default answer "" with hidden answer with title "${TITLE}" buttons {"Cancel", "Save"} default button "Save" giving up after 900`,
    'if gave up of r then return "__GAVE_UP__"',
    'return "V:" & (text returned of r)',
    "end run",
  ];
  const r = spawnSync("osascript", [...script.flatMap((l) => ["-e", l]), message], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const out = r.status === 0 ? r.stdout.replace(/\r?\n$/, "") : "";
  return out.startsWith("V:") ? out.slice(2) : null;
}

function notify(text) {
  spawnSync("osascript", ["-e", "on run argv", "-e", `display notification (item 1 of argv) with title "${TITLE}"`, "-e", "end run", text], {
    stdio: "ignore",
    timeout: 10_000,
  });
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
    const pasted = dialog(message);
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
        keychainSet(token);
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
  const token = savedToken();
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
