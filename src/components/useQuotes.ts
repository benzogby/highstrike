"use client";

import { useEffect, useRef, useState } from "react";

export type LiveQuote = { symbol: string; price: number; changePct: number; live: boolean };

type Quotes = {
  quotes: Record<string, LiveQuote>;
  /** Tickers whose price moved since the last look, for a moment, to flash their cell. */
  flash: Record<string, "up" | "down">;
  /** Whether the prices are live (Finnhub) or samples; null before the first answer. */
  live: boolean | null;
};

const EVERY_MS = 45_000;
const FLASH_MS = 950;
const PER_CALL = 60; // /api/quotes answers 60 tickers at most

/**
 * Prices for the tickers on screen, from /api/quotes, again every 45 s while the tab is in view and at once when it
 * comes back. Each call also lets the server run its throttled price-alert sweep (the route does that after answering),
 * which is how alerts fire within minutes while members are around.
 */
export function useQuotes(tickers: string[]): Quotes {
  const key = [...new Set(tickers)].sort().join(",");
  const [state, setState] = useState<Quotes>({ quotes: {}, flash: {}, live: null });
  const last = useRef<Record<string, LiveQuote>>({});

  useEffect(() => {
    if (!key) return;
    const symbols = key.split(",");
    let alive = true;
    let unflash: ReturnType<typeof setTimeout> | undefined;

    async function refresh() {
      if (document.visibilityState === "hidden") return;
      const calls: string[][] = [];
      for (let i = 0; i < symbols.length; i += PER_CALL) calls.push(symbols.slice(i, i + PER_CALL));
      const answers = await Promise.all(
        calls.map((c) =>
          fetch(`/api/quotes?symbols=${c.join(",")}`)
            .then((r) => (r.ok ? (r.json() as Promise<{ quotes?: LiveQuote[] }>) : null))
            .catch(() => null)
        )
      );
      if (!alive) return;
      const got = answers.flatMap((a) => a?.quotes ?? []);
      if (got.length === 0) return; // keep the last prices
      const flash: Quotes["flash"] = {};
      for (const q of got) {
        const before = last.current[q.symbol]?.price;
        if (before != null && q.price !== before) flash[q.symbol] = q.price > before ? "up" : "down";
      }
      last.current = { ...last.current, ...Object.fromEntries(got.map((q) => [q.symbol, q])) };
      setState({ quotes: last.current, flash, live: got.some((q) => q.live) });
      if (Object.keys(flash).length > 0) {
        clearTimeout(unflash);
        unflash = setTimeout(() => alive && setState((s) => ({ ...s, flash: {} })), FLASH_MS);
      }
    }

    void refresh();
    const timer = setInterval(refresh, EVERY_MS);
    const onShow = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onShow);
    return () => {
      alive = false;
      clearInterval(timer);
      clearTimeout(unflash);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, [key]);

  return state;
}
