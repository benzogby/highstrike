#!/usr/bin/env node
/**
 * Save the Alpaca market-data keys (free plan): HighStrike's chart history and live bars (src/lib/alpaca.ts, worker/).
 *
 *   npm run alpaca:key      two small macOS dialogs ask for the API key ID and the secret, check them with Alpaca, save
 *
 * Both go in the login Keychain (service Highstrike, accounts ALPACA_KEY_ID and ALPACA_SECRET) and in the database's
 * server-only public.app_secrets table, where the live site reads them. Written through Supabase's Management API with
 * the token scripts/supabase.mjs saved. Nothing here prints a key.
 */
import { askSecret, envFile, fail, keychainSet, notify, savedKey } from "./lib/mac.mjs";

const ID_RE = /^[A-Z0-9]{16,32}$/;
const SECRET_RE = /^[A-Za-z0-9/+=_-]{24,80}$/;

async function check(id, secret) {
  try {
    const res = await fetch("https://data.alpaca.markets/v2/stocks/AAPL/bars?timeframe=1Day&limit=5&feed=iex", {
      headers: { "APCA-API-KEY-ID": id, "APCA-API-SECRET-KEY": secret },
    });
    if (res.ok) return { ok: true, bars: ((await res.json()).bars ?? []).length };
    if (res.status === 401 || res.status === 403) return { ok: false, why: "Alpaca didn't accept that key and secret." };
    return { ok: false, why: `Alpaca answered ${res.status}.` };
  } catch {
    return { ok: false, why: "Alpaca couldn't be reached. Check the internet connection and try again." };
  }
}

let first = [
  "Alpaca market data (1 of 2): API Key ID",
  "",
  "1. Sign in at alpaca.markets",
  "2. On the dashboard's home, find API Keys and click Generate New Keys.",
  "3. Copy the Key ID (letters and numbers, starts with PK or AK) and paste it here.",
].join("\n");

for (let attempt = 0; attempt < 3; attempt++) {
  const id = askSecret(first)?.replace(/\s+/g, "");
  if (id == null) fail("Nothing saved: the window was closed.");
  if (!ID_RE.test(id)) {
    first = "That doesn't look like an Alpaca Key ID (capital letters and numbers).\n\nPaste the Key ID again.";
    continue;
  }
  const secret = askSecret("Alpaca market data (2 of 2): Secret Key\n\nPaste the Secret Key shown next to the Key ID (Alpaca shows it once).")?.replace(/\s+/g, "");
  if (secret == null) fail("Nothing saved: the window was closed.");
  if (!SECRET_RE.test(secret)) {
    first = "That secret doesn't look right. Start again: paste the Key ID.";
    continue;
  }
  const r = await check(id, secret);
  if (!r.ok) {
    first = `That didn't work: ${r.why}\n\nPaste the Key ID again.`;
    continue;
  }
  keychainSet("ALPACA_KEY_ID", id, "Alpaca key ID");
  keychainSet("ALPACA_SECRET", secret, "Alpaca secret");
  const sql = `insert into public.app_secrets (name, value, updated_at) values ('ALPACA_KEY_ID', '${id}', now()), ('ALPACA_SECRET', '${secret}', now())
    on conflict (name) do update set value = excluded.value, updated_at = now();
    delete from public.market_cache where key like 'bars%' or key like 'daily:%';
    delete from public.candle_cache;`;
  const env = { ...envFile(), ...process.env };
  const ref = env.SUPABASE_PROJECT_REF || (env.NEXT_PUBLIC_SUPABASE_URL ? new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0] : "");
  const token = savedKey("SUPABASE_ACCESS_TOKEN");
  if (!ref || !token) fail("The keys work and are in the Keychain, but there's no Supabase access to hand them to the site (npm run supabase:token).");
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  if (!res.ok) fail(`The keys work and are in the Keychain, but the site couldn't be given them (Supabase ${res.status}).`);
  notify("Saved. HighStrike's charts use Alpaca now.");
  console.log(`Saved the Alpaca keys (they returned ${r.bars} recent AAPL bars). The live site reads them within 5 minutes.`);
  process.exit(0);
}
fail("Nothing saved after three tries.");
