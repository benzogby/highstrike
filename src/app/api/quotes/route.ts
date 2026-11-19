import { NextResponse, after } from "next/server";
import { checkAlerts } from "@/lib/alerts";

export const dynamic = "force-dynamic";

// Batch quotes: /api/quotes?symbols=AAPL,NVDA — live via Finnhub when
// FINNHUB_API_KEY is set (per-symbol 60s fetch cache), deterministic sample
// data otherwise so the UI stays functional in every environment.

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

  const token = process.env.FINNHUB_API_KEY;
  if (!token) {
    return NextResponse.json({ live: false, quotes: symbols.map(sampleQuote) });
  }

  const quotes = await Promise.all(
    symbols.map(async (symbol) => {
      try {
        const res = await fetch(
          `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${token}`,
          { next: { revalidate: 60 } }
        );
        if (!res.ok) throw new Error(String(res.status));
        const q = (await res.json()) as { c: number; d: number; dp: number };
        if (!q.c) throw new Error("no price");
        return { symbol, price: q.c, changePct: q.dp ?? 0, live: true };
      } catch {
        return sampleQuote(symbol);
      }
    })
  );

  return NextResponse.json({ live: quotes.some((q) => q.live), quotes });
}
