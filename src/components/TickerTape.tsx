"use client";

import { useEffect, useState } from "react";

type Quote = {
  symbol: string;
  price: number;
  changePct: number;
};

const FALLBACK: Quote[] = [
  { symbol: "SPY", price: 642.18, changePct: 0.42 },
  { symbol: "QQQ", price: 571.33, changePct: 0.67 },
  { symbol: "AAPL", price: 233.41, changePct: -0.21 },
  { symbol: "NVDA", price: 182.9, changePct: 1.84 },
  { symbol: "MSFT", price: 522.75, changePct: 0.31 },
  { symbol: "TSLA", price: 338.12, changePct: -1.12 },
  { symbol: "AMZN", price: 231.5, changePct: 0.55 },
  { symbol: "META", price: 778.04, changePct: 0.9 },
];

function Row({ q }: { q: Quote }) {
  const up = q.changePct >= 0;
  return (
    <span className="flex items-center gap-2 px-6">
      <span className="font-display text-xs font-semibold tracking-wide text-ink">
        {q.symbol}
      </span>
      <span className="font-mono-nums text-xs text-ink-2">{q.price.toFixed(2)}</span>
      <span
        className={`font-mono-nums text-xs ${up ? "text-up" : "text-down"}`}
      >
        {up ? "▲" : "▼"} {Math.abs(q.changePct).toFixed(2)}%
      </span>
    </span>
  );
}

export default function TickerTape() {
  const [quotes, setQuotes] = useState<Quote[]>(FALLBACK);
  const [live, setLive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/market")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.quotes?.length) {
          setQuotes(data.quotes);
          setLive(Boolean(data.live));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const doubled = [...quotes, ...quotes];

  return (
    <div
      className="relative overflow-hidden border-y border-line bg-panel/60"
      aria-label={live ? "Live market quotes" : "Sample market quotes"}
    >
      <div className="ticker-track flex w-max py-2.5">
        {doubled.map((q, i) => (
          <Row key={`${q.symbol}-${i}`} q={q} />
        ))}
      </div>
      {!live && (
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded bg-bg/80 px-2 py-0.5 text-[10px] uppercase tracking-wider text-ink-3">
          sample
        </span>
      )}
    </div>
  );
}
