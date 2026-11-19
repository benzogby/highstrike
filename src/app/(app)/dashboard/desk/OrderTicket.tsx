"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, INPUT, LABEL } from "@/components/ui";
import { toastError, toastSuccess } from "@/lib/toastBus";
import { sendOrder } from "../paperActions";
import { symbolLabel, usd } from "./fmt";

export type TicketTarget = { symbol: string; kind: "stock" | "option"; side: "buy" | "sell"; bid: number | null; ask: number | null; last: number | null; held: number };

const seg = (on: boolean, tone: "up" | "down" | "neutral" = "neutral") =>
  `flex-1 rounded-md px-3 py-1.5 text-[13px] font-medium transition ${
    on ? (tone === "up" ? "bg-up/15 text-up ring-1 ring-inset ring-up/40" : tone === "down" ? "bg-down/15 text-down ring-1 ring-inset ring-down/40" : "bg-panel-3 text-ink ring-1 ring-inset ring-line-strong") : "text-ink-3 hover:text-ink"
  }`;

/** The market price a limit starts at: the last trade for shares; the mark (halfway between bid and ask) for an option. */
const marketPrice = (t: TicketTarget) => (t.kind === "stock" ? t.last : t.bid != null && t.ask != null ? (t.bid + t.ask) / 2 : (t.ask ?? t.last));

/**
 * The order ticket: buy or sell the selected stock or contract, market or limit, with the cost, what it leaves in cash,
 * and (for a member who answered the three questions) how it compares with their own risk rule. Fills happen on the
 * server (src/lib/paper.ts).
 * Ben, 2026-11-18: an Auto-Send box, off to start: while it's off, sending opens a confirmation of the whole order
 * first; ticked, orders go straight out. A limit price starts at the market price.
 */
