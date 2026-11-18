#!/usr/bin/env node
/**
 * Save the Massive (formerly Polygon.io) market-data key that HighStrike Chart's candles come from (src/lib/candles.ts).
 *
 *   npm run massive:key      a small macOS dialog asks for the key, checks it with Massive, then saves it
 *
 * The key goes in the login Keychain (service Highstrike, account MASSIVE_API_KEY) and in the database's server-only
 * public.app_secrets table, where the live site reads it (MASSIVE_API_KEY in Vercel's environment would win over it).
 * The table is written through Supabase's Management API with the token scripts/supabase.mjs saved. Nothing here prints the key.
 */
import { askSecret, envFile, fail, keychainSet, notify, savedKey } from "./lib/mac.mjs";

const ACCOUNT = "MASSIVE_API_KEY";
/** Massive keys are letters, digits, _ and - (anything else is a paste slip, and keeps the SQL below safe). */
const KEY_RE = /^[A-Za-z0-9_-]{16,64}$/;

async function check(key) {
  const day = (ms) => new Date(ms).toISOString().slice(0, 10);
  const path = `/v2/aggs/ticker/AAPL/range/1/day/${day(Date.now() - 14 * 86_400_000)}/${day(Date.now())}?adjusted=true`;
  for (const host of ["https://api.massive.com", "https://api.polygon.io"]) {
    try {
      const res = await fetch(`${host}${path}`, { headers: { Authorization: `Bearer ${key}` } });
      if (res.ok) {
        const body = await res.json();
        return { ok: true, bars: body.results?.length ?? 0 };
      }
      if (res.status === 401 || res.status === 403) return { ok: false, why: "Massive didn't accept that key." };
    } catch {
      // try the other host
    }
  }
  return { ok: false, why: "Massive couldn't be reached. Check the internet connection and try again." };
}

let message = [
  "Massive market-data key",
  "",
  "This gives HighStrike's charts real prices.",
  "",
  "1. In your browser, sign in at massive.com",
  "2. Open the dashboard's API Keys page.",
  "3. Copy the default key and paste it here.",
].join("\n");

for (let attempt = 0; attempt < 3; attempt++) {
  const pasted = askSecret(message);
  if (pasted === null) fail("No key saved: the window was closed.");
  const key = pasted.replace(/\s+/g, "");
  if (!KEY_RE.test(key)) {
    message = "That doesn't look like a Massive key (letters and numbers, no spaces).\n\nPaste the key again.";
    continue;
  }
  const r = await check(key);
  if (!r.ok) {
    message = `That didn't work: ${r.why}\n\nPaste the Massive key again.`;
    continue;
  }
  keychainSet(ACCOUNT, key, "Massive API key");
  const sql = `insert into public.app_secrets (name, value, updated_at) values ('${ACCOUNT}', '${key}', now())
    on conflict (name) do update set value = excluded.value, updated_at = now();
    delete from public.candle_cache;`;
  const env = { ...envFile(), ...process.env };
  const ref = env.SUPABASE_PROJECT_REF || (env.NEXT_PUBLIC_SUPABASE_URL ? new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0] : "");
  const token = savedKey("SUPABASE_ACCESS_TOKEN");
  if (!ref || !token) fail("The key works and is in the Keychain, but there's no Supabase access to hand it to the site (npm run supabase:token).");
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  if (!res.ok) fail(`The key works and is in the Keychain, but the site couldn't be given it (Supabase ${res.status}).`);
  notify("Saved. HighStrike's charts use Massive now.");
  console.log(`Saved the Massive key (it returned ${r.bars} recent AAPL bars). The live site reads it within 5 minutes.`);
  process.exit(0);
}
fail("No key saved after three tries.");
