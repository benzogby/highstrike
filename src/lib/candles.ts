import { supabaseService } from "@/lib/stripe";
import { fetchQuotes } from "@/lib/quotes";
import { isSession, marketOpen, newYorkDate } from "@/lib/marketCalendar";
import type { Candle } from "@/lib/chart/types";
import { barStart, hhmm, minuteOf } from "@/lib/chart/sessions";
import { AlpacaBusy, SIP_DELAY_MS, alpacaBars, alpacaKeys, nyStamp as nyStampOf, occOf, optionBars, recentMinutes } from "@/lib/alpaca";

// Daily candles for HighStrike Chart (Ben, 2026-11-17: "our own custom charts, with our UI, and deep markup ability";
// data from a Massive/Polygon account, docs/plans/offer-overhaul.md). Two years of daily bars per ticker, cached in
// public.candle_cache so the free plan's 5 calls a minute serve every member: a ticker is fetched again only when its
// copy is older than 20 minutes while the market's open, or older than the last close otherwise. Today's bar is
// patched from the live quote (Finnhub), since the free plan is end of day. Sources, in order: Massive (the key in
// MASSIVE_API_KEY / POLYGON_API_KEY or public.app_secrets), then whatever is cached however old. Never made-up prices:
// no data is shown as no data.

const FRESH_OPEN_MS = 20 * 60_000;

/** `busy`: the data plan's requests-a-minute ran out (the free plan has 5); the chart tries again shortly. */
export type CandleSet = { candles: Candle[]; source: "massive" | "alpaca" | "none"; stale: boolean; fetchedAt: string | null; busy?: boolean };

/** Massive refused for its requests-a-minute limit: no point asking its other host, which shares the limit. */
class RateLimited extends Error {}

let keyMemo: { value: string; at: number } | null = null;

/** The Massive key: the environment's, else the one Ben pasted (public.app_secrets), remembered for 5 minutes. */
export async function massiveKey(): Promise<string> {
  const env = process.env.MASSIVE_API_KEY?.trim() || process.env.POLYGON_API_KEY?.trim();
  if (env) return env;
  if (keyMemo && Date.now() - keyMemo.at < 5 * 60_000) return keyMemo.value;
  try {
    const { data } = await supabaseService().from("app_secrets").select("value").eq("name", "MASSIVE_API_KEY").maybeSingle();
    keyMemo = { value: data?.value?.trim() ?? "", at: Date.now() };
  } catch {
    keyMemo = { value: "", at: Date.now() };
  }
  return keyMemo.value;
}

const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);

async function fromMassive(ticker: string, key: string): Promise<Candle[]> {
  const to = day(Date.now());
  const from = day(Date.now() - 2 * 365 * 86_400_000);
  const path = `/v2/aggs/ticker/${encodeURIComponent(ticker)}/range/1/day/${from}/${to}?adjusted=true&sort=asc&limit=50000`;
  let lastError: unknown = null;
  for (const host of ["https://api.massive.com", "https://api.polygon.io"]) {
    try {
      const res = await fetch(`${host}${path}`, { headers: { Authorization: `Bearer ${key}` }, cache: "no-store", signal: AbortSignal.timeout(6000) });
      if (res.status === 429) throw new RateLimited(`${host} 429`);
      if (!res.ok) throw new Error(`${host} ${res.status}`);
      const json = (await res.json()) as { results?: { t: number; o: number; h: number; l: number; c: number; v: number }[] };
      // Bars are stamped at midnight New York time, which is the previous day in UTC: +12h lands on the right date.
      return (json.results ?? []).map((r) => ({ t: day(r.t + 12 * 3_600_000), o: r.o, h: r.h, l: r.l, c: r.c, v: r.v ?? 0 }));
    } catch (e) {
      if (e instanceof RateLimited) throw e;
      lastError = e;
    }
  }
  throw lastError;
}

