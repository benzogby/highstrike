"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CARD } from "@/components/ui";

export type PositionRow = {
  id: string;
  symbol: string;
  open: boolean;
  enteredAt: string;
  closedAt: string | null;
  type: "Stock" | "Call" | "Put";
  underlying: string;
  contract: string | null;
  qty: number;
  /** What it cost to open. */
  size: number;
  /** Open: unrealized; closed: realized. */
  pnl: number | null;
  pnlPct: number | null;
  dayPnl: number | null;
  expired: boolean;
};

type SortKey = "entered" | "closed" | "ticker" | "type" | "qty" | "size" | "pnl" | "pnlPct" | "dayPnl";
type Sort = { key: SortKey; dir: "asc" | "desc" };

const SORTS: { label: string; sort: Sort }[] = [
  { label: "Newest entered", sort: { key: "entered", dir: "desc" } },
  { label: "Oldest entered", sort: { key: "entered", dir: "asc" } },
  { label: "Recently closed", sort: { key: "closed", dir: "desc" } },
  { label: "Biggest profit", sort: { key: "pnl", dir: "desc" } },
  { label: "Biggest loss", sort: { key: "pnl", dir: "asc" } },
  { label: "Best % return", sort: { key: "pnlPct", dir: "desc" } },
  { label: "Largest position", sort: { key: "size", dir: "desc" } },
  { label: "Ticker A–Z", sort: { key: "ticker", dir: "asc" } },
];

