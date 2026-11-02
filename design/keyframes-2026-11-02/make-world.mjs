// Builds world.json for the keyframes from the same public data the live homepage reads:
// the publishable key and the public RPCs in supabase/migrations/20261025160000_public_landing_data.sql and
// 20261026150000_landing_lookup.sql. Nothing members-only, nothing secret.
//   node design/keyframes-2026-11-02/make-world.mjs
import { writeFileSync } from "node:fs";

const URL_ = "https://dobrcbahlbypzvbuwkoe.supabase.co";
const KEY = "sb_publishable_HbSKSebFTzNhHImOxW2QXA_8qaOO96n"; // public by design (src/lib/supabaseConfig.ts)
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

async function rpc(name, body = {}) {
  const r = await fetch(`${URL_}/rest/v1/rpc/${name}`, { method: "POST", headers: H, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${name}: ${r.status} ${await r.text()}`);
  return r.json();
}
async function table(path) {
  const r = await fetch(`${URL_}/rest/v1/${path}`, { headers: H });
  if (!r.ok) throw new Error(`${path}: ${r.status} ${await r.text()}`);
  return r.json();
}

const [weather, today, closed, spy, stats, weeks, movers, settings] = await Promise.all([
  table("weather_reports?select=report_date,volatility,opportunity,direction,summary&order=report_date.desc&limit=5"),
  rpc("get_landing_setups_today"),
  rpc("get_recent_closed_setups", { limit_n: 24 }),
  rpc("get_landing_closes", { sym: "SPY", days: 90 }),
  rpc("get_setup_stats"),
  rpc("get_landing_weekly_record"),
  rpc("get_landing_movers"),
  table("site_settings?select=key,value&key=in.(hero_badges,scoreboard,logo_dark,logo)"),
]);

const wanted = new Set(["NVDA", ...today.map((t) => t.ticker), ...closed.map((c) => c.ticker)]);
const reads = {};
for (const sym of wanted) {
  try { reads[sym] = await rpc("get_landing_ticker", { sym }); } catch (e) { reads[sym] = { error: String(e) }; }
}

// Longer daily series for the charts (the same public RPC the homepage uses for SPY).
const series = {};
for (const sym of ["VICR", "IREN", "HOOD", "MSTR", "DELL", "PFE", "XOM", "NVDA", "QQQ"]) {
  try { series[sym] = await rpc("get_landing_closes", { sym, days: 90 }); } catch (e) { series[sym] = { error: String(e) }; }
}

const out = { fetched: new Date().toISOString(), weather, today, closed, spy, stats, weeks, movers, settings, reads, series };
writeFileSync(new URL("./world.json", import.meta.url), JSON.stringify(out, null, 1));
// The pages read it as a script, so they open straight from the file system too.
writeFileSync(new URL("./world.js", import.meta.url), "window.WORLD = " + JSON.stringify(out) + ";\n");
console.log(JSON.stringify({ weather: weather.map((w) => w.report_date), today, stats, closed: closed.length, movers: movers.length, weeks: weeks.length, spy: spy.length, reads: Object.keys(reads), series: Object.fromEntries(Object.entries(series).map(([k, v]) => [k, Array.isArray(v) ? `${v.length} ${v[0]?.price_date}..${v.at(-1)?.price_date}` : v])) }, null, 1));
