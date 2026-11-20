import "server-only";
import { alpacaKeys, latestTrades, occOf, recentDailyBars, type DayBar } from "@/lib/alpaca";
import { marketOpen, newYorkDate } from "@/lib/marketCalendar";
import { supabaseService } from "@/lib/stripe";

/**
 * Live prices for many stocks at once (Ben, 2026-11-20: "Open positions mark and all other data needs to update in real
 * time"): the always-on worker's streamed trade when it's from the last 20 seconds (public.live_quotes), else Alpaca's
 * real-time last trade (IEX), all missing tickers in one request; the previous close from the whole-market daily bars.
 * Each price is shared for 2 seconds per server, so many members and tabs asking every few seconds cost one request.
 * Without Alpaca's keys, Finnhub's quote per ticker (60 a minute), shared for 5 seconds.
 */

export type LivePrice = { price: number; prevClose: number | null; at: number };

const SHARE_MS = 2_000;
const CLOSE_MS = 10 * 60_000;

const priceMemo = new Map<string, { at: number; value: { price: number; at: number } | null }>();
const closeMemo = new Map<string, { at: number; value: number | null }>();
const watched = new Map<string, number>();

function trim<K, V>(m: Map<K, V>, max = 2000) {
  while (m.size > max) m.delete(m.keys().next().value as K);
}

/** The previous session's close from a stock's last two daily bars (today's may be the last). */
function prevCloseOf(bars: DayBar[] | undefined): number | null {
  if (!bars?.length) return null;
  const last = bars.at(-1)!;
  return last.date === newYorkDate(Date.now()) ? (bars.at(-2)?.c ?? null) : last.c;
}

/** Ask the worker to stream these tickers (public.live_watch), at most every 20 seconds per ticker. */
function stampWatch(symbols: string[]) {
  const now = Date.now();
  const due = symbols.filter((s) => now - (watched.get(s) ?? 0) > 20_000);
  if (!due.length) return;
  for (const s of due) watched.set(s, now);
  trim(watched);
  const seen = new Date().toISOString();
  void Promise.resolve(supabaseService().from("live_watch").upsert(due.map((ticker) => ({ ticker, seen_at: seen })))).catch(() => {});
}

async function streamed(symbols: string[]): Promise<Map<string, { price: number; at: number }>> {
  const out = new Map<string, { price: number; at: number }>();
  try {
    const { data } = await supabaseService().from("live_quotes").select("ticker, price, at").in("ticker", symbols);
    for (const r of data ?? []) {
      const at = Date.parse(r.at as string);
      if (Date.now() - at < 20_000 && Number(r.price) > 0) out.set(r.ticker as string, { price: Number(r.price), at });
    }
  } catch {
    /* the trade below answers */
  }
  return out;
}

async function finnhub(symbol: string): Promise<LivePrice | null> {
  const token = process.env.FINNHUB_API_KEY;
  if (!token) return null;
  try {
    const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${token}`, { cache: "no-store", signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const q = (await res.json()) as { c?: number; pc?: number; t?: number };
    return q.c && q.c > 0 ? { price: q.c, prevClose: q.pc || null, at: q.t ? q.t * 1000 : Date.now() } : null;
  } catch {
    return null;
  }
}
const finnhubMemo = new Map<string, { at: number; value: Promise<LivePrice | null> }>();
function finnhubShared(symbol: string) {
  const hit = finnhubMemo.get(symbol);
  if (hit && Date.now() - hit.at < 5_000) return hit.value;
  const value = finnhub(symbol);
  finnhubMemo.set(symbol, { at: Date.now(), value });
  trim(finnhubMemo);
  return value;
}

/** Live prices for these stock tickers (option contracts are skipped). Tickers with no price are left out. */
export async function livePrices(tickers: string[]): Promise<Map<string, LivePrice>> {
  const symbols = [...new Set(tickers.map((t) => t.trim().toUpperCase()))].filter((s) => s && !occOf(s));
  const out = new Map<string, LivePrice>();
  if (!symbols.length) return out;
  const keys = await alpacaKeys();
  if (!keys) {
    const got = await Promise.all(symbols.map(async (s) => [s, await finnhubShared(s)] as const));
    for (const [s, p] of got) if (p) out.set(s, p);
    return out;
  }
  stampWatch(symbols);
  const now = Date.now();

  // Prices: the shared copy, else the worker's stream, else one batched last-trade request.
  const need = symbols.filter((s) => !(now - (priceMemo.get(s)?.at ?? 0) < SHARE_MS));
  if (need.length) {
    const fromStream = await streamed(need);
    const rest = need.filter((s) => !fromStream.has(s));
    const trades = rest.length ? await latestTrades(rest, keys).catch(() => new Map()) : new Map();
    for (const s of need) {
      const t = fromStream.get(s) ?? (trades.get(s) ? { price: trades.get(s)!.price, at: Date.parse(trades.get(s)!.at) || now } : null);
      // A failed ask keeps the last price rather than blanking it.
      priceMemo.set(s, { at: now, value: t ?? priceMemo.get(s)?.value ?? null });
    }
    trim(priceMemo);
  }

  // Previous closes: kept 10 minutes.
  const noClose = symbols.filter((s) => !(now - (closeMemo.get(s)?.at ?? 0) < CLOSE_MS));
  if (noClose.length) {
    const bars = await recentDailyBars(noClose, keys).catch(() => null);
    if (bars) for (const s of noClose) closeMemo.set(s, { at: now, value: prevCloseOf(bars.get(s)) });
    trim(closeMemo);
  }

  for (const s of symbols) {
    const p = priceMemo.get(s)?.value;
    if (p) out.set(s, { price: p.price, at: p.at, prevClose: closeMemo.get(s)?.value ?? null });
  }
  // Anything Alpaca had nothing fresh for (IEX carries a small share of trades, so a quiet stock's last IEX trade can be
  // minutes old in market hours) falls back to Finnhub's whole-market quote.
  const open = marketOpen(now);
  const missing = symbols.filter((s) => !out.has(s) || (open && now - out.get(s)!.at > 120_000));
  if (missing.length && process.env.FINNHUB_API_KEY) {
    const got = await Promise.all(missing.slice(0, 20).map(async (s) => [s, await finnhubShared(s)] as const));
    for (const [s, p] of got) if (p) out.set(s, { ...p, prevClose: out.get(s)?.prevClose ?? p.prevClose });
  }
  return out;
}
