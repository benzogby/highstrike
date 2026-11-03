"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Badge, INPUT } from "@/components/ui";
import { closeTrade, deleteTrade, reopenTrade, saveNotes } from "./actions";

/** One trade as the journal shows it, worked out on the server (src/lib/trades.ts), so this needs none of the maths. */
export type Row = {
  id: string;
  setupId: string | null;
  name: string;
  /** Shares' side; null for an option (its call or put says it). */
  side: "long" | "short" | null;
  size: string;
  open: boolean;
  opened: string;
  closed: string | null;
  entry: string;
  /** Worth now per share (open), or the exit (closed); null without a live price. */
  now: string | null;
  est: boolean;
  /** The mark as a number, to start the Close box at. */
  markPrice: number | null;
  pnl: string | null;
  pct: string | null;
  up: boolean | null;
  levels: string | null;
  hit: "target" | "stop" | null;
  notes: string;
};

const SMALL_BUTTON = "rounded-md px-2 py-1 text-xs font-medium text-ink-2 ring-1 ring-inset ring-line-strong transition hover:bg-panel-2 hover:text-ink disabled:opacity-50";

/** A trade in the journal: what it is, entry and now, the result, and its buttons (close, notes, delete). */
export default function TradeRow({ row }: { row: Row }) {
  const [pending, start] = useTransition();
  const [panel, setPanel] = useState<"close" | "notes" | null>(null);
  const [exit, setExit] = useState(row.markPrice != null ? row.markPrice.toFixed(2) : "");
  const [notes, setNotes] = useState(row.notes);
  const [error, setError] = useState("");

  const run = (act: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) => {
    setError("");
    start(async () => {
      const r = await act().catch(() => ({ ok: false, error: "That didn't work. Try again." }));
      if (!r.ok) setError(r.error ?? "That didn't work.");
      else after?.();
    });
  };

  return (
    <li className="px-4 py-3.5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {row.setupId ? (
              <Link href={`/ideas/${row.setupId}`} className="font-mono-nums text-[15px] font-medium text-ink hover:underline">
                {row.name}
              </Link>
            ) : (
              <span className="font-mono-nums text-[15px] font-medium text-ink">{row.name}</span>
            )}
            {row.side && <Badge tone={row.side === "long" ? "up" : "down"}>{row.side === "long" ? "Long" : "Short"}</Badge>}
            {row.hit && <Badge tone={row.hit === "target" ? "up" : "down"}>{row.hit === "target" ? "Hit its target" : "Hit its stop"}</Badge>}
          </div>
          <p className="mt-1 text-[13px] text-ink-3">
            {row.size} · {row.open ? `opened ${row.opened}` : `${row.opened} → ${row.closed ?? ""}`}
            {row.open && row.levels ? ` · ${row.levels}` : ""}
          </p>
          {row.notes && panel !== "notes" && <p className="mt-1.5 max-w-2xl whitespace-pre-line text-sm leading-relaxed text-ink-2">{row.notes}</p>}
        </div>
        <div className="grid grid-cols-3 gap-3 font-mono-nums text-sm sm:flex sm:items-start sm:gap-5 sm:text-right">
          <div>
            <p className="text-xs text-ink-3">Entry</p>
            <p className="text-ink">{row.entry}</p>
          </div>
          <div>
            <p className="text-xs text-ink-3">{row.open ? (row.est ? "Now, est." : "Now") : "Exit"}</p>
            <p className="text-ink">{row.now ?? "—"}</p>
          </div>
          <div className="sm:min-w-[88px]">
            <p className="text-xs text-ink-3">{row.open ? "So far" : "Result"}</p>
            <p className={row.up == null ? "text-ink-3" : row.up ? "text-up" : "text-down"}>{row.pnl ?? "—"}</p>
            {row.pct && <p className={`text-xs ${row.up ? "text-up" : "text-down"}`}>{row.pct}</p>}
          </div>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {row.open ? (
          <button type="button" className={SMALL_BUTTON} disabled={pending} onClick={() => setPanel(panel === "close" ? null : "close")}>
            Close it
          </button>
        ) : (
          <button type="button" className={SMALL_BUTTON} disabled={pending} onClick={() => run(() => reopenTrade(row.id))}>
            Reopen
          </button>
        )}
        <button type="button" className={SMALL_BUTTON} disabled={pending} onClick={() => setPanel(panel === "notes" ? null : "notes")}>
          {row.notes ? "Edit notes" : "Add notes"}
        </button>
        <button
          type="button"
          className={`${SMALL_BUTTON} ml-auto`}
          disabled={pending}
          onClick={() => {
            if (window.confirm(`Delete ${row.name} from your trades?`)) run(() => deleteTrade(row.id));
          }}
        >
          Delete
        </button>
      </div>

      {panel === "close" && (
        <form
          className="mt-3 flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => closeTrade(row.id, exit), () => setPanel(null));
          }}
        >
          <label className="text-[13px] text-ink-2">
            <span className="mb-1 block">Price you got out at, per share</span>
            <input value={exit} onChange={(e) => setExit(e.target.value)} inputMode="decimal" placeholder="0.00" className={`${INPUT} w-40 font-mono-nums`} autoFocus />
          </label>
          <button type="submit" disabled={pending} className="h-9 rounded-lg bg-accent px-3.5 text-sm font-semibold text-on-accent transition hover:bg-accent-2 disabled:opacity-60">
            {pending ? "Saving…" : "Close trade"}
          </button>
        </form>
      )}

      {panel === "notes" && (
        <form
          className="mt-3 grid max-w-2xl gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => saveNotes(row.id, notes), () => setPanel(null));
          }}
        >
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={4000}
            rows={4}
            placeholder="Why you took it, how you felt, what you'd do differently…"
            className="w-full rounded-lg border border-line-strong bg-bg px-3 py-2 text-sm text-ink outline-none transition placeholder:text-ink-3 focus:border-accent focus:ring-2 focus:ring-accent/20"
            autoFocus
          />
          <div>
            <button type="submit" disabled={pending} className="h-9 rounded-lg bg-accent px-3.5 text-sm font-semibold text-on-accent transition hover:bg-accent-2 disabled:opacity-60">
              {pending ? "Saving…" : "Save notes"}
            </button>
          </div>
        </form>
      )}

      {error && (
        <p role="alert" className="mt-2 text-sm text-down">
          {error}
        </p>
      )}
    </li>
  );
}
