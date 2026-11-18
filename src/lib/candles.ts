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
