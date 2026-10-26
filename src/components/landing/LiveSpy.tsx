"use client";

import { useEffect, useState } from "react";

// The S&P 500 price in the homepage's briefing card: starts from the last
// recorded close and switches to the live quote from /api/market when Finnhub
// is configured. /api/market's fallback prices are samples, so they're never
// shown here.
export default function LiveSpy({ close, prevClose }: { close: number; prevClose: number }) {
  const [quote, setQuote] = useState({ price: close, changePct: ((close - prevClose) / prevClose) * 100 });

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/market");
        const data = (await res.json()) as { live: boolean; quotes: { symbol: string; price: number; changePct: number }[] };
        const spy = data.live ? data.quotes.find((q) => q.symbol === "SPY") : undefined;
        if (alive && spy) setQuote({ price: spy.price, changePct: spy.changePct });
      } catch {
        // keep the last close
      }
    };
    load();
    const id = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const up = quote.changePct >= 0;
  return (
    <span className="text-[13px] tabular-nums">
      <span className="text-lx-ink">{quote.price.toFixed(2)}</span>{" "}
      <span className={up ? "text-lx-up" : "text-lx-down"}>
        {up ? "+" : "−"}
        {Math.abs(quote.changePct).toFixed(2)}%
      </span>
    </span>
  );
}
