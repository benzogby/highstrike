import { supabaseService } from "@/lib/stripe";
import { massiveKey } from "@/lib/candles";
import { fetchQuotes } from "@/lib/quotes";
import { addDays, isSession, marketOpen, newYorkDate, sessionBefore } from "@/lib/marketCalendar";
import { volatility } from "@/lib/options/pricing";
import { SCAN_UNIVERSE } from "./sectors";
import type { EarningsRow, OptionRow, ScanSnapshot, StockRow, TickerOptions } from "./types";
import { alpacaKeys, latestTrades, listedContracts, optionSnapshots, parseOcc, recentDailyBars } from "@/lib/alpaca";

// The Scanner's data (Ben, 2026-11-18: "super comprehensive and pull in a lot of data, and really easy to read and get
// contract ideas from"), built by /api/cron/scan-refresh every 5 minutes in market hours and kept as one row in
// public.market_cache ("scanner"), so the page reads one row and stays fast. Sources, by what the Massive plan allows:
// - Stocks: Massive's whole-market snapshot (Stocks Starter, 15 min delayed) when allowed; else each session's
//   end-of-day bars for the whole market (free, one call a day: "grouped daily") with live quotes laid over the most
//   traded names (Finnhub). 25 sessions of those bars give relative volume, 5-day move and 20-day volatility.
// - Options: each name's option chain snapshot (Options Starter, 15 min delayed): volume, open interest, IV, delta and
//   price for every contract within 45 days and 15% of the price. Without it the options tabs say so.
// - Earnings: Finnhub's earnings calendar for the next two weeks.
// Nothing made up: a number that isn't known is null and shown as a dash.

const HOSTS = ["https://api.massive.com", "https://api.polygon.io"];
const HISTORY = 25;
const OPTION_DAYS = 45;
const NAMES_WITH_CHAINS = SCAN_UNIVERSE.filter((u) => u.tier <= 2).map((u) => u.ticker);
const TICKERS = SCAN_UNIVERSE.map((u) => u.ticker);
const INFO = new Map(SCAN_UNIVERSE.map((u) => [u.ticker, u]));

async function massive<T>(path: string, key: string): Promise<{ status: number; body: T | null }> {
  let last: { status: number; body: T | null } = { status: 0, body: null };
  for (const host of HOSTS) {
    try {
      const url = path.startsWith("http") ? path : `${host}${path}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${key}` }, cache: "no-store", signal: AbortSignal.timeout(10_000) });
      last = { status: res.status, body: res.ok ? ((await res.json()) as T) : null };
      if (res.ok || [401, 403, 404, 429].includes(res.status) || path.startsWith("http")) return last;
    } catch {}
  }
  return last;
}

/** Where the builder keeps what it fetched: public.market_cache, or anything shaped like it (a test). */
export type Store = {
  get(key: string): Promise<{ body: unknown; fetched_at: string } | null>;
  set(key: string, body: unknown): Promise<void>;
};

export function cacheStore(): Store {
  const db = supabaseService();
  return {
    async get(key) {
      const { data } = await db.from("market_cache").select("body, fetched_at").eq("key", key).maybeSingle();
      return data ?? null;
    },
    async set(key, body) {
      await db.from("market_cache").upsert({ key, body, fetched_at: new Date().toISOString() });
    },
  };
}

type Bar = [c: number, v: number, o: number, h: number, l: number];
type DayBars = Record<string, Bar>;

/** One session's end-of-day bars for the universe, kept forever once fetched (it never changes). */
async function sessionBars(db: Store, day: string, key: string, allowFetch: boolean): Promise<DayBars | null> {
  const k = `grouped:${day}`;
  const data = await db.get(k);
  if (data) return data.body as DayBars;
  if (!allowFetch) return null;
  const { body } = await massive<{ results?: { T: string; c: number; v: number; o: number; h: number; l: number }[] }>(`/v2/aggs/grouped/locale/us/market/stocks/${day}?adjusted=true`, key);
  if (!body?.results?.length) return null;
  const want = new Set(TICKERS);
  const bars: DayBars = {};
  for (const r of body.results) if (want.has(r.T)) bars[r.T] = [r.c, Math.round(r.v), r.o, r.h, r.l];
  await db.set(k, bars);
  return bars;
}

