"use client";

import { useState, useTransition } from "react";
import type { PaperState } from "@/lib/paper";
import { toastError, toastSuccess } from "@/lib/toastBus";
import { cancelPaperOrder, sendOrder } from "../paperActions";
import { daysTo, parseContract, pct, signed, symbolLabel, tone, usd } from "./fmt";

const TABS = ["Positions", "Working", "History"] as const;

/** Positions (marked to the market, with Close), working orders (with Cancel) and the order history. */
export default function Blotter({ state, onSelect, onChange }: { state: PaperState; onSelect: (symbol: string) => void; onChange: () => void }) {
  const working = state.orders.filter((o) => o.status === "working");
  const [tab, setTab] = useState<(typeof TABS)[number]>("Positions");
  const [pending, start] = useTransition();

  const close = (symbol: string, qty: number) =>
    start(async () => {
      const r = await sendOrder({ symbol, side: "sell", qty, type: "market" });
      if ("error" in r) toastError(r.error);
      else toastSuccess(r.status === "filled" ? `Closed ${symbolLabel(symbol)}` : (r.note ?? "Close order working"));
      onChange();
    });
  const cancel = (id: string) =>
    start(async () => {
      const r = await cancelPaperOrder(id);
      if ("error" in r && r.error) toastError(r.error);
      onChange();
    });

  const th = "px-3 py-2 text-right font-medium";
  return (
    <section className="rounded-xl border border-line bg-panel">
      <div className="flex items-center gap-1 border-b border-line px-2 py-1.5">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-md px-3 py-1 text-[13px] font-medium transition ${tab === t ? "bg-panel-3 text-ink ring-1 ring-inset ring-line-strong" : "text-ink-3 hover:text-ink"}`}
          >
            {t}
            {t === "Positions" && state.positions.length > 0 && <span className="ml-1.5 text-ink-3">{state.positions.length}</span>}
            {t === "Working" && working.length > 0 && <span className="ml-1.5 text-warn">{working.length}</span>}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto">
        {tab === "Positions" &&
          (state.positions.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-ink-3">No positions yet. Pick a stock or a contract and use the ticket.</p>
          ) : (
            <table className="w-full min-w-[720px] text-[13px]">
              <thead className="text-[11px] text-ink-3">
                <tr className="border-b border-line">
                  <th className="px-3 py-2 text-left font-medium">Symbol</th>
                  <th className={th}>Qty</th>
                  <th className={th}>Avg</th>
                  <th className={th}>Mark</th>
                  <th className={th}>Value</th>
                  <th className={th}>P&amp;L</th>
                  <th className={th}>P&amp;L %</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {state.positions.map((p) => {
                  const c = parseContract(p.symbol);
                  return (
                    <tr key={p.symbol} className="hover:bg-panel-2">
                      <td className="px-3 py-2">
                        <button type="button" onClick={() => onSelect(p.symbol)} className="text-left font-mono-nums text-ink hover:text-accent">
                          {symbolLabel(p.symbol)}
                        </button>
                        {c && <span className="ml-2 text-[11px] text-ink-3">{daysTo(c.expiry)}d left</span>}
                      </td>
                      <td className="px-3 py-2 text-right font-mono-nums text-ink">{p.qty}</td>
                      <td className="px-3 py-2 text-right font-mono-nums text-ink-2">{usd(p.avg)}</td>
                      <td className="px-3 py-2 text-right font-mono-nums text-ink">
                        {usd(p.mark)}
                        {p.markSource === "est" && <span className="ml-1 text-[10px] text-ink-3">est.</span>}
                      </td>
                      <td className="px-3 py-2 text-right font-mono-nums text-ink-2">{usd(p.value)}</td>
                      <td className={`px-3 py-2 text-right font-mono-nums ${tone(p.pnl)}`}>{signed(p.pnl)}</td>
                      <td className={`px-3 py-2 text-right font-mono-nums ${tone(p.pnlPct)}`}>{pct(p.pnlPct)}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => close(p.symbol, p.qty)}
                          className="rounded-md border border-line-strong px-2.5 py-1 text-[12px] font-medium text-ink-2 transition hover:border-down/50 hover:text-down disabled:opacity-50"
                        >
                          Close
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ))}
        {tab === "Working" &&
          (working.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-ink-3">No working orders.</p>
          ) : (
            <OrderTable rows={working} action={(id) => cancel(id)} pending={pending} />
          ))}
        {tab === "History" &&
          (state.orders.filter((o) => o.status !== "working").length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-ink-3">Your filled and cancelled orders show here.</p>
          ) : (
            <OrderTable rows={state.orders.filter((o) => o.status !== "working")} />
          ))}
      </div>
    </section>
  );
}

function OrderTable({ rows, action, pending }: { rows: PaperState["orders"]; action?: (id: string) => void; pending?: boolean }) {
  const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  return (
    <table className="w-full min-w-[720px] text-[13px]">
      <thead className="text-[11px] text-ink-3">
        <tr className="border-b border-line">
          <th className="px-3 py-2 text-left font-medium">Time</th>
          <th className="px-3 py-2 text-left font-medium">Order</th>
          <th className="px-3 py-2 text-right font-medium">Type</th>
          <th className="px-3 py-2 text-right font-medium">Status</th>
          <th className="px-3 py-2 text-right font-medium">Fill</th>
          {action && <th className="px-3 py-2" />}
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {rows.map((o) => (
          <tr key={o.id} className="hover:bg-panel-2">
            <td className="px-3 py-2 font-mono-nums text-[12px] text-ink-3">{when(o.filledAt ?? o.at)}</td>
            <td className="px-3 py-2">
              <span className={o.side === "buy" ? "text-up" : "text-down"}>{o.side === "buy" ? "Buy" : "Sell"}</span>{" "}
              <span className="font-mono-nums text-ink">
                {o.qty} {symbolLabel(o.symbol)}
              </span>
              {o.note && <span className="ml-2 text-[11px] text-ink-3">{o.note}</span>}
            </td>
            <td className="px-3 py-2 text-right text-ink-2">{o.type === "limit" ? `Limit ${usd(o.limit)}` : "Market"}</td>
            <td className={`px-3 py-2 text-right ${o.status === "filled" ? "text-up" : o.status === "working" ? "text-warn" : "text-ink-3"}`}>{o.status}</td>
            <td className="px-3 py-2 text-right font-mono-nums text-ink">
              {usd(o.fill)}
              {o.source === "est" && <span className="ml-1 text-[10px] text-ink-3">est.</span>}
            </td>
            {action && (
              <td className="px-3 py-2 text-right">
                <button type="button" disabled={pending} onClick={() => action(o.id)} className="rounded-md border border-line-strong px-2.5 py-1 text-[12px] font-medium text-ink-2 transition hover:text-ink disabled:opacity-50">
                  Cancel
                </button>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
