"use client";

import { useState, useTransition } from "react";
import { BUTTON_PRIMARY, INPUT, LABEL } from "@/components/ui";
import { toastError, toastSuccess } from "@/lib/toastBus";
import { sendOrder } from "../paperActions";
import { symbolLabel, usd } from "./fmt";

export type TicketTarget = { symbol: string; kind: "stock" | "option"; side: "buy" | "sell"; bid: number | null; ask: number | null; last: number | null; held: number };

const seg = (on: boolean, tone: "up" | "down" | "neutral" = "neutral") =>
  `flex-1 rounded-md px-3 py-1.5 text-[13px] font-medium transition ${
    on ? (tone === "up" ? "bg-up/15 text-up ring-1 ring-inset ring-up/40" : tone === "down" ? "bg-down/15 text-down ring-1 ring-inset ring-down/40" : "bg-panel-3 text-ink ring-1 ring-inset ring-line-strong") : "text-ink-3 hover:text-ink"
  }`;

/**
 * The order ticket: buy or sell the selected stock or contract, market or limit, with the cost, what it leaves in cash,
 * and (for a member who answered the three questions) how it compares with their own risk rule. Fills happen on the
 * server (src/lib/paper.ts).
 */
export default function OrderTicket({
  target,
  cash,
  budget,
  open,
  onDone,
}: {
  target: TicketTarget;
  cash: number;
  /** The member's risk per trade in dollars, when known. */
  budget: number | null;
  open: boolean;
  onDone: () => void;
}) {
  const [side, setSide] = useState<"buy" | "sell">(target.side);
  const [qty, setQty] = useState(target.kind === "option" ? "1" : "10");
  const [type, setType] = useState<"market" | "limit">("market");
  const [limit, setLimit] = useState("");
  const [pending, start] = useTransition();

  const mult = target.kind === "option" ? 100 : 1;
  const n = Math.max(0, Math.floor(Number(qty) || 0));
  const price = type === "limit" && Number(limit) > 0 ? Number(limit) : side === "buy" ? (target.ask ?? target.last) : (target.bid ?? target.last);
  const total = price != null ? price * n * mult : null;
  const tooMuch = side === "buy" && total != null && total > cash;
  const overHeld = side === "sell" && n > target.held;
  const vsRule = side === "buy" && target.kind === "option" && total != null && budget ? total / budget : null;

  function submit() {
    if (!n) return toastError("Enter a quantity.");
    start(async () => {
      const r = await sendOrder({ symbol: target.symbol, side, qty: n, type, limit: type === "limit" ? Number(limit) : null });
      if ("error" in r) toastError(r.error);
      else if (r.status === "filled" && r.fill) toastSuccess(`${side === "buy" ? "Bought" : "Sold"} ${n} ${symbolLabel(target.symbol)} at ${usd(r.fill.price)}${r.fill.source === "est" ? " (est.)" : ""}`);
      else toastSuccess(r.note ?? "Order working");
      onDone();
    });
  }

  return (
    <section className="rounded-xl border border-line bg-panel p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[13px] font-medium text-ink">Order ticket</h2>
        <span className="text-[11px] text-ink-3">{open ? "Market open" : "Market closed · fills at the open"}</span>
      </div>
      <p className="mt-2 font-mono-nums text-[15px] font-semibold text-ink">{symbolLabel(target.symbol)}</p>
      <p className="mt-0.5 font-mono-nums text-[12px] text-ink-3">
        {target.kind === "option" ? (
          <>
            bid {usd(target.bid)} · ask {usd(target.ask)} <span className="text-ink-3">· a contract is 100 shares</span>
          </>
        ) : (
          <>last {usd(target.last)}</>
        )}
        {target.held > 0 && <span className="ml-1 text-accent-ink">· you hold {target.held}</span>}
      </p>

      <div className="mt-3 flex gap-1 rounded-lg bg-bg p-1">
        <button type="button" onClick={() => setSide("buy")} className={seg(side === "buy", "up")}>
          Buy
        </button>
        <button type="button" onClick={() => setSide("sell")} className={seg(side === "sell", "down")}>
          Sell
        </button>
      </div>
      <div className="mt-2 flex gap-1 rounded-lg bg-bg p-1">
        <button type="button" onClick={() => setType("market")} className={seg(type === "market")}>
          Market
        </button>
        <button type="button" onClick={() => setType("limit")} className={seg(type === "limit")}>
          Limit
        </button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="block">
          <span className={LABEL}>{target.kind === "option" ? "Contracts" : "Shares"}</span>
          <input inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} className={`${INPUT} font-mono-nums`} />
        </label>
        <label className="block">
          <span className={LABEL}>Limit price</span>
          <input
            inputMode="decimal"
            value={type === "limit" ? limit : ""}
            disabled={type !== "limit"}
            placeholder={type === "limit" ? (price?.toFixed(2) ?? "") : "Market"}
            onChange={(e) => setLimit(e.target.value)}
            className={`${INPUT} font-mono-nums disabled:opacity-50`}
          />
        </label>
      </div>

      <dl className="mt-3 space-y-1 rounded-lg bg-bg/60 p-2.5 text-[12px]">
        <div className="flex justify-between">
          <dt className="text-ink-3">{side === "buy" ? "Est. cost" : "Est. proceeds"}</dt>
          <dd className="font-mono-nums text-ink">{usd(total)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink-3">Cash after</dt>
          <dd className={`font-mono-nums ${tooMuch ? "text-down" : "text-ink-2"}`}>{total != null ? usd(side === "buy" ? cash - total : cash + total) : "—"}</dd>
        </div>
        {vsRule != null && (
          <div className="flex justify-between">
            <dt className="text-ink-3">Vs your risk rule</dt>
            <dd className={`font-mono-nums ${vsRule > 1.5 ? "text-down" : vsRule > 1 ? "text-warn" : "text-up"}`}>{vsRule.toFixed(1)}×</dd>
          </div>
        )}
      </dl>
      {tooMuch && <p className="mt-2 text-[12px] text-down">That&apos;s more than your cash.</p>}
      {overHeld && <p className="mt-2 text-[12px] text-down">{target.held ? `You hold ${target.held}.` : "You can only sell what you hold."}</p>}

      <button type="button" disabled={pending || !n || tooMuch || overHeld} onClick={submit} className={`${BUTTON_PRIMARY} mt-3 w-full`}>
        {pending ? "Sending…" : `${side === "buy" ? "Buy" : "Sell"} ${n || ""} ${target.kind === "option" ? (n === 1 ? "contract" : "contracts") : n === 1 ? "share" : "shares"}`}
      </button>
      <p className="mt-2 text-[11px] leading-relaxed text-ink-3">Paper money: practice only. Stocks fill at the live price; options at the ask or bid shown.</p>
    </section>
  );
}