/** The last `n` completed sessions, newest first. Today counts once the market has closed. */
function lastSessions(n: number) {
  const now = Date.now();
  const today = newYorkDate(now);
  // Massive publishes a session's end-of-day bars in the evening: count today from 22:00 UTC (5 or 6 PM New York).
  let d = isSession(today) && !marketOpen(now) && new Date(now).getUTCHours() >= 22 ? today : sessionBefore(today);
  const out: string[] = [];
  while (out.length < n) {
    out.push(d);
    d = sessionBefore(d);
  }
  return out;
}

type MarketSnap = {
  tickers?: { ticker: string; todaysChangePerc?: number; day?: { o: number; h: number; l: number; c: number; v: number }; prevDay?: { c: number; v: number }; lastTrade?: { p: number }; min?: { c: number } }[];
};

type ChainSnap = {
  results?: {
    details?: { ticker: string; contract_type: "call" | "put"; strike_price: number; expiration_date: string };
    day?: { volume?: number; close?: number };
    last_quote?: { bid?: number; ask?: number; midpoint?: number };
    implied_volatility?: number;
    greeks?: { delta?: number };
    open_interest?: number;
    underlying_asset?: { price?: number };
  }[];
  next_url?: string;
};

async function pool<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k]);
      }
    })
  );
  return out;
}

