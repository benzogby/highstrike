"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type ScanRow = {
  ticker: string;
  name: string;
  price: number;
  changePct: number;
  rangePos: number | null;
  gapPct: number | null;
  mom5d: number | null;
  score: number;
  bias: "long" | "short" | "neutral";
  live: boolean;
};

const COLS = [
  { key: "ticker", label: "Ticker", align: "left" },
  { key: "price", label: "Last", align: "right" },
  { key: "changePct", label: "Chg %", align: "right" },
  { key: "rangePos", label: "Range pos", align: "right" },
  { key: "gapPct", label: "Gap %", align: "right" },
  { key: "mom5d", label: "5d %", align: "right" },
  { key: "score", label: "Flow score", align: "right" },
  { key: "bias", label: "Bias", align: "right" },
] as const;

type SortKey = (typeof COLS)[number]["key"];

const REFRESH_MS = 60_000;

export default function ScannerTable() {
  const [rows, setRows] = useState<ScanRow[] | null>(null);
  const [live, setLive] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [asc, setAsc] = useState(false);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const res = await fetch("/api/scanner");
        if (!res.ok) return;
        const data = await res.json();
        if (!alive) return;
        setRows(data.rows ?? []);
        setLive(Boolean(data.live));
      } catch {
        // keep last
      }
    }
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const sorted = useMemo(() => {
    if (!rows) return null;
    const out = [...rows];
    out.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      let cmp: number;
      if (typeof av === "string" || typeof bv === "string") {
        cmp = String(av).localeCompare(String(bv));
      } else {
        cmp = (av ?? -Infinity) < (bv ?? -Infinity) ? -1 : (av ?? -Infinity) > (bv ?? -Infinity) ? 1 : 0;
      }
      return asc ? cmp : -cmp;
    });
    return out;
  }, [rows, sortKey, asc]);

  function sortBy(key: SortKey) {
    if (key === sortKey) {
      setAsc(!asc);
    } else {
      setSortKey(key);
      setAsc(key === "ticker");
    }
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-ink-3">
          {rows ? `${rows.length} symbols · refreshes every 60s` : "Loading…"}
        </span>
        <span className="text-[10px] uppercase tracking-wider text-ink-3">
          {live ? "Live data" : "Sample data — live pending"}
        </span>
      </div>
      <div className="mt-3 overflow-x-auto rounded-2xl border border-line bg-panel">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-line text-[10px] uppercase tracking-wider text-ink-3">
              {COLS.map((c) => (
                <th
                  key={c.key}
                  className={`px-4 py-2.5 font-medium ${c.align === "right" ? "text-right" : "text-left"}`}
                >
                  <button
                    type="button"
                    onClick={() => sortBy(c.key)}
                    className={`uppercase tracking-wider transition hover:text-ink ${
                      sortKey === c.key ? "text-accent" : ""
                    }`}
                  >
                    {c.label}
                    {sortKey === c.key ? (asc ? " ↑" : " ↓") : ""}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {(sorted ?? []).map((r) => (
              <tr key={r.ticker} className="group transition hover:bg-panel-2">
                <td className="px-4 py-2.5">
                  <span className="inline-flex items-center gap-2">
                    <Link
                      href={`/symbol/${r.ticker}`}
                      className="font-display font-semibold transition hover:text-accent"
                    >
                      {r.ticker}
                    </Link>
                    <Link
                      href={`/symbol/${r.ticker}#alerts`}
                      aria-label={`Set alert on ${r.ticker}`}
                      title="Set price alert"
                      className="text-ink-3 opacity-0 transition group-hover:opacity-100 hover:text-accent"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                    </Link>
                  </span>
                  <span className="ml-2 hidden max-w-[160px] truncate align-middle text-xs text-ink-3 lg:inline-block">
                    {r.name}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right font-mono-nums text-ink-2">
                  {r.price.toFixed(2)}
                </td>
                <td
                  className={`px-4 py-2.5 text-right font-mono-nums ${
                    r.changePct >= 0 ? "text-up" : "text-down"
                  }`}
                >
                  {r.changePct >= 0 ? "+" : ""}
                  {r.changePct.toFixed(2)}%
                </td>
                <td className="px-4 py-2.5 text-right font-mono-nums text-ink-2">
                  {r.rangePos != null ? r.rangePos.toFixed(2) : "—"}
                </td>
                <td className="px-4 py-2.5 text-right font-mono-nums text-ink-2">
                  {r.gapPct != null ? `${r.gapPct >= 0 ? "+" : ""}${r.gapPct.toFixed(2)}%` : "—"}
                </td>
                <td className="px-4 py-2.5 text-right font-mono-nums text-ink-2">
                  {r.mom5d != null ? `${r.mom5d >= 0 ? "+" : ""}${r.mom5d.toFixed(2)}%` : "—"}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <span className="inline-flex items-center justify-end gap-2">
                    <span
                      className="h-1.5 w-14 overflow-hidden rounded-full bg-panel-2"
                      aria-hidden="true"
                    >
                      <span
                        className="block h-full rounded-full bg-accent"
                        style={{ width: `${r.score}%` }}
                      />
                    </span>
                    <span className="font-mono-nums text-ink">{r.score}</span>
                  </span>
                </td>
                <td
                  className={`px-4 py-2.5 text-right font-mono-nums text-xs ${
                    r.bias === "long"
                      ? "text-up"
                      : r.bias === "short"
                        ? "text-down"
                        : "text-ink-3"
                  }`}
                >
                  {r.bias === "long" ? "▲ Long" : r.bias === "short" ? "▼ Short" : "— Neutral"}
                </td>
              </tr>
            ))}
            {sorted == null &&
              [0, 1, 2, 3, 4, 5].map((i) => (
                <tr key={`sk-${i}`}>
                  {COLS.map((c) => (
                    <td key={c.key} className="px-4 py-3">
                      <span className="skeleton block h-4 w-full rounded" />
                    </td>
                  ))}
                </tr>
              ))}
            {sorted && sorted.length === 0 && (
              <tr>
                <td colSpan={COLS.length} className="px-4 py-8 text-center text-sm text-ink-3">
                  No symbols in the universe yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-xs leading-relaxed text-ink-3">
        Flow score = 50 + day change ×6 + (range position − 0.5) ×30 + gap ×3 +
        5-day momentum ×2, clamped 0–100. Range position is where price sits in
        the day&apos;s high–low span. 5-day momentum uses HighStrike&apos;s own
        recorded closes and fills in as history accrues. Market commentary, not
        investment advice.
      </p>
    </>
  );
}
