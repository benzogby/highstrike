import { NextResponse } from "next/server";
import { viewer } from "@/lib/membership";
import { supabaseService } from "@/lib/stripe";
import { isSession, marketOpen, newYorkDate } from "@/lib/marketCalendar";
import { alpacaKeys, latestTrades, nyStamp, occOf, optionLive, recentDailyBars, type DayBar } from "@/lib/alpaca";

export const dynamic = "force-dynamic";

// /api/live?symbol=AAPL — the live price for HighStrike Chart's moving candles (Ben, 2026-11-18: "get real time data,
// as close as you can get, with a live moving chart candles reacting to prices"), members only.
// With Alpaca's keys (src/lib/alpaca.ts): the real-time last trade (IEX, which trades 8:00 AM to 5:00 PM New York time,
// so candles move pre-market and after-hours too), the day's open, high and low from today's whole-market bar (up to
// 15 minutes back, stretched by the live price) and the previous close; about 200 requests a minute. Without them,
// Finnhub's quote (60 a minute, regular hours). The last trade comes from the always-on worker's stream when it has one
// (public.live_quotes). One answer per symbol is shared for about a second; the chart asks every second.

type Live = { symbol: string; price: number; open: number | null; high: number | null; low: number | null; prevClose: number | null; at: number; marketOpen: boolean };

const memo = new Map<string, { at: number; value: Promise<Live | null> }>();
const dayMemo = new Map<string, { at: number; value: Promise<DayBar[] | null> }>();
const SHARE_MS = 900;

/** Whether prices are moving: a session day between 8:00 AM and 5:00 PM New York time (IEX's hours). */
function moving(now = Date.now()) {
  const day = newYorkDate(now);
  const hm = nyStamp(now).slice(11, 16);
  return isSession(day) && hm >= "08:00" && hm < "17:00";
}

// Without a streamed trade, Alpaca's latest is asked at most every 3 seconds per stock (its free plan allows about 200
// requests a minute in all).
const tradeMemo = new Map<string, { at: number; value: Promise<{ price: number; at: string } | null> }>();
function alpacaTrade(symbol: string, keys: { id: string; secret: string }) {
  const hit = tradeMemo.get(symbol);
  if (hit && Date.now() - hit.at < 3000) return hit.value;
  const value = latestTrades([symbol], keys)
    .then((m) => m.get(symbol) ?? null)
    .catch(() => null);
  tradeMemo.set(symbol, { at: Date.now(), value });
  if (tradeMemo.size > 500) tradeMemo.delete(tradeMemo.keys().next().value as string);
  return value;
}

// Tell the worker this stock is on someone's chart (public.live_watch), at most every 20 seconds per stock.
const stamped = new Map<string, number>();
function stampWatch(symbol: string) {
  if (Date.now() - (stamped.get(symbol) ?? 0) < 20_000) return;
  stamped.set(symbol, Date.now());
  if (stamped.size > 1000) stamped.delete(stamped.keys().next().value as string);
  void Promise.resolve(supabaseService().from("live_watch").upsert({ ticker: symbol, seen_at: new Date().toISOString() })).catch(() => {});
}

/** The always-on worker's latest trade for a stock, when it's from the last 20 seconds. */
async function streamedTrade(symbol: string): Promise<{ price: number; at: string } | null> {
  try {
    const { data } = await supabaseService().from("live_quotes").select("price, at").eq("ticker", symbol).maybeSingle();
    if (!data || Date.now() - Date.parse(data.at as string) > 20_000) return null;
    return { price: Number(data.price), at: data.at as string };
  } catch {
    return null;
  }
}

async function fromAlpaca(symbol: string): Promise<Live | null> {
  const keys = await alpacaKeys();
  if (!keys) return null;
  const hit = dayMemo.get(symbol);
  let days: Promise<DayBar[] | null>;
  if (hit && Date.now() - hit.at < 60_000) days = hit.value;
  else {
    days = recentDailyBars([symbol], keys)
      .then((m) => m.get(symbol) ?? null)
      .catch(() => null);
    dayMemo.set(symbol, { at: Date.now(), value: days });
  }
  stampWatch(symbol);
  // The worker's latest trade (public.live_quotes, about a second old), else Alpaca's.
  const [streamed, bars] = await Promise.all([streamedTrade(symbol), days]);
  const t = streamed ?? (await alpacaTrade(symbol, keys));
  if (!t) return null;
  const today = newYorkDate(Date.now());
  const last = bars?.at(-1) ?? null;
  const todays = last && last.date === today ? last : null;
  const prev = todays ? (bars?.at(-2) ?? null) : last;
  return {
    symbol,
    price: t.price,
    open: todays?.o ?? null,
    high: todays ? Math.max(todays.h, t.price) : null,
    low: todays ? Math.min(todays.l, t.price) : null,
    prevClose: prev?.c ?? null,
    at: Date.parse(t.at) || Date.now(),
    marketOpen: moving(),
  };
}

async function fromFinnhub(symbol: string): Promise<Live | null> {
  const token = process.env.FINNHUB_API_KEY;
  if (!token) return null;
  try {
    const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${token}`, { cache: "no-store", signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const q = (await res.json()) as { c?: number; o?: number; h?: number; l?: number; pc?: number; t?: number };
    if (!q.c || q.c <= 0) return null;
    return { symbol, price: q.c, open: q.o || null, high: q.h || null, low: q.l || null, prevClose: q.pc || null, at: q.t ? q.t * 1000 : Date.now(), marketOpen: marketOpen(Date.now()) };
  } catch {
    return null;
  }
}

/** One option contract's live price (its indicative mark), which moves in regular hours only. */
async function fromOption(symbol: string): Promise<Live | null> {
  const l = await optionLive(symbol).catch(() => null);
  return l ? { symbol, ...l, at: Date.now(), marketOpen: marketOpen(Date.now()) } : null;
}

const fetchLive = async (symbol: string) =>
  occOf(symbol) ? await fromOption(symbol) : ((await fromAlpaca(symbol).catch(() => null)) ?? (await fromFinnhub(symbol)));

export async function GET(request: Request) {
  const symbol = (new URL(request.url).searchParams.get("symbol") ?? "").trim().toUpperCase();
  // A stock, or one option contract ("O:AAPL261218C00350000") when the desk charts it.
  if (!/^[A-Z][A-Z.]{0,7}$/.test(symbol) && !occOf(symbol)) return NextResponse.json({ error: "Invalid symbol" }, { status: 400 });
  const v = await viewer();
  if (!v?.member) return NextResponse.json({ error: "Members only" }, { status: 401 });
  const hit = memo.get(symbol);
  let value: Promise<Live | null>;
  if (hit && Date.now() - hit.at < SHARE_MS) value = hit.value;
  else {
    value = fetchLive(symbol);
    memo.set(symbol, { at: Date.now(), value });
    if (memo.size > 500) memo.delete(memo.keys().next().value as string);
  }
  const live = await value;
  return NextResponse.json(live ?? { symbol, price: null, marketOpen: moving() }, { headers: { "Cache-Control": "no-store" } });
}