/** Whether a cached copy is still good: 20 minutes in market hours; otherwise, fetched after the last session ended. */
function fresh(fetchedAt: string) {
  const at = Date.parse(fetchedAt);
  const now = Date.now();
  if (marketOpen(now)) return now - at < FRESH_OPEN_MS;
  // Out of hours nothing new is coming until the next close; a copy from after 4:30 PM ET today (or any time since the
  // last session) is complete. Approximate with: fetched less than 6 hours ago, or fetched while the market was shut and
  // on the same New York date.
  return now - at < 6 * 3_600_000 || (!marketOpen(at) && newYorkDate(at) === newYorkDate(now));
}

/** Today's bar from the live quote, laid over the end-of-day series while the session's on (or just after). */
async function withToday(ticker: string, candles: Candle[]): Promise<Candle[]> {
  if (candles.length === 0) return candles;
  const today = newYorkDate(Date.now());
  const last = candles[candles.length - 1];
  if (last.t === today) return candles;
  // Only during today's session (and the evening after it): before the open, or on a weekend, the quote is the last
  // session's, which the series already has.
  if (!isSession(today) || !marketOpen(Date.now(), 8 * 60)) return candles;
  const [q] = await fetchQuotes([ticker]);
  if (!q?.live || !q.open || !q.high || !q.low || !(q.price > 0)) return candles;
  return [...candles, { t: today, o: q.open, h: Math.max(q.high, q.price), l: Math.min(q.low, q.price), c: q.price, v: 0, live: true }];
}

export async function getCandles(raw: string): Promise<CandleSet> {
  const ticker = raw.toUpperCase();
  // The cache is a help, not a must: without it (no service key, a database hiccup) the feed is asked directly.
  let db: ReturnType<typeof supabaseService> | null = null;
  try {
    db = supabaseService();
  } catch {}
  const { data: cached } = db
    ? await db.from("candle_cache").select("candles, source, fetched_at").eq("ticker", ticker).maybeSingle()
    : { data: null };

  if (cached && fresh(cached.fetched_at) && (cached.candles as Candle[]).length > 0) {
    return { candles: await withToday(ticker, cached.candles as Candle[]), source: cached.source as CandleSet["source"], stale: false, fetchedAt: cached.fetched_at };
  }

  let candles: Candle[] = [];
  let source: CandleSet["source"] = "none";
  let busy = false;
  // Alpaca first when its keys are in (about 200 requests a minute, today's bar included), else Massive.
  if (await alpacaKeys()) {
    try {
      // As far back as the source goes (asked for 20 years; Alpaca's free data starts in 2016), for monthly and yearly.
      candles = await alpacaBars(ticker, "1Day", 7305);
      if (candles.length) source = "alpaca";
    } catch (e) {
      busy = e instanceof AlpacaBusy;
      if (!busy) console.error("candles: alpaca failed for", ticker, e instanceof Error ? e.message : e);
    }
  }
  const key = candles.length ? "" : await massiveKey();
  if (key) {
    try {
      candles = await fromMassive(ticker, key);
      source = "massive";
      busy = false;
    } catch (e) {
      busy = busy || e instanceof RateLimited;
      if (!(e instanceof RateLimited)) console.error("candles: massive failed for", ticker, e instanceof Error ? e.message : e);
    }
  }

  if (candles.length > 0) {
    const fetchedAt = new Date().toISOString();
    if (db) await db.from("candle_cache").upsert({ ticker, candles, source, fetched_at: fetchedAt });
    return { candles: await withToday(ticker, candles), source, stale: false, fetchedAt };
  }
  if (cached && (cached.candles as Candle[]).length > 0) {
    return { candles: await withToday(ticker, cached.candles as Candle[]), source: cached.source as CandleSet["source"], stale: true, fetchedAt: cached.fetched_at };
  }
  return { candles: [], source: "none", stale: false, fetchedAt: null, busy };
}

