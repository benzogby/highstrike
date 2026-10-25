/**
 * This Mac's small windows and its login Keychain, for the scripts that need a key from Ben.
 *
 * Keys live in the login Keychain as generic passwords under the service "Highstrike", one per key name
 * (SUPABASE_ACCESS_TOKEN, CLOUDFLARE_API_TOKEN). Only /usr/bin/security saves and reads them, so a read never shows a
 * Keychain prompt, and a value reaches `security` on stdin, never in a process's arguments. Nothing here prints one.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const SERVICE = "Highstrike";
const TITLE = "Highstrike setup";
/** Characters keys use: anything else is a paste slip, and would break the quoting in keychainSet. */
const VALUE_RE = /^[A-Za-z0-9_\-.]+$/;

export function fail(message) {
  console.error(message);
  process.exit(1);
}

/** .env.local's values (an empty object when there's none). */
export function envFile() {
  const file = `${ROOT}.env.local`;
  if (!existsSync(file)) return {};
  const out = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
  return out;
}

export function keychainGet(account) {
  const r = spawnSync("/usr/bin/security", ["find-generic-password", "-s", SERVICE, "-a", account, "-w"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    timeout: 20_000,
  });
  return r.status === 0 ? r.stdout.trim() : "";
}

/** Save or replace one key (-U updates it in place), then read it back. */
export function keychainSet(account, value, label) {
  if (!VALUE_RE.test(value)) fail(`That ${label} has characters a key never contains, so it wasn't saved.`);
  spawnSync("/usr/bin/security", ["-i"], {
    input: `add-generic-password -U -s ${SERVICE} -a ${account} -l "${SERVICE} ${label}" -w "${value}"\n`,
    stdio: ["pipe", "ignore", "ignore"],
    timeout: 20_000,
  });
  if (keychainGet(account) !== value) fail(`The ${label} didn't save in the Keychain. Try again.`);
}

/** The key from the environment, else from the Keychain ("" when neither has it). */
export function savedKey(account) {
  return process.env[account]?.trim() || keychainGet(account);
}

/** Ask for a secret in a dialog: the pasted text, or null when it was cancelled, closed or left for 15 minutes. */
export function askSecret(message) {
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

export function notify(text) {
  spawnSync("osascript", ["-e", "on run argv", "-e", `display notification (item 1 of argv) with title "${TITLE}"`, "-e", "end run", text], {
    stdio: "ignore",
    timeout: 10_000,
  });
}
