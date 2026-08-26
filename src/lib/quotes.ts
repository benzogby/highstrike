// Shared quote fetching: live via Finnhub when FINNHUB_API_KEY is set,
// deterministic samples otherwise. Server-side only.

export type Quote = {
  symbol: string;
  price: number;
  changePct: number;
  live: boolean;
  high?: number;
  low?: number;
  open?: number;
  prevClose?: number;
};

export function sampleQuote(symbol: string): Quote {
  // Stable pseudo-random sample derived from the ticker so refreshes don't jitter.
  let h = 0;
  for (const c of symbol) h = (h * 31 + c.charCodeAt(0)) % 100000;
  const price = 20 + (h % 780) + (h % 97) / 100;
  const changePct = (((h * 7) % 900) - 400) / 100; // -4.00% .. +5.00%
  const prevClose = price / (1 + changePct / 100);
  const spread = price * (0.004 + ((h % 13) / 1000));
  const gapFrac = (((h * 13) % 200) - 100) / 10000; // -1% .. +1%
  const open = prevClose * (1 + gapFrac);
  return {
    symbol,
    price,
    changePct,
    live: false,
    high: Math.max(price, open) + spread,
    low: Math.min(price, open) - spread,
    open,
    prevClose,
  };
}

export async function fetchQuotes(symbols: string[]): Promise<Quote[]> {
  const token = process.env.FINNHUB_API_KEY;
  if (!token) return symbols.map(sampleQuote);

  return Promise.all(
    symbols.map(async (symbol) => {
      try {
        const res = await fetch(
          `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${token}`,
          { next: { revalidate: 60 } }
        );
        if (!res.ok) throw new Error(String(res.status));
        const q = (await res.json()) as {
          c: number;
          d: number;
          dp: number;
          h: number;
          l: number;
          o: number;
          pc: number;
        };
        if (!q.c) throw new Error("no price");
        return {
          symbol,
          price: q.c,
          changePct: q.dp ?? 0,
          live: true,
          high: q.h || undefined,
          low: q.l || undefined,
          open: q.o || undefined,
          prevClose: q.pc || undefined,
        };
      } catch {
        return sampleQuote(symbol);
      }
    })
  );
}
