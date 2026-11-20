import { NextResponse, after } from "next/server";
import { checkAlerts } from "@/lib/alerts";
import { throttle } from "@/lib/security";
import { livePrices, type LivePrice } from "@/lib/livePrices";

export const dynamic = "force-dynamic";

// Batch quotes: /api/quotes?symbols=AAPL,NVDA — real-time prices from lib/livePrices (the worker's stream or Alpaca's
// last trade, one request for all of them, shared 2 seconds; Finnhub without Alpaca's keys). Pages ask every 5 seconds
// (Ben, 2026-11-20: "all other data needs to update in real time"). Deterministic sample data when there's no feed at
// all, so the UI stays functional in every environment.

const MAX_SYMBOLS = 60;

function sampleQuote(symbol: string) {
  // Stable pseudo-random sample derived from the ticker so refreshes don't jitter.
  let h = 0;
  for (const c of symbol) h = (h * 31 + c.charCodeAt(0)) % 100000;
  const price = 20 + (h % 780) + (h % 97) / 100;
  const changePct = (((h * 7) % 900) - 400) / 100; // -4.00% .. +5.00%
  return { symbol, price, changePct, live: false };
}

export async function GET(request: Request) {
  const limited = await throttle(request, "quotes", { max: 300, windowSec: 60 }, true);
  if (limited) return limited;
  // Piggyback a throttled alert sweep on member traffic (runs after the
  // response is sent; internally rate-limited to one sweep per ~2 minutes).
  after(() => checkAlerts({ throttled: true }).catch(() => {}));

  const url = new URL(request.url);
  const raw = url.searchParams.get("symbols") ?? "";
  const symbols = [
    ...new Set(
      raw
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter((s) => /^[A-Z.^-]{1,10}$/.test(s))
    ),
  ].slice(0, MAX_SYMBOLS);

  if (symbols.length === 0) {
    return NextResponse.json({ quotes: [] });
  }

  const prices = await livePrices(symbols).catch(() => new Map<string, LivePrice>());
  const quotes = symbols.map((symbol) => {
    const p = prices.get(symbol);
    if (!p) return sampleQuote(symbol);
    const changePct = p.prevClose ? Math.round(((p.price - p.prevClose) / p.prevClose) * 10_000) / 100 : 0;
    return { symbol, price: p.price, changePct, live: true };
  });

  return NextResponse.json({ live: quotes.some((q) => q.live), quotes }, { headers: { "Cache-Control": "no-store" } });
}