// ---- Intraday (Ben, 2026-11-18: "More timeframes. Down to 1m") -------------------------------------------------------
// Minute bars from Massive, pre-market and after-hours included (4:00 AM to 8:00 PM New York time), stamped with their
// New York wall time ("2026-11-17T09:30"). 1h and 4h bars are built from 30-minute ones, counted from each session's
// start (src/lib/chart/sessions.ts), so none straddles the open or the close. The free plan has bars up to the last
// close; with Stocks Starter today's come too, 15 minutes delayed. Kept in public.market_cache for everyone.

// One Massive request covers about 52 sessions of minutes (50,000 of them, extended hours included), so the longer
// timeframes follow its next-page links: `pages` at most (each one a call; the cache shares the result).
export const INTRADAY = {
  // `ext`: pre-market and after-hours too (4:00 AM to 8:00 PM), which the chart shades (Ben, 2026-11-18: "Gray out…
  // market closed times").
  "1m": { mult: 1, span: "minute", days: 7, group: 1, pages: 1, ext: true },
  "5m": { mult: 5, span: "minute", days: 28, group: 1, pages: 1, ext: true },
  "15m": { mult: 15, span: "minute", days: 60, group: 1, pages: 1, ext: true },
  "30m": { mult: 30, span: "minute", days: 72, group: 1, pages: 1, ext: true },
  "1h": { mult: 30, span: "minute", days: 72, group: 2, pages: 1, ext: true },
  "4h": { mult: 30, span: "minute", days: 150, group: 8, pages: 2, ext: true },
} as const;
export type Intraday = keyof typeof INTRADAY;