const WHEN = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const usd = (n: number) => `$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const signed = (n: number | null) => (n == null ? "—" : `${n > 0 ? "+" : n < 0 ? "−" : ""}${usd(n)}`);
const tone = (n: number | null) => (n == null || n === 0 ? "text-ink-2" : n > 0 ? "text-up" : "text-down");

function value(r: PositionRow, key: SortKey): number | string | null {
  switch (key) {
    case "entered":
      return r.enteredAt;
    case "closed":
      return r.closedAt;
    case "ticker":
      return `${r.underlying} ${r.contract ?? ""}`;
    case "type":
      return r.type;
    case "qty":
      return r.qty;
    case "size":
      return r.size;
    case "pnl":
      return r.pnl;
    case "pnlPct":
      return r.pnlPct;
    case "dayPnl":
      return r.dayPnl;
  }
}

/** Segmented choice: a row of small buttons. */
function Seg<T extends string>({ label, value: v, options, onChange }: { label: string; value: T; options: readonly (readonly [T, string])[]; onChange: (v: T) => void }) {
  return (
    <div role="group" aria-label={label} className="flex rounded-lg border border-line-strong p-0.5">
      {options.map(([k, text]) => (
        <button
          key={k}
          type="button"
          aria-pressed={v === k}
          onClick={() => onChange(k)}
          className={`h-7 rounded-md px-2.5 text-[12px] font-medium transition ${v === k ? "bg-panel-3 text-ink" : "text-ink-3 hover:text-ink"}`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

/** A column header that sorts by itself; a second click flips the order. */
function Th({ k, sort, onSort, children, right = false }: { k: SortKey; sort: Sort; onSort: (s: Sort) => void; children: React.ReactNode; right?: boolean }) {
  return (
    <th className={`px-3 py-2.5 font-medium ${right ? "text-right" : "text-left"}`} aria-sort={sort.key === k ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}>
      <button
        type="button"
        onClick={() => onSort(sort.key === k ? { key: k, dir: sort.dir === "asc" ? "desc" : "asc" } : { key: k, dir: k === "ticker" || k === "type" ? "asc" : "desc" })}
        className={`inline-flex items-center gap-1 hover:text-ink ${sort.key === k ? "text-ink" : ""}`}
      >
        {children}
        {sort.key === k && <span aria-hidden="true">{sort.dir === "asc" ? "↑" : "↓"}</span>}
      </button>
    </th>
  );
}

export default function PositionsTable({ rows }: { rows: PositionRow[] }) {
  const [account, setAccount] = useState<"paper" | "live">("paper");
  const [ticker, setTicker] = useState("");
  const [status, setStatus] = useState<"all" | "open" | "closed">("all");
  const [result, setResult] = useState<"all" | "profit" | "loss">("all");
  const [type, setType] = useState<"all" | "Stock" | "Call" | "Put">("all");
  const [sort, setSort] = useState<Sort>(SORTS[0].sort);

  const shown = useMemo(() => {
    const q = ticker.trim().toUpperCase();
    const list = rows.filter(
      (r) =>
        (!q || r.underlying.includes(q) || r.symbol.includes(q)) &&
        (status === "all" || (status === "open") === r.open) &&
        (result === "all" || (r.pnl != null && (result === "profit" ? r.pnl > 0 : r.pnl < 0))) &&
        (type === "all" || r.type === type)
    );
    const dir = sort.dir === "asc" ? 1 : -1;
    return list.sort((a, b) => {
      const x = value(a, sort.key);
      const y = value(b, sort.key);
      // Nothing to sort by (an open position's close, a missing price) goes last either way.
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      return (x < y ? -1 : x > y ? 1 : 0) * dir;
    });
  }, [rows, ticker, status, result, type, sort]);

  const totals = useMemo(
    () => ({
      size: shown.reduce((s, r) => s + r.size, 0),
      pnl: shown.reduce((s, r) => s + (r.pnl ?? 0), 0),
      day: shown.reduce((s, r) => s + (r.dayPnl ?? 0), 0),
      open: shown.filter((r) => r.open).length,
    }),
    [shown]
  );
  const filtered = Boolean(ticker.trim()) || status !== "all" || result !== "all" || type !== "all";

  return (
    <div className="mt-6">
      {/* Paper or live */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Account" className="flex rounded-lg bg-bg p-1 ring-1 ring-inset ring-line">
          {(["paper", "live"] as const).map((a) => (
            <button
              key={a}
              type="button"
              role="tab"
              aria-selected={account === a}
              onClick={() => setAccount(a)}
              className={`rounded-md px-4 py-1.5 text-[13px] font-medium transition ${account === a ? "bg-panel-3 text-ink ring-1 ring-inset ring-line-strong" : "text-ink-3 hover:text-ink"}`}
            >
              {a === "paper" ? "Paper" : "Live"}
            </button>
          ))}
        </div>
        {account === "paper" && (
          <Link href="/dashboard" className="text-[13px] font-medium text-accent hover:underline">
            Trade on the desk
          </Link>
        )}
      </div>

      {account === "live" ? (
        <div className={`${CARD} mt-4 px-5 py-10 text-center`}>
          <p className="text-sm font-medium text-ink">No live account connected</p>
          <p className="mx-auto mt-1 max-w-md text-[13px] text-ink-3">Live trading through a broker isn&apos;t connected to HighStrike yet. Your paper account&apos;s positions are under Paper.</p>
        </div>
      ) : (
        <>
          {/* Filters and sorting */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <input
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              placeholder="Ticker"
              aria-label="Filter by ticker"
              className="h-8 w-28 rounded-lg border border-line-strong bg-panel px-2.5 font-mono-nums text-[13px] uppercase text-ink placeholder:normal-case placeholder:text-ink-3 focus:border-accent focus:outline-none"
            />
            <Seg label="Open or closed" value={status} onChange={setStatus} options={[["all", "All"], ["open", "Open"], ["closed", "Closed"]] as const} />
            <Seg label="Profit or loss" value={result} onChange={setResult} options={[["all", "Any result"], ["profit", "Profit"], ["loss", "Loss"]] as const} />
            <Seg label="Type" value={type} onChange={setType} options={[["all", "All types"], ["Stock", "Stock"], ["Call", "Calls"], ["Put", "Puts"]] as const} />
            {filtered && (
              <button
                type="button"
                onClick={() => {
                  setTicker("");
                  setStatus("all");
                  setResult("all");
                  setType("all");
                }}
                className="h-8 px-2 text-[12px] font-medium text-ink-3 hover:text-ink"
              >
                Clear
              </button>
            )}
            <label className="ml-auto flex items-center gap-2 text-[12px] text-ink-3">
              Sort by
              <select
                value={SORTS.findIndex((s) => s.sort.key === sort.key && s.sort.dir === sort.dir)}
                onChange={(e) => setSort(SORTS[Number(e.target.value)].sort)}
                className="h-8 rounded-lg border border-line-strong bg-panel px-2 text-[13px] text-ink focus:border-accent focus:outline-none"
              >
                {SORTS.findIndex((s) => s.sort.key === sort.key && s.sort.dir === sort.dir) < 0 && <option value={-1}>Column</option>}
                {SORTS.map((s, i) => (
                  <option key={s.label} value={i}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {rows.length === 0 ? (
            <div className={`${CARD} mt-4 px-5 py-10 text-center`}>
              <p className="text-sm text-ink-2">No positions yet.</p>
              <Link href="/dashboard" className="mt-3 inline-flex text-sm font-medium text-accent hover:underline">
                Open the desk
              </Link>
            </div>
          ) : (
            <div className={`${CARD} mt-4 overflow-x-auto`}>
              <table className="w-full min-w-[980px] text-[13px]">
                <thead className="border-b border-line text-[11px] text-ink-3">
                  <tr>
                    <Th sort={sort} onSort={setSort} k="entered">Entered</Th>
                    <Th sort={sort} onSort={setSort} k="closed">Closed</Th>
                    <Th sort={sort} onSort={setSort} k="type">Type</Th>
                    <Th sort={sort} onSort={setSort} k="ticker">Underlying</Th>
                    <th className="px-3 py-2.5 text-left font-medium">Contract</th>
                    <Th sort={sort} onSort={setSort} k="qty" right>
                      Qty
                    </Th>
                    <Th sort={sort} onSort={setSort} k="size" right>
                      Position size
                    </Th>
                    <Th sort={sort} onSort={setSort} k="pnl" right>
                      P/L
                    </Th>
                    <Th sort={sort} onSort={setSort} k="pnlPct" right>
                      P/L %
                    </Th>
                    <Th sort={sort} onSort={setSort} k="dayPnl" right>
                      P/L day
                    </Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {shown.map((r) => (
                    <tr key={r.id} className="hover:bg-panel-2/50">
                      <td className="whitespace-nowrap px-3 py-2.5 text-ink-2">{WHEN.format(new Date(r.enteredAt))}</td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        {r.open ? (
                          <span className="rounded-md bg-accent-soft px-1.5 py-0.5 text-[11px] font-medium text-accent-ink">Open</span>
                        ) : (
                          <span className="text-ink-2">
                            {WHEN.format(new Date(r.closedAt!))}
                            {r.expired && <span className="ml-1.5 text-[11px] text-ink-3">expired</span>}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-ink">{r.type}</td>
                      <td className="px-3 py-2.5">
                        <Link href={`/dashboard?t=${r.underlying}${r.type !== "Stock" ? "&trade=options" : ""}`} className="font-mono-nums font-medium text-ink hover:text-accent">
                          {r.underlying}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-ink-2">{r.contract ?? <span className="text-ink-3">—</span>}</td>
                      <td className="px-3 py-2.5 text-right font-mono-nums text-ink">{r.qty.toLocaleString("en-US")}</td>
                      <td className="px-3 py-2.5 text-right font-mono-nums text-ink">{usd(r.size)}</td>
                      <td className={`px-3 py-2.5 text-right font-mono-nums ${tone(r.pnl)}`}>{signed(r.pnl)}</td>
                      <td className={`px-3 py-2.5 text-right font-mono-nums ${tone(r.pnlPct)}`}>{r.pnlPct == null ? "—" : `${r.pnlPct > 0 ? "+" : ""}${r.pnlPct}%`}</td>
                      <td className={`px-3 py-2.5 text-right font-mono-nums ${tone(r.dayPnl)}`}>{r.open ? signed(r.dayPnl) : <span className="text-ink-3">—</span>}</td>
                    </tr>
                  ))}
                  {shown.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-3 py-8 text-center text-ink-3">
                        Nothing matches these filters.
                      </td>
                    </tr>
                  )}
                </tbody>
                {shown.length > 0 && (
                  <tfoot className="border-t border-line-strong text-ink">
                    <tr>
                      <td colSpan={6} className="px-3 py-2.5 text-[12px] font-medium text-ink-2">
                        {shown.length} {shown.length === 1 ? "position" : "positions"} · {totals.open} open
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono-nums">{usd(totals.size)}</td>
                      <td className={`px-3 py-2.5 text-right font-mono-nums ${tone(totals.pnl)}`}>{signed(totals.pnl)}</td>
                      <td />
                      <td className={`px-3 py-2.5 text-right font-mono-nums ${tone(totals.day)}`}>{totals.open ? signed(totals.day) : "—"}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
          <p className="mt-2 text-[11px] text-ink-3">
            Position size is what it cost to open. P/L is open profit or loss for open positions and the result for closed ones. Options are priced at
            their live mid where there is one, else estimated. Closed positions start from your last account reset.
          </p>
        </>
      )}
    </div>
  );
}
