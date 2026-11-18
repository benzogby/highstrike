"use client";

import { useEffect, useState } from "react";
import type { ChainView, Side } from "@/lib/paperChain";
import { shortDay, daysTo } from "./fmt";

export type Pick = { contract: string; side: "buy" | "sell"; bid: number | null; ask: number | null };

const money = (n: number | null) => (n == null ? "—" : n.toFixed(2));

/**
 * One expiry's chain: calls left, the strike in the middle, puts right; in-the-money strikes shaded and a line at the
 * price. Tap an ask to buy that contract, a bid to sell it; the ticket fills in.
 */
export default function OptionChain({ ticker, picked, onPick, fill = false }: { ticker: string; picked: string | null; onPick: (p: Pick) => void; fill?: boolean }) {
  const [expiry, setExpiry] = useState<string | null>(null);
  const [chain, setChain] = useState<{ key: string; data: ChainView | null } | null>(null);
  const key = `${ticker}|${expiry ?? ""}`;

  useEffect(() => {
    const ctl = new AbortController();
    fetch(`/api/options/chain?u=${ticker}${expiry ? `&expiry=${expiry}` : ""}`, { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: ChainView | null) => setChain({ key, data }))
      .catch(() => {});
    return () => ctl.abort();
  }, [ticker, expiry, key]);

  const data = chain?.key === key ? chain.data : null;
  const loading = !chain || chain.key !== key;
  const spot = data?.spot ?? null;

  const cell = (s: Side | null, which: "bid" | "ask", shade = "") => {
    const v = s?.[which] ?? null;
    if (!s || v == null) return <td className={`px-2 py-1.5 text-right text-ink-3 ${shade}`}>—</td>;
    const on = picked === s.contract;
    return (
      <td className={`p-0 text-right ${shade}`}>
        <button
          type="button"
          onClick={() => onPick({ contract: s.contract, side: which === "ask" ? "buy" : "sell", bid: s.bid, ask: s.ask })}
          className={`w-full px-2 py-1.5 text-right font-mono-nums transition hover:bg-accent-soft hover:text-accent-ink ${on ? "bg-accent-soft text-accent-ink" : which === "ask" ? "text-ink" : "text-ink-2"}`}
          title={which === "ask" ? "Buy at the ask" : "Sell at the bid"}
        >
          {money(v)}
        </button>
      </td>
    );
  };

  return (
    <section className={fill ? "flex h-full flex-col" : "rounded-xl border border-line bg-panel"}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
        {/* In the desk's dock the tab already names it. */}
        {!fill && (
          <h2 className="text-[13px] font-medium text-ink">
            Option chain <span className="font-mono-nums text-ink-3">{ticker}</span>
          </h2>
        )}
        <span className="text-[11px] text-ink-3">
          {data?.source === "quote" ? "15 min delayed" : data?.source === "est" ? `est. from IV ${data.iv != null ? Math.round(data.iv * 100) : "—"}%` : ""}
        </span>
      </div>
      {data && data.expiries.length > 0 && (
        <div className="flex gap-1 overflow-x-auto border-b border-line px-2 py-1.5">
          {data.expiries.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setExpiry(e)}
              className={`shrink-0 whitespace-nowrap rounded-md px-2 py-1 text-[12px] font-medium transition ${e === data.expiry ? "bg-panel-3 text-ink ring-1 ring-inset ring-line-strong" : "text-ink-3 hover:text-ink"}`}
            >
              {shortDay(e)} <span className="text-ink-3">{daysTo(e)}d</span>
            </button>
          ))}
        </div>
      )}
      {loading ? (
        <div className={`${fill ? "min-h-0 flex-1" : "h-64"} animate-pulse bg-panel-2/40`} />
      ) : !data || data.rows.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-ink-3">No option chain for {ticker} right now.</p>
      ) : (
        <div className={fill ? "min-h-0 flex-1 overflow-auto" : "max-h-[420px] overflow-auto"}>
          <table className="w-full min-w-[460px] text-[12px]">
            <thead className="sticky top-0 bg-panel-2 text-[11px] text-ink-3">
              <tr>
                <th className="px-2 py-1.5 text-right font-medium">Δ</th>
                <th className="px-2 py-1.5 text-right font-medium">Bid</th>
                <th className="px-2 py-1.5 text-right font-medium text-up">Ask · calls</th>
                <th className="px-2 py-1.5 text-center font-medium text-ink">Strike</th>
                <th className="px-2 py-1.5 text-right font-medium">Bid</th>
                <th className="px-2 py-1.5 text-right font-medium text-down">Ask · puts</th>
                <th className="px-2 py-1.5 text-right font-medium">Δ</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r, i) => {
                const callItm = spot != null && r.strike < spot;
                const putItm = spot != null && r.strike > spot;
                const priceLine = spot != null && i > 0 && data.rows[i - 1].strike < spot && r.strike >= spot;
                return (
                  <tr key={r.strike} className={`border-t ${priceLine ? "border-t-2 border-accent" : "border-line/60"}`}>
                    <td className={`px-2 py-1.5 text-right font-mono-nums text-ink-3 ${callItm ? "bg-up/[0.06]" : ""}`}>{r.call?.delta != null ? r.call.delta.toFixed(2) : "—"}</td>
                    {cell(r.call, "bid", callItm ? "bg-up/[0.06]" : "")}
                    {cell(r.call, "ask", callItm ? "bg-up/[0.06]" : "")}
                    <td className="bg-panel-2/60 px-2 py-1.5 text-center font-mono-nums font-medium text-ink">{Number.isInteger(r.strike) ? r.strike : r.strike.toFixed(2)}</td>
                    {cell(r.put, "bid", putItm ? "bg-down/[0.06]" : "")}
                    {cell(r.put, "ask", putItm ? "bg-down/[0.06]" : "")}
                    <td className={`px-2 py-1.5 text-right font-mono-nums text-ink-3 ${putItm ? "bg-down/[0.06]" : ""}`}>{r.put?.delta != null ? r.put.delta.toFixed(2) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="border-t border-line px-3 py-1.5 text-[11px] text-ink-3">Tap an ask to buy, a bid to sell. Shaded: in the money. The green line is the stock price.</p>
    </section>
  );
}
