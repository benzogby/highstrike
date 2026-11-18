import { supabaseService } from "@/lib/stripe";
import { fetchQuotes } from "@/lib/quotes";
import { isSession, marketOpen, newYorkDate } from "@/lib/marketCalendar";
import type { Candle } from "@/lib/chart/types";

// Daily candles for HighStrike Chart (Ben, 2026-11-17: "our own custom charts, with our UI, and deep markup ability";
// data from a Massive/Polygon account, docs/plans/offer-overhaul.md). Two years of daily bars per ticker, cached in
// public.candle_cache so the free plan's 5 calls a minute serve every member: a ticker is fetched again only when its
// copy is older than 20 minutes while the market's open, or older than the last close otherwise. Today's bar is
// patched from the live quote (Finnhub), since the free plan is end of day. Sources, in order: Massive (the key in
// MASSIVE_API_KEY / POLYGON_API_KEY or public.app_secrets), then whatever is cached however old. Never made-up prices:
// no data is shown as no data.

const FRESH_OPEN_MS = 20 * 60_000;

export type CandleSet = { candles: Candle[]; source: "massive" | "none"; stale: boolean; fetchedAt: string | null };

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
      if (!res.ok) throw new Error(`${host} ${res.status}`);
      const json = (await res.json()) as { results?: { t: number; o: number; h: number; l: number; c: number; v: number }[] };
      // Bars are stamped at midnight New York time, which is the previous day in UTC: +12h lands on the right date.
      return (json.results ?? []).map((r) => ({ t: day(r.t + 12 * 3_600_000), o: r.o, h: r.h, l: r.l, c: r.c, v: r.v ?? 0 }));
    } catch (e) {
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
  const key = await massiveKey();
  if (key) {
    try {
      candles = await fromMassive(ticker, key);
      source = "massive";
    } catch (e) {
      console.error("candles: massive failed for", ticker, e instanceof Error ? e.message : e);
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
  return { candles: [], source: "none", stale: false, fetchedAt: null };
}

// ---- Intraday (Ben, 2026-11-18: "More timeframes. Down to 1m") -------------------------------------------------------
// Minute bars from Massive, regular hours only (9:30 to 4:00 New York time), stamped with their New York wall time
// ("2026-11-17T09:30"). 1h and 4h bars are built from 30-minute ones, counted from the open (so a day has 7 hourly
// bars, the last half an hour, and two 4-hour bars). The free plan has bars up to the last close; with Stocks Starter
// today's come too, 15 minutes delayed. Kept in public.market_cache for everyone, as fresh as daily candles.

// One Massive request covers about 52 sessions of minutes (50,000 of them, extended hours included), so the longer
// timeframes follow its next-page links: `pages` at most (each one a call; the cache shares the result).
export const INTRADAY = {
  "1m": { mult: 1, span: "minute", days: 7, group: 1, pages: 1 },
  "5m": { mult: 5, span: "minute", days: 28, group: 1, pages: 1 },
  "15m": { mult: 15, span: "minute", days: 60, group: 1, pages: 1 },
  "30m": { mult: 30, span: "minute", days: 72, group: 1, pages: 1 },
  "1h": { mult: 30, span: "minute", days: 150, group: 2, pages: 2 },
  "4h": { mult: 30, span: "minute", days: 365, group: 8, pages: 5 },
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
          throw new Error(`${host} ${res.status}`);
        }
        const json = (await res.json()) as { results?: { t: number; o: number; h: number; l: number; c: number; v: number }[]; next_url?: string };
        for (const r of json.results ?? []) {
          const t = nyStamp(r.t);
          const hm = t.slice(11);
          if (hm < "09:30" || hm >= "16:00") continue;
          bars.push({ t, o: r.o, h: r.h, l: r.l, c: r.c, v: r.v ?? 0 });
        }
        url = json.next_url ?? null;
      }
      bars.sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : 0));
      return spec.group > 1 ? groupBars(bars, spec.group) : bars;
    } catch (e) {
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
    const mins = Number(b.t.slice(11, 13)) * 60 + Number(b.t.slice(14, 16)) - 570;
    const k = `${b.t.slice(0, 10)}:${Math.floor(mins / (30 * n))}`;
    const last = out[out.length - 1];
    if (k !== key || !last) {
      out.push({ ...b });
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

export async function getIntraday(raw: string, tf: Intraday): Promise<CandleSet> {
  const ticker = raw.toUpperCase();
  let db: ReturnType<typeof supabaseService> | null = null;
  try {
    db = supabaseService();
  } catch {}
  const cacheKey = `bars:${ticker}:${tf}`;
  const { data: cached } = db ? await db.from("market_cache").select("body, fetched_at").eq("key", cacheKey).maybeSingle() : { data: null };
  // In market hours intraday bars are kept a minute (a plan with today's bars keeps the chart current; the live price
  // moves the last candle in between); otherwise like daily candles.
  const current = marketOpen(Date.now()) ? Date.now() - Date.parse(cached?.fetched_at ?? "1970-01-01") < 60_000 : Boolean(cached && fresh(cached.fetched_at));
  if (cached && current && (cached.body as Candle[]).length > 0) {
    return { candles: cached.body as Candle[], source: "massive", stale: false, fetchedAt: cached.fetched_at };
  }
  const key = await massiveKey();
  let candles: Candle[] = [];
  if (key) {
    try {
      candles = await intradayFromMassive(ticker, tf, key);
    } catch (e) {
      console.error("candles: massive intraday failed for", ticker, tf, e instanceof Error ? e.message : e);
    }
  }
  if (candles.length > 0) {
    const fetchedAt = new Date().toISOString();
    if (db) await db.from("market_cache").upsert({ key: cacheKey, body: candles, fetched_at: fetchedAt });
    return { candles, source: "massive", stale: false, fetchedAt };
  }
  if (cached && (cached.body as Candle[]).length > 0) return { candles: cached.body as Candle[], source: "massive", stale: true, fetchedAt: cached.fetched_at };
  return { candles: [], source: "none", stale: false, fetchedAt: null };
}
