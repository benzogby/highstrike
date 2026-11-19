// HighStrike's always-on worker (Ben, 2026-11-18: "set up the always-on polling server"). It keeps one connection open
// to Alpaca's free real-time stream (IEX) and records every minute bar for the stocks members look at into
// public.live_bars, so charts run right up to now (Alpaca's free history stops 15 minutes back; src/lib/candles.ts folds
// these minutes in). Rows older than 40 minutes are pruned. It also takes every trade and writes each stock's latest
// price to public.live_quotes about once a second (Ben, 2026-11-19: "the price updates too slowly"), which the desk's
// live price reads. No dependencies: Node 22's own WebSocket and fetch.
//
// Environment: ALPACA_KEY_ID, ALPACA_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY. Deployed on Railway (worker/README.md).

import { createServer } from "node:http";

const { ALPACA_KEY_ID, ALPACA_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PORT } = process.env;
for (const [k, v] of Object.entries({ ALPACA_KEY_ID, ALPACA_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY })) {
  if (!v) {
    console.error(`worker: ${k} isn't set`);
    process.exit(1);
  }
}

const STREAM = "wss://stream.data.alpaca.markets/v2/iex";
const REST = `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1`;
const HEADERS = { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" };

const state = { connected: false, lastBar: null, lastTrade: null, written: 0, quotes: 0, tickers: 0, startedAt: new Date().toISOString() };

// ---- Which stocks to keep: anything charted in the last week, on a watchlist, held in paper trading, or active -------

let wanted = new Set();
async function refreshWanted() {
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const sources = [
    `candle_cache?select=ticker&fetched_at=gte.${since}`,
    `market_cache?select=key&key=like.bars*&fetched_at=gte.${since}`,
    "watchlist_items?select=ticker",
    "paper_positions?select=underlying",
    "symbols?select=ticker&is_active=eq.true",
  ];
  const next = new Set();
  for (const path of sources) {
    try {
      const res = await fetch(`${REST}/${path}&limit=10000`, { headers: HEADERS });
      if (!res.ok) continue;
      for (const r of await res.json()) {
        const t = r.ticker ?? r.underlying ?? (typeof r.key === "string" ? r.key.split(":")[1] : null);
        if (typeof t === "string" && /^[A-Z][A-Z0-9.]{0,7}$/.test(t)) next.add(t);
      }
    } catch {}
  }
  for (const t of ["SPY", "QQQ", "IWM", "DIA", "AAPL", "NVDA", "TSLA", "MSFT", "AMZN", "META", "GOOGL", "AMD"]) next.add(t);
  wanted = next;
  state.tickers = wanted.size;
}

// ---- New York wall time ----------------------------------------------------------------------------------------------

const NY = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
function nyStamp(ms) {
  const p = Object.fromEntries(NY.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour === "24" ? "00" : p.hour}:${p.minute}`;
}

// ---- Buffer and write ------------------------------------------------------------------------------------------------

const buffer = new Map();
function onBar(b) {
  if (!wanted.has(b.S)) return;
  const ms = Date.parse(b.t);
  const row = { ticker: b.S, t: nyStamp(ms), o: b.o, h: b.h, l: b.l, c: b.c, v: b.v ?? 0, at: new Date(ms).toISOString() };
  buffer.set(`${row.ticker}|${row.t}`, row);
  state.lastBar = row.at;
}

async function flush() {
  if (!buffer.size) return;
  const rows = [...buffer.values()];
  buffer.clear();
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    try {
      const res = await fetch(`${REST}/live_bars?on_conflict=ticker,t`, {
        method: "POST",
        headers: { ...HEADERS, Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(chunk),
      });
      if (!res.ok) console.error("worker: write failed", res.status, (await res.text()).slice(0, 200));
      else state.written += chunk.length;
    } catch (e) {
      console.error("worker: write failed", e.message);
      for (const r of chunk) buffer.set(`${r.ticker}|${r.t}`, r);
    }
  }
}

// ---- Latest trades ---------------------------------------------------------------------------------------------------

const latest = new Map();
function onTrade(t) {
  if (!wanted.has(t.S) || !(t.p > 0)) return;
  const prev = latest.get(t.S);
  if (prev && prev.at >= t.t) return;
  latest.set(t.S, { ticker: t.S, price: t.p, at: t.t });
  state.lastTrade = t.t;
}

let writingQuotes = false;
async function flushQuotes() {
  if (!latest.size || writingQuotes) return;
  const rows = [...latest.values()];
  latest.clear();
  writingQuotes = true;
  try {
    const res = await fetch(`${REST}/live_quotes?on_conflict=ticker`, {
      method: "POST",
      headers: { ...HEADERS, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(rows),
    });
    if (!res.ok) console.error("worker: quote write failed", res.status, (await res.text()).slice(0, 200));
    else state.quotes += rows.length;
  } catch (e) {
    console.error("worker: quote write failed", e.message);
  } finally {
    writingQuotes = false;
  }
}

async function prune() {
  const before = new Date(Date.now() - 40 * 60_000).toISOString();
  try {
    await fetch(`${REST}/live_bars?at=lt.${before}`, { method: "DELETE", headers: HEADERS });
  } catch {}
}

// ---- The stream ------------------------------------------------------------------------------------------------------

let backoff = 2000;
function connect() {
  const ws = new WebSocket(STREAM);
  ws.onopen = () => ws.send(JSON.stringify({ action: "auth", key: ALPACA_KEY_ID, secret: ALPACA_SECRET }));
  ws.onmessage = (ev) => {
    let msgs;
    try {
      msgs = JSON.parse(typeof ev.data === "string" ? ev.data : Buffer.from(ev.data).toString());
    } catch {
      return;
    }
    for (const m of Array.isArray(msgs) ? msgs : [msgs]) {
      if (m.T === "success" && m.msg === "authenticated") {
        ws.send(JSON.stringify({ action: "subscribe", bars: ["*"], updatedBars: ["*"], trades: ["*"] }));
        state.connected = true;
        backoff = 2000;
        console.log("worker: streaming minute bars");
      } else if (m.T === "t") onTrade(m);
      else if (m.T === "b" || m.T === "u") onBar(m);
      else if (m.T === "error") console.error("worker: alpaca says", m.code, m.msg);
    }
  };
  ws.onclose = () => {
    state.connected = false;
    console.error(`worker: stream closed; reconnecting in ${backoff / 1000}s`);
    setTimeout(connect, backoff);
    backoff = Math.min(backoff * 2, 60_000);
  };
  ws.onerror = () => {};
}

// ---- Run -------------------------------------------------------------------------------------------------------------

await refreshWanted();
setInterval(refreshWanted, 10 * 60_000);
setInterval(flush, 5_000);
setInterval(flushQuotes, 1_000);
setInterval(prune, 5 * 60_000);
connect();

// A small status page for Railway's health check and for a look: GET / → JSON.
createServer((_, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(state));
}).listen(Number(PORT) || 8080);