const NY = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
/** A moment as New York wall time, "2026-11-17T09:30". */
function nyStamp(ms: number) {
  const p = Object.fromEntries(NY.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour === "24" ? "00" : p.hour}:${p.minute}`;
}

async function intradayFromMassive(ticker: string, tf: Intraday, key: string): Promise<Candle[]> {
  const spec = INTRADAY[tf];
  const to = day(Date.now());
  const from = day(Date.now() - spec.days * 86_400_000);
  // Newest first, so a page cut short (the free plan's 5 calls a minute) still leaves the most recent bars.
  const path = `/v2/aggs/ticker/${encodeURIComponent(ticker)}/range/${spec.mult}/${spec.span}/${from}/${to}?adjusted=true&sort=desc&limit=50000`;
  let lastError: unknown = null;
  for (const host of ["https://api.massive.com", "https://api.polygon.io"]) {
    try {
      const bars: Candle[] = [];
      let url: string | null = `${host}${path}`;
      for (let page = 0; url && page < spec.pages; page++) {
        const res: Response = await fetch(url, { headers: { Authorization: `Bearer ${key}` }, cache: "no-store", signal: AbortSignal.timeout(8000) });
        if (!res.ok) {
          if (page > 0) break; // keep what the first pages gave
          if (res.status === 429) throw new RateLimited(`${host} 429`);
          throw new Error(`${host} ${res.status}`);
        }
        const json = (await res.json()) as { results?: { t: number; o: number; h: number; l: number; c: number; v: number }[]; next_url?: string };
        for (const r of json.results ?? []) {
          const t = nyStamp(r.t);
          const hm = t.slice(11);
          if (spec.ext ? hm < "04:00" || hm >= "20:00" : hm < "09:30" || hm >= "16:00") continue;
          bars.push({ t, o: r.o, h: r.h, l: r.l, c: r.c, v: r.v ?? 0 });
        }
        url = json.next_url ?? null;
      }
      bars.sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : 0));
      return spec.group > 1 ? groupBars(bars, spec.group) : bars;
    } catch (e) {
      if (e instanceof RateLimited) throw e;
      lastError = e;
    }
  }
  throw lastError;
}

/** Rolls 30-minute bars into bars of `n` of them, counted from each day's open. */
function groupBars(bars: Candle[], n: number): Candle[] {
  const out: Candle[] = [];
  let key = "";
  for (const b of bars) {
    // Counted from each session's start (src/lib/chart/sessions.ts), stamped with the bar's start.
    const start = barStart(minuteOf(b.t), 30 * n);
    if (start == null) continue;
    const k = `${b.t.slice(0, 10)}T${hhmm(start)}`;
    const last = out[out.length - 1];
    if (k !== key || !last) {
      out.push({ ...b, t: k });
      key = k;
    } else {
      last.h = Math.max(last.h, b.h);
      last.l = Math.min(last.l, b.l);
      last.c = b.c;
      last.v += b.v;
    }
  }
  return out;
}

/** The bar sizes in minutes. */
const TF_MINUTES: Record<Intraday, number> = { "1m": 1, "5m": 5, "15m": 15, "30m": 30, "1h": 60, "4h": 240 };

async function intradayFromAlpaca(ticker: string, tf: Intraday): Promise<Candle[]> {
  const spec = INTRADAY[tf];
  const frame = spec.group > 1 ? "30Min" : `${spec.mult}Min`;
  const bars = (await alpacaBars(ticker, frame, spec.days)).filter((b) => {
    const hm = b.t.slice(11, 16);
    return hm >= "04:00" && hm < "20:00";
  });
  return spec.group > 1 ? groupBars(bars, spec.group) : bars;
}

/**
 * Intraday bars for a chart: the history (kept a minute in market hours), then the always-on worker's real-time minute
 * bars from the last 16 minutes (public.live_bars; Alpaca's free history stops 15 minutes back) folded into the
 * timeframe's bars, so the chart runs right up to now.
 */
export async function getIntraday(raw: string, tf: Intraday): Promise<CandleSet> {
  const set = await intradayHistory(raw, tf);
  if (!set.candles.length || !marketOpen(Date.now(), 4 * 60)) return set;
  const recent = await recentMinutes(raw.toUpperCase());
  if (!recent.length) return set;
  const cutoff = nyStampOf(Date.now() - SIP_DELAY_MS);
  const size = TF_MINUTES[tf];
  const out = set.candles.slice();
  for (const m of recent) {
    if (m.t < cutoff) continue;
    const start = barStart(minuteOf(m.t), size);
    if (start == null) continue;
    const t = `${m.t.slice(0, 10)}T${hhmm(start)}`;
    const last = out[out.length - 1];
    if (last.t === t) out[out.length - 1] = { ...last, h: Math.max(last.h, m.h), l: Math.min(last.l, m.l), c: m.c, v: last.v + m.v };
    else if (t > last.t) out.push({ ...m, t });
  }
  return { ...set, candles: out };
}

async function intradayHistory(raw: string, tf: Intraday): Promise<CandleSet> {
  const ticker = raw.toUpperCase();
  let db: ReturnType<typeof supabaseService> | null = null;
  try {
    db = supabaseService();
  } catch {}
  const cacheKey = `bars3:${ticker}:${tf}`;
  const { data: cached } = db ? await db.from("market_cache").select("body, fetched_at").eq("key", cacheKey).maybeSingle() : { data: null };
  // In market hours intraday bars that include today are kept a minute (the live price moves the last candle in
  // between); otherwise like daily candles.
  // Only once the bars include today (a plan that has them): on the free plan they end at the last close, and asking
  // each minute would spend the 5 calls a minute for nothing.
  const lastBar = (cached?.body as Candle[] | undefined)?.at(-1);
  const hasToday = lastBar?.t.slice(0, 10) === newYorkDate(Date.now());
  const current =
    marketOpen(Date.now()) && hasToday ? Date.now() - Date.parse(cached!.fetched_at) < 60_000 : Boolean(cached && fresh(cached.fetched_at));
  if (cached && current && (cached.body as Candle[]).length > 0) {
    return { candles: cached.body as Candle[], source: "massive", stale: false, fetchedAt: cached.fetched_at };
  }
  let candles: Candle[] = [];
  let source: CandleSet["source"] = "none";
  let busy = false;
  if (await alpacaKeys()) {
    try {
      candles = await intradayFromAlpaca(ticker, tf);
      if (candles.length) source = "alpaca";
    } catch (e) {
      busy = e instanceof AlpacaBusy;
      if (!busy) console.error("candles: alpaca intraday failed for", ticker, tf, e instanceof Error ? e.message : e);
    }
  }
  const key = candles.length ? "" : await massiveKey();
  if (key) {
    try {
      candles = await intradayFromMassive(ticker, tf, key);
      source = "massive";
      busy = false;
    } catch (e) {
      busy = busy || e instanceof RateLimited;
      if (!(e instanceof RateLimited)) console.error("candles: massive intraday failed for", ticker, tf, e instanceof Error ? e.message : e);
    }
  }
  if (candles.length > 0) {
    const fetchedAt = new Date().toISOString();
    if (db) await db.from("market_cache").upsert({ key: cacheKey, body: candles, fetched_at: fetchedAt });
    return { candles, source, stale: false, fetchedAt };
  }
  if (cached && (cached.body as Candle[]).length > 0) return { candles: cached.body as Candle[], source: "massive", stale: true, fetchedAt: cached.fetched_at };
  return { candles: [], source: "none", stale: false, fetchedAt: null, busy };
}

// ---- One option contract (Ben, 2026-11-18: "the candle chart should be replaced with a chart of the contract's price")
// Alpaca's free option bars (up to 15 minutes back), the same timeframes as stocks: daily for D/W/M/Y, minutes for the
// intraday ones, 1h and 4h built from 30-minute bars. Contracts trade 9:30 to 4:00 only, so the shaded hours stay empty.
// Kept in public.market_cache a minute in market hours.
export async function getOptionCandles(contract: string, tf: Intraday | null): Promise<CandleSet> {
  if (!occOf(contract)) return { candles: [], source: "none", stale: false, fetchedAt: null };
  let db: ReturnType<typeof supabaseService> | null = null;
  try {
    db = supabaseService();
  } catch {}
  const cacheKey = `obars:${contract}:${tf ?? "D"}`;
  const { data: cached } = db ? await db.from("market_cache").select("body, fetched_at").eq("key", cacheKey).maybeSingle() : { data: null };
  const current = cached && (marketOpen(Date.now()) ? Date.now() - Date.parse(cached.fetched_at) < 60_000 : fresh(cached.fetched_at));
  if (cached && current && (cached.body as Candle[]).length > 0) {
    return { candles: cached.body as Candle[], source: "alpaca", stale: false, fetchedAt: cached.fetched_at };
  }
  let candles: Candle[] = [];
  let busy = false;
  try {
    if (!tf) candles = await optionBars(contract, "1Day", 7305);
    else {
      const spec = INTRADAY[tf];
      const bars = await optionBars(contract, spec.group > 1 ? "30Min" : `${spec.mult}Min`, spec.days);
      candles = spec.group > 1 ? groupBars(bars, spec.group) : bars;
    }
  } catch (e) {
    busy = e instanceof AlpacaBusy;
    if (!busy) console.error("candles: option bars failed for", contract, tf, e instanceof Error ? e.message : e);
  }
  if (candles.length > 0) {
    const fetchedAt = new Date().toISOString();
    if (db) await db.from("market_cache").upsert({ key: cacheKey, body: candles, fetched_at: fetchedAt });
    return { candles, source: "alpaca", stale: false, fetchedAt };
  }
  if (cached && (cached.body as Candle[]).length > 0) return { candles: cached.body as Candle[], source: "alpaca", stale: true, fetchedAt: cached.fetched_at };
  return { candles: [], source: "none", stale: false, fetchedAt: null, busy };
}
