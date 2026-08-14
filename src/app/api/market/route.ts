import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SYMBOLS = ["SPY", "QQQ", "AAPL", "NVDA", "MSFT", "TSLA", "AMZN", "META"];

const FALLBACK = [
  { symbol: "SPY", price: 642.18, changePct: 0.42 },
  { symbol: "QQQ", price: 571.33, changePct: 0.67 },
  { symbol: "AAPL", price: 233.41, changePct: -0.21 },
  { symbol: "NVDA", price: 182.9, changePct: 1.84 },
  { symbol: "MSFT", price: 522.75, changePct: 0.31 },
  { symbol: "TSLA", price: 338.12, changePct: -1.12 },
  { symbol: "AMZN", price: 231.5, changePct: 0.55 },
  { symbol: "META", price: 778.04, changePct: 0.9 },
];

export async function GET() {
  const token = process.env.FINNHUB_API_KEY;
  if (!token) {
    return NextResponse.json({ live: false, quotes: FALLBACK });
  }

  try {
    const quotes = await Promise.all(
      SYMBOLS.map(async (symbol) => {
        const res = await fetch(
          `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${token}`,
          { next: { revalidate: 60 } }
        );
        if (!res.ok) throw new Error(`quote ${symbol}: ${res.status}`);
        const q = (await res.json()) as { c: number; dp: number };
        return { symbol, price: q.c, changePct: q.dp ?? 0 };
      })
    );
    const valid = quotes.filter((q) => q.price > 0);
    if (valid.length === 0) throw new Error("no valid quotes");
    return NextResponse.json({ live: true, quotes: valid });
  } catch {
    return NextResponse.json({ live: false, quotes: FALLBACK });
  }
}
