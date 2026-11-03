"use client";

import Link from "next/link";
import { useState } from "react";
import Sparkline from "@/components/Sparkline";
import { useQuotes } from "@/components/useQuotes";
import { BUTTON_SECONDARY } from "@/components/ui";
import type { Watchlist } from "@/lib/watchlists";

const ROWS = 8;

/**
 * The short version on Home: one list at a time (a tap switches), its first eight symbols with live prices, and the way
 * to everything else on Watchlists, where lists are made and changed.
 */
export default function WatchlistCompact({ lists, names, trends }: { lists: Watchlist[]; names: Record<string, string>; trends: Record<string, number[]> }) {
  const [pick, setPick] = useState<string | null>(null);
  const list = lists.find((l) => l.id === pick) ?? lists[0] ?? null;
  const shown = list?.tickers.slice(0, ROWS) ?? [];
  const more = (list?.tickers.length ?? 0) - shown.length;
  const { quotes, flash, live } = useQuotes(shown);

  return (
    <section id="watchlist" aria-labelledby="watchlist-title" className="mt-8 scroll-mt-24">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="watchlist-title" className="font-display text-[15px] text-ink">
          Watchlist
        </h2>
        <span className="flex items-baseline gap-3">
          {shown.length > 0 && live !== null && <span className="hidden text-xs font-medium text-ink-3 sm:inline">{live ? "Live · every 45 s" : "Sample prices"}</span>}
          <Link href="/watchlists" className="text-[13px] font-medium text-accent hover:underline">
            All watchlists →
          </Link>
        </span>
      </div>
      {lists.length > 1 && (
        <div className="-mx-1 mt-2 flex gap-1 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]">
          {lists.map((l) => (
            <button
              key={l.id}
              type="button"
              aria-pressed={l.id === list?.id}
              onClick={() => setPick(l.id)}
              className={`max-w-48 flex-none truncate rounded-md px-2.5 py-1 text-[13px] font-medium transition ${
                l.id === list?.id ? "bg-accent-soft text-accent-ink ring-1 ring-inset ring-accent/25" : "text-ink-2 hover:bg-panel-2 hover:text-ink"
              }`}
            >
              {l.name}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 overflow-hidden rounded-xl border border-line bg-panel">
        {shown.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-ink-3">{list ? "No symbols on this list yet." : "Keep the stocks you follow in one place, with live prices."}</p>
            <Link href="/watchlists" className={`${BUTTON_SECONDARY} mt-3`}>
              {list ? "Add symbols" : "Make a watchlist"}
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <caption className="sr-only">{list?.name}: last price, today&apos;s move and trend</caption>
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-3">
                <th scope="col" className="px-4 py-2.5 font-medium sm:px-5">
                  Symbol
                </th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">
                  Last
                </th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">
                  Today
                </th>
                <th scope="col" className="hidden px-4 py-2.5 text-right font-medium sm:table-cell sm:px-5">
                  Trend
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {shown.map((t) => {
                const q = quotes[t];
                const up = (q?.changePct ?? 0) >= 0;
                return (
                  <tr key={t}>
                    <td className="w-full max-w-0 px-4 py-2.5 sm:px-5">
                      <div className="flex min-w-0 items-baseline gap-2">
                        <Link href={`/symbol/${t}`} className="font-mono-nums font-semibold text-ink transition hover:text-accent">
                          {t}
                        </Link>
                        <span className="hidden min-w-0 truncate text-xs text-ink-3 sm:block">{names[t]}</span>
                      </div>
                    </td>
                    <td className={`whitespace-nowrap px-3 py-2.5 text-right font-mono-nums text-ink-2 ${flash[t] === "up" ? "flash-up" : flash[t] === "down" ? "flash-down" : ""}`}>
                      {q ? q.price.toFixed(2) : "—"}
                    </td>
                    <td className={`whitespace-nowrap px-3 py-2.5 text-right font-mono-nums ${q ? (up ? "text-up" : "text-down") : "text-ink-3"}`}>
                      {q ? `${up ? "▲" : "▼"} ${Math.abs(q.changePct).toFixed(2)}%` : "—"}
                    </td>
                    <td className="hidden px-4 py-2.5 text-right sm:table-cell sm:px-5">
                      <Sparkline values={trends[t]} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {more > 0 && (
          <Link href="/watchlists" className="block border-t border-line px-5 py-2.5 text-center text-[13px] text-ink-2 transition hover:bg-panel-2 hover:text-ink">
            {more} more on {list?.name}
          </Link>
        )}
      </div>
    </section>
  );
}
