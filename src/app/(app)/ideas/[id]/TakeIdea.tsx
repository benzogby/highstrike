"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { CARD, INPUT } from "@/components/ui";
import { takeIdea } from "../../journal/actions";

/**
 * "I took this" (Ben, 2026-11-03: track + journal): the idea's shares, or the option it suggests, at the price paid and
 * how many, into My trades with the idea's target and stop to watch. Once taken, it says so and links there.
 */
export default function TakeIdea({
  setupId,
  ticker,
  sharePrice,
  option,
  taken,
}: {
  setupId: string;
  ticker: string;
  /** The price to start the box at for shares: the live price, else the idea's entry. */
  sharePrice: number | null;
  /** The suggested option's name and est. price per share, when the idea has one. */
  option: { name: string; premium: number } | null;
  /** How many trades the member already took from this idea. */
  taken: number;
}) {
  const [open, setOpen] = useState(false);
  const [how, setHow] = useState<"stock" | "option">(option ? "option" : "stock");
  const [price, setPrice] = useState(option ? option.premium.toFixed(2) : sharePrice != null ? sharePrice.toFixed(2) : "");
  const [quantity, setQuantity] = useState(option ? "1" : "10");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  const pick = (h: "stock" | "option") => {
    setHow(h);
    setPrice(h === "option" && option ? option.premium.toFixed(2) : sharePrice != null ? sharePrice.toFixed(2) : "");
    setQuantity(h === "option" ? "1" : "10");
  };

  if (done || (taken > 0 && !open)) {
    return (
      <section className={`${CARD} flex flex-wrap items-center justify-between gap-3 px-4 py-3.5`}>
        <p className="text-sm text-ink-2">
          <span className="font-medium text-ink">You took this.</span> It&apos;s in My trades, watching the target and the stop.
        </p>
        <div className="flex items-center gap-3">
          {!done && (
            <button type="button" onClick={() => setOpen(true)} className="text-sm text-ink-3 hover:text-ink">
              Took it again
            </button>
          )}
          <Link href="/journal" className="text-sm font-medium text-accent hover:underline">
            Open My trades
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className={`${CARD} px-4 py-3.5`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[15px] font-medium text-ink">Took this trade?</p>
          <p className="mt-0.5 text-[13px] text-ink-3">Add it to My trades to follow it, with its target and stop, and keep notes.</p>
        </div>
        {!open && (
          <button type="button" onClick={() => setOpen(true)} className="h-9 rounded-lg bg-accent px-3.5 text-sm font-semibold text-on-accent transition hover:bg-accent-2">
            I took this
          </button>
        )}
      </div>
      {open && (
        <form
          className="mt-4 grid gap-3 sm:grid-cols-[auto_1fr_1fr_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            setError("");
            start(async () => {
              const r = await takeIdea({ setupId, instrument: how, price, quantity }).catch(() => ({ ok: false as const, error: "That didn't work. Try again." }));
              if (r.ok) setDone(true);
              else setError(r.error);
            });
          }}
        >
          <div>
            <span className="mb-1 block text-[13px] text-ink-2">How</span>
            <div className="grid h-9 grid-cols-2 rounded-lg bg-bg p-0.5 ring-1 ring-inset ring-line-strong">
              <button
                type="button"
                aria-pressed={how === "stock"}
                onClick={() => pick("stock")}
                className={`rounded-md px-3 text-sm font-medium transition ${how === "stock" ? "bg-panel-3 text-ink" : "text-ink-3 hover:text-ink"}`}
              >
                {ticker} shares
              </button>
              <button
                type="button"
                aria-pressed={how === "option"}
                disabled={!option}
                onClick={() => pick("option")}
                title={option ? option.name : "This idea has no suggested option"}
                className={`rounded-md px-3 text-sm font-medium transition disabled:opacity-40 ${how === "option" ? "bg-panel-3 text-ink" : "text-ink-3 hover:text-ink"}`}
              >
                The option
              </button>
            </div>
          </div>
          <label className="text-[13px] text-ink-2">
            <span className="mb-1 block">{how === "option" ? "Price paid per share (a contract is 100)" : "Price paid per share"}</span>
            <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" className={`${INPUT} font-mono-nums`} />
          </label>
          <label className="text-[13px] text-ink-2">
            <span className="mb-1 block">{how === "option" ? "Contracts" : "Shares"}</span>
            <input value={quantity} onChange={(e) => setQuantity(e.target.value)} inputMode="decimal" className={`${INPUT} font-mono-nums`} />
          </label>
          <button type="submit" disabled={pending} className="h-9 rounded-lg bg-accent px-3.5 text-sm font-semibold text-on-accent transition hover:bg-accent-2 disabled:opacity-60">
            {pending ? "Saving…" : "Add to My trades"}
          </button>
          {how === "option" && option && <p className="text-[13px] text-ink-3 sm:col-span-4">{option.name}. The price starts at the est. value; put what you really paid.</p>}
          {error && (
            <p role="alert" className="text-sm text-down sm:col-span-4">
              {error}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