export default function OrderTicket({
  target,
  cash,
  budget,
  open,
  onDone,
  autoSend,
  onAutoSend,
}: {
  target: TicketTarget;
  cash: number;
  /** The member's risk per trade in dollars, when known. */
  budget: number | null;
  open: boolean;
  onDone: () => void;
  autoSend: boolean;
  onAutoSend: (on: boolean) => void;
}) {
  const [side, setSide] = useState<"buy" | "sell">(target.side);
  const [qty, setQty] = useState(target.kind === "option" ? "1" : "10");
  const [type, setType] = useState<"market" | "limit">("market");
  // The limit price (Ben, 2026-11-18: "should START at the market price and be adjustable from there"): it follows the
  // market price until the member changes it; from then on it's theirs. Typing or stepping it makes the order a limit.
  const [typed, setTyped] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();

  const market = marketPrice(target);
  const limit = typed ?? (market != null ? market.toFixed(2) : "");
  const step = target.kind === "option" && (market ?? 0) >= 3 ? 0.05 : 0.01;
  const setLimit = (v: string) => {
    setTyped(v);
    setType("limit");
  };
  const nudge = (dir: 1 | -1) => {
    const base = Number(limit) > 0 ? Number(limit) : (market ?? 0);
    setLimit(Math.max(0.01, Math.round((base + dir * step) / step) * step).toFixed(2));
  };
  const mult = target.kind === "option" ? 100 : 1;
  const n = Math.max(0, Math.floor(Number(qty) || 0));
  const price = type === "limit" && Number(limit) > 0 ? Number(limit) : side === "buy" ? (target.ask ?? target.last) : (target.bid ?? target.last);
  const total = price != null ? price * n * mult : null;
  const tooMuch = side === "buy" && total != null && total > cash;
  const overHeld = side === "sell" && n > target.held;
  const vsRule = side === "buy" && target.kind === "option" && total != null && budget ? total / budget : null;
  const what = `${n} ${target.kind === "option" ? (n === 1 ? "contract" : "contracts") : n === 1 ? "share" : "shares"}`;

  const chooseLimit = () => setType("limit");

  function send() {
    if (!n) return toastError("Enter a quantity.");
    if (type === "limit" && !(Number(limit) > 0)) return toastError("Enter a limit price.");
    start(async () => {
      const r = await sendOrder({ symbol: target.symbol, side, qty: n, type, limit: type === "limit" ? Number(limit) : null });
      setConfirming(false);
      if ("error" in r) toastError(r.error);
      else if (r.status === "filled" && r.fill) toastSuccess(`${side === "buy" ? "Bought" : "Sold"} ${n} ${symbolLabel(target.symbol)} at ${usd(r.fill.price)}${r.fill.source === "est" ? " (est.)" : ""}`);
      else toastSuccess(r.note ?? "Order working");
      onDone();
    });
  }

  const submit = () => {
    if (!n) return toastError("Enter a quantity.");
    if (type === "limit" && !(Number(limit) > 0)) return toastError("Enter a limit price.");
    if (autoSend) send();
    else setConfirming(true);
  };

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
        <button type="button" onClick={chooseLimit} className={seg(type === "limit")}>
          Limit
        </button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="block">
          <span className={LABEL}>{target.kind === "option" ? "Contracts" : "Shares"}</span>
          <input inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} className={`${INPUT} font-mono-nums`} />
        </label>
        <label className="block">
          <span className={`${LABEL} flex items-baseline justify-between`}>
            Limit price
            {typed != null && market != null && (
              <button type="button" onClick={() => setTyped(null)} className="text-[11px] font-normal text-ink-3 hover:text-ink" title="Back to the market price">
                Reset
              </button>
            )}
          </span>
          <div className="flex">
            <button type="button" onClick={() => nudge(-1)} aria-label={`Lower the limit by ${step.toFixed(2)}`} className="h-9 rounded-l-lg border border-r-0 border-line-strong bg-panel-2 px-2 text-ink-2 hover:text-ink">
              −
            </button>
            <input
              inputMode="decimal"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              onFocus={(e) => e.target.select()}
              className={`${INPUT} rounded-none text-center font-mono-nums ${type === "market" ? "text-ink-3" : ""}`}
              aria-label="Limit price"
            />
            <button type="button" onClick={() => nudge(1)} aria-label={`Raise the limit by ${step.toFixed(2)}`} className="h-9 rounded-r-lg border border-l-0 border-line-strong bg-panel-2 px-2 text-ink-2 hover:text-ink">
              +
            </button>
          </div>
          <span className="mt-1 block text-[11px] text-ink-3">{type === "market" ? "Sends at market; change the price for a limit" : typed == null ? "Following the market price" : "Your price"}</span>
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

      <div className="mt-3 flex items-center gap-3">
        <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-[12px] text-ink-2" title="Send orders without the confirmation step">
          <input type="checkbox" checked={autoSend} onChange={(e) => onAutoSend(e.target.checked)} className="size-3.5 accent-[var(--color-accent)]" />
          Auto-Send
        </label>
        <button type="button" disabled={pending || !n || tooMuch || overHeld} onClick={submit} className={`${BUTTON_PRIMARY} flex-1`}>
          {pending ? "Sending…" : autoSend ? `${side === "buy" ? "Buy" : "Sell"} ${what}` : "Review order"}
        </button>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-ink-3">Paper money: practice only. Stocks fill at the live price; options at the ask or bid shown.</p>

      {confirming && (
        <Confirm
          onClose={() => setConfirming(false)}
          onSend={send}
          pending={pending}
          rows={[
            ["Action", <span key="a" className={side === "buy" ? "text-up" : "text-down"}>{side === "buy" ? "Buy" : "Sell"}</span>],
            ["Quantity", what],
            ["Symbol", symbolLabel(target.symbol)],
            ["Order", type === "limit" ? `Limit ${usd(Number(limit))}` : "Market"],
            [side === "buy" ? "Est. cost" : "Est. proceeds", usd(total)],
            ["Cash after", total != null ? usd(side === "buy" ? cash - total : cash + total) : "—"],
            ...(vsRule != null ? [["Vs your risk rule", `${vsRule.toFixed(1)}×`] as [string, string]] : []),
          ]}
          notes={[
            !open && "The market's closed: this fills at the next open.",
            type === "limit" && "A limit order fills only at your price or better; it waits until then.",
            target.kind === "option" && side === "buy" && "A bought option can lose its whole cost.",
          ].filter((x): x is string => Boolean(x))}
          sendLabel={`Send ${side === "buy" ? "buy" : "sell"} order`}
        />
      )}
    </section>
  );
}

/** The confirmation before an order goes out (Auto-Send off): the whole order, then Send or Edit. */
function Confirm({
  rows,
  notes,
  onSend,
  onClose,
  pending,
  sendLabel,
}: {
  rows: [string, React.ReactNode][];
  notes: string[];
  onSend: () => void;
  onClose: () => void;
  pending: boolean;
  sendLabel: string;
}) {
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- the portal needs document.body, so it waits for the browser
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter" && !pending) onSend();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, onSend, pending]);
  if (!mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-[80] grid place-items-center bg-bg/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Confirm order" onClick={onClose}>
      <div className="anim-pop w-full max-w-sm rounded-xl border border-line-strong bg-panel p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-[15px] font-medium text-ink">Confirm order</h2>
        <dl className="mt-3 divide-y divide-line rounded-lg border border-line text-[13px]">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 px-3 py-2">
              <dt className="text-ink-3">{k}</dt>
              <dd className="text-right font-mono-nums text-ink">{v}</dd>
            </div>
          ))}
        </dl>
        {notes.length > 0 && (
          <ul className="mt-3 space-y-1 text-[12px] leading-relaxed text-ink-2">
            {notes.map((n) => (
              <li key={n}>· {n}</li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-[11px] text-ink-3">Paper money. Tick Auto-Send on the ticket to skip this step.</p>
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onClose} className={`${BUTTON_SECONDARY} flex-1`}>
            Edit
          </button>
          <button type="button" autoFocus disabled={pending} onClick={onSend} className={`${BUTTON_PRIMARY} flex-1`}>
            {pending ? "Sending…" : sendLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
