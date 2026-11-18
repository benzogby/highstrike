import { NextResponse } from "next/server";
import { viewer } from "@/lib/membership";
import { marketOpen } from "@/lib/marketCalendar";

export const dynamic = "force-dynamic";

// /api/live?symbol=AAPL — the live price for HighStrike Chart's moving candles (Ben, 2026-11-18: "get real time data, as
// close as you can get, with a live moving chart candles reacting to prices"), members only. Finnhub's quote: the last
// trade, the day's open, high and low, the previous close. One answer per symbol is shared for 2 seconds by everyone
// this server is answering, so the free plan's 60 calls a minute go a long way; the chart asks every 3 seconds.

type Live = { symbol: string; price: number; open: number | null; high: number | null; low: number | null; prevClose: number | null; at: number; marketOpen: boolean };

const memo = new Map<string, { at: number; value: Promise<Live | null> }>();
const SHARE_MS = 2000;

async function fetchLive(symbol: string): Promise<Live | null> {
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

export async function GET(request: Request) {
  const symbol = (new URL(request.url).searchParams.get("symbol") ?? "").trim().toUpperCase();
  if (!/^[A-Z][A-Z.]{0,7}$/.test(symbol)) return NextResponse.json({ error: "Invalid symbol" }, { status: 400 });
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
  return NextResponse.json(live ?? { symbol, price: null, marketOpen: marketOpen(Date.now()) }, { headers: { "Cache-Control": "no-store" } });
}