export async function buildScan(deadline = Date.now() + 240_000, db: Store = cacheStore()): Promise<ScanSnapshot> {
  const key = await massiveKey();
  const notes: string[] = [];
  if (!key) notes.push("No Massive key.");

  // What the Massive plan allows, checked every 6 hours (each check is a call, and the free plan has 5 a minute).
  const planRow = await db.get("massive_plan");
  let plan = planRow && Date.now() - Date.parse(planRow.fetched_at) < 6 * 3_600_000 ? (planRow.body as { stocks: boolean; options: boolean }) : null;
  if (!plan && key) {
    const [s, o] = await Promise.all([massive(`/v2/snapshot/locale/us/markets/stocks/tickers?tickers=SPY`, key), massive(`/v3/snapshot/options/SPY?limit=1`, key)]);
    plan = { stocks: s.status === 200, options: o.status === 200 };
    await db.set("massive_plan", plan);
  }

  // History: the last HISTORY sessions' bars, fetching at most 2 missing days a run (the free plan's 5 calls a minute).
  const sessions = lastSessions(HISTORY);
  let fetched = 0;
  const raw: (DayBars | null)[] = [];
  for (const day of sessions) {
    const allow = Boolean(key) && fetched < 2;
    const had = await sessionBars(db, day, key, false);
    if (had) raw.push(had);
    else {
      const got = allow ? await sessionBars(db, day, key, true) : null;
      if (allow) fetched++;
      raw.push(got);
    }
  }
  // The sessions we have, newest first (a day still being filled in is skipped).
  const history = raw.filter((h): h is DayBars => h != null);
  const lastBars = history[0] ?? {};
  const closeOn = (t: string, back: number) => history[back]?.[t]?.[0] ?? null;

  // Stocks now: the whole-market snapshot when the plan allows it, else last close with live quotes over the busiest names.
  let stocksFrom: ScanSnapshot["stocksFrom"] = "close";
  const now: Map<string, { price: number; chg: number; open: number | null; high: number | null; low: number | null; vol: number | null; live: boolean }> = new Map();
  if (key && plan?.stocks) {
    const { status, body } = await massive<MarketSnap>(`/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${TICKERS.join(",")}`, key);
    if (status === 200 && body?.tickers?.length) {
      stocksFrom = "snapshot";
      for (const s of body.tickers) {
        const price = s.lastTrade?.p || s.min?.c || s.day?.c || s.prevDay?.c;
        if (!price) continue;
        now.set(s.ticker, {
          price,
          chg: s.todaysChangePerc ?? 0,
          open: s.day?.o || null,
          high: s.day?.h || null,
          low: s.day?.l || null,
          vol: s.day?.v || null,
          live: Boolean(s.day?.v),
        });
      }
    }
  }
  // Alpaca (src/lib/alpaca.ts), when its keys are in: real-time last trades (IEX) for every name, and today's
  // whole-market bar up to 15 minutes back for the open, high, low and volume.
  const alpacaOn = Boolean(await alpacaKeys());
  if (stocksFrom === "close" && alpacaOn) {
    try {
      const [trades, days] = await Promise.all([latestTrades(TICKERS), recentDailyBars(TICKERS)]);
      const todayNY = newYorkDate(Date.now());
      for (const t of TICKERS) {
        const tr = trades.get(t);
        if (!tr) continue;
        const d = days.get(t) ?? [];
        const todays = d.at(-1)?.date === todayNY ? d.at(-1)! : null;
        const prevC = (todays ? d.at(-2) : d.at(-1))?.c ?? lastBars[t]?.[0] ?? null;
        now.set(t, {
          price: tr.price,
          chg: prevC ? ((tr.price - prevC) / prevC) * 100 : 0,
          open: todays?.o ?? null,
          high: todays ? Math.max(todays.h, tr.price) : null,
          low: todays ? Math.min(todays.l, tr.price) : null,
          vol: todays?.v ?? null,
          live: true,
        });
      }
      if (now.size) stocksFrom = "alpaca";
    } catch (e) {
      notes.push(`Alpaca prices didn't answer (${e instanceof Error ? e.message : "error"}).`);
    }
  }
  if (stocksFrom === "close" && marketOpen(Date.now(), 5)) {
    const busiest = SCAN_UNIVERSE.filter((u) => u.tier === 1).map((u) => u.ticker);
    const quotes = await fetchQuotes(busiest).catch(() => []);
    for (const q of quotes) {
      if (!q.live) continue;
      now.set(q.symbol, { price: q.price, chg: q.changePct, open: q.open ?? null, high: q.high ?? null, low: q.low ?? null, vol: null, live: true });
    }
    if (now.size) stocksFrom = "close+live";
  }

  const stocks: StockRow[] = [];
  for (const t of TICKERS) {
    const info = INFO.get(t)!;
    const bar = lastBars[t];
    const live = now.get(t);
    const prev = history[1]?.[t]?.[0] ?? null;
    if (!bar && !live) continue;
    // Live: today's move against the last close. Otherwise the last session against the one before.
    const price = live?.price ?? bar![0];
    const base = live ? bar?.[0] ?? null : prev;
    const chg = live ? live.chg : base ? ((price - base) / base) * 100 : null;
    const open = live ? live.open : bar?.[2] ?? null;
    const gap = open && base ? ((open - base) / base) * 100 : null;
    const high = live ? live.high : bar?.[3] ?? null;
    const low = live ? live.low : bar?.[4] ?? null;
    const vol = live ? live.vol : bar?.[1] ?? null;
    const pastVols = history.slice(live ? 0 : 1, live ? 20 : 21).map((h) => h?.[t]?.[1]).filter((v): v is number => typeof v === "number" && v > 0);
    const avgVol = pastVols.length >= 5 ? pastVols.reduce((a, b) => a + b, 0) / pastVols.length : null;
    const closes = history.map((h) => h?.[t]?.[0]).filter((c): c is number => typeof c === "number").reverse();
    const fiveBack = closeOn(t, live ? 4 : 5);
    stocks.push({
      t,
      sector: info.sector,
      tier: info.tier,
      price: Math.round(price * 100) / 100,
      chg: chg == null ? null : Math.round(chg * 100) / 100,
      gap: gap == null ? null : Math.round(gap * 100) / 100,
      rangePos: high && low && high > low ? Math.round(((price - low) / (high - low)) * 100) / 100 : null,
      vol,
      dollarVol: vol ? Math.round(vol * price) : avgVol ? Math.round(avgVol * price) : null,
      relVol: vol && avgVol ? Math.round((vol / avgVol) * 100) / 100 : null,
      mom5: fiveBack ? Math.round(((price - fiveBack) / fiveBack) * 10_000) / 100 : null,
      hv20: closes.length >= 15 ? Math.round(volatility(closes.slice(-21)) * 1000) / 1000 : null,
      live: Boolean(live?.live),
    });
  }

  // Options: every chain within 45 days and 15% of the price, when the plan allows chain snapshots.
  let optionsFrom: ScanSnapshot["optionsFrom"] = null;
  const contracts: OptionRow[] = [];
  const byTicker: TickerOptions[] = [];
  const price = new Map(stocks.map((s) => [s.t, s.price]));
  const today = newYorkDate(Date.now());
  /** One name's contracts into the hot and unusual lists, and its summary: call and put volume, ATM IV, the move. */
  const summarize = (u: string, spot: number, rows: OptionRow[]) => {
    if (!rows.length) return;
    contracts.push(...rows.filter((r) => r.vol > 0));
    const callVol = rows.filter((r) => r.type === "call").reduce((a, r) => a + r.vol, 0);
    const putVol = rows.filter((r) => r.type === "put").reduce((a, r) => a + r.vol, 0);
    // At the money, about a month out: the contracts nearest the price in the expiry nearest 30 days.
    const expiries = [...new Set(rows.map((r) => r.expiry))];
    const month = expiries.reduce((best, e) => (Math.abs(Date.parse(e) - Date.now() - 30 * 86_400_000) < Math.abs(Date.parse(best) - Date.now() - 30 * 86_400_000) ? e : best), expiries[0]);
    const atm = rows.filter((r) => r.expiry === month && r.iv != null).sort((a, b) => Math.abs(a.strike - spot) - Math.abs(b.strike - spot)).slice(0, 4);
    const atmIv = atm.length ? atm.reduce((a, r) => a + (r.iv as number), 0) / atm.length : null;
    const hv = stocks.find((s) => s.t === u)?.hv20 ?? null;
    const dte = atm[0]?.dte ?? 30;
    byTicker.push({
      u,
      callVol,
      putVol,
      pcr: callVol > 0 ? Math.round((putVol / callVol) * 100) / 100 : null,
      atmIv: atmIv != null ? Math.round(atmIv * 1000) / 1000 : null,
      ivHv: atmIv != null && hv ? Math.round((atmIv / hv) * 100) / 100 : null,
      moveExpiry: atmIv != null ? month : null,
      movePct: atmIv != null ? Math.round(atmIv * Math.sqrt(Math.max(1, dte) / 365) * 1000) / 10 : null,
      premium: rows.reduce((a, r) => a + (r.premium ?? 0), 0),
    });
  };
  if (key || alpacaOn) {
    if (plan?.options) {
      optionsFrom = "snapshot";
      await pool(NAMES_WITH_CHAINS, 8, async (u) => {
        if (Date.now() > deadline) return;
        const spot = price.get(u);
        if (!spot) return;
        const q = new URLSearchParams({
          "expiration_date.gte": today,
          "expiration_date.lte": addDays(today, OPTION_DAYS),
          "strike_price.gte": String(Math.floor(spot * 0.85)),
          "strike_price.lte": String(Math.ceil(spot * 1.15)),
          limit: "250",
        });
        let next: string | null = `/v3/snapshot/options/${u}?${q}`;
        const rows: OptionRow[] = [];
        for (let page = 0; next && page < 4 && Date.now() < deadline; page++) {
          const res: { status: number; body: ChainSnap | null } = await massive<ChainSnap>(next, key);
          for (const r of res.body?.results ?? []) {
            const d = r.details;
            if (!d) continue;
            const bid = r.last_quote?.bid ?? null;
            const ask = r.last_quote?.ask ?? null;
            const mid = r.last_quote?.midpoint ?? (bid != null && ask != null ? (bid + ask) / 2 : r.day?.close ?? null);
            const vol = r.day?.volume ?? 0;
            const oi = r.open_interest ?? 0;
            const dte = Math.max(0, Math.round((Date.parse(`${d.expiration_date}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000));
            const s = r.underlying_asset?.price || spot;
            rows.push({
              c: d.ticker,
              u,
              type: d.contract_type,
              strike: d.strike_price,
              expiry: d.expiration_date,
              dte,
              vol,
              oi,
              volOi: oi > 0 ? Math.round((vol / oi) * 100) / 100 : null,
              iv: r.implied_volatility ?? null,
              delta: r.greeks?.delta ?? null,
              mid: mid != null ? Math.round(mid * 100) / 100 : null,
              bid,
              ask,
              premium: mid != null ? Math.round(vol * mid * 100) : null,
              otm: Math.round(((d.contract_type === "call" ? d.strike_price - s : s - d.strike_price) / s) * 1000) / 10,
              spot: s,
            });
          }
          next = res.body?.next_url ?? null;
        }
        summarize(u, spot, rows);
      });
    } else if (alpacaOn) {
      // Alpaca's free indicative snapshots (today's volume, quotes, IV, delta) and its contract list (open interest),
      // three names at a time, paced inside its 200 requests a minute.
      optionsFrom = "alpaca";
      const until = addDays(today, OPTION_DAYS);
      await pool(NAMES_WITH_CHAINS, 3, async (u) => {
        if (Date.now() > deadline) return;
        const spot = price.get(u);
        if (!spot) return;
        const range = { expiryFrom: today, expiryTo: until, strikeFrom: Math.floor(spot * 0.85), strikeTo: Math.ceil(spot * 1.15) };
        let snaps: Awaited<ReturnType<typeof optionSnapshots>>;
        let listed: Awaited<ReturnType<typeof listedContracts>>;
        try {
          [snaps, listed] = await Promise.all([optionSnapshots(u, range), listedContracts(u, range)]);
        } catch {
          return;
        }
        const oiOf = new Map(listed.map((c) => [c.symbol, c.oi]));
        const rows: OptionRow[] = [];
        for (const s of snaps) {
          const p = parseOcc(s.symbol);
          if (!p) continue;
          const mid = s.bid != null && s.ask != null ? (s.bid + s.ask) / 2 : s.last;
          const oi = oiOf.get(s.symbol) ?? 0;
          const dte = Math.max(0, Math.round((Date.parse(`${p.expiry}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000));
          rows.push({
            c: `O:${s.symbol}`,
            u,
            type: p.type,
            strike: p.strike,
            expiry: p.expiry,
            dte,
            vol: s.volume,
            oi,
            volOi: oi > 0 ? Math.round((s.volume / oi) * 100) / 100 : null,
            iv: s.iv,
            delta: s.delta,
            mid: mid != null ? Math.round(mid * 100) / 100 : null,
            bid: s.bid,
            ask: s.ask,
            premium: mid != null ? Math.round(s.volume * mid * 100) : null,
            otm: Math.round(((p.type === "call" ? p.strike - spot : spot - p.strike) / spot) * 1000) / 10,
            spot,
          });
        }
        summarize(u, spot, rows);
      });
    } else notes.push("Option chains aren't on this Massive plan (Options Starter adds them).");
  }
  const hot = [...contracts].sort((a, b) => b.vol - a.vol).slice(0, 150);
  // Unusual: today's volume well over the contracts already open, with real money behind it.
  const unusual = contracts
    .filter((r) => r.vol >= 300 && r.volOi != null && r.volOi >= 2 && (r.premium ?? 0) >= 50_000)
    .sort((a, b) => (b.premium ?? 0) - (a.premium ?? 0))
    .slice(0, 150);

  // Earnings in the next two weeks, for the universe.
  const earnings: EarningsRow[] = [];
  const token = process.env.FINNHUB_API_KEY;
  if (token) {
    try {
      const res = await fetch(`https://finnhub.io/api/v1/calendar/earnings?from=${today}&to=${addDays(today, 14)}&token=${token}`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
      const body = res.ok ? ((await res.json()) as { earningsCalendar?: { symbol: string; date: string; hour?: string; epsEstimate?: number | null }[] }) : null;
      for (const e of body?.earningsCalendar ?? []) {
        if (!INFO.has(e.symbol)) continue;
        const opt = byTicker.find((b) => b.u === e.symbol);
        const hv = stocks.find((s) => s.t === e.symbol)?.hv20 ?? null;
        earnings.push({
          t: e.symbol,
          date: e.date,
          hour: e.hour === "bmo" ? "before open" : e.hour === "amc" ? "after close" : null,
          eps: e.epsEstimate ?? null,
          movePct: opt?.atmIv != null ? Math.round(opt.atmIv * Math.sqrt(7 / 365) * 1000) / 10 : hv ? Math.round(hv * Math.sqrt(1 / 252) * 2 * 1000) / 10 : null,
          moveFrom: opt?.atmIv != null ? "options" : hv ? "history" : null,
        });
      }
      earnings.sort((a, b) => a.date.localeCompare(b.date) || a.t.localeCompare(b.t));
    } catch {
      notes.push("Earnings calendar didn't answer.");
    }
  } else notes.push("No Finnhub key for earnings.");

  const moved = stocks.filter((s) => s.chg != null);
  return {
    v: 1,
    asOf: new Date().toISOString(),
    session: sessions[0],
    stocksFrom,
    optionsFrom,
    historyDays: history.length,
    breadth: { up: moved.filter((s) => (s.chg as number) > 0).length, down: moved.filter((s) => (s.chg as number) < 0).length },
    stocks,
    hot,
    unusual,
    byTicker,
    earnings,
    notes,
  };
}

/** Builds the Scanner and keeps it. */
export async function refreshScan() {
  const snap = await buildScan();
  await supabaseService().from("market_cache").upsert({ key: "scanner", body: snap, fetched_at: snap.asOf });
  return { stocks: snap.stocks.length, contracts: snap.hot.length, unusual: snap.unusual.length, earnings: snap.earnings.length, history: snap.historyDays, stocksFrom: snap.stocksFrom, optionsFrom: snap.optionsFrom, notes: snap.notes };
}

/** The kept Scanner, or null before the first build. */
export async function readScan(): Promise<ScanSnapshot | null> {
  const { data } = await supabaseService().from("market_cache").select("body").eq("key", "scanner").maybeSingle();
  return (data?.body as ScanSnapshot) ?? null;
}
