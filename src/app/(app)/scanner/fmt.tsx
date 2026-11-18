import Link from "next/link";
import type { OptionRow } from "@/lib/scan/types";

// The Scanner's small shared pieces: numbers in words a newer trader reads at a glance, colors for up and down, and the
// "Plan it" link into the Trade Planner.

export const pct = (n: number | null, digits = 1) => (n == null ? "—" : `${n > 0 ? "+" : ""}${n.toFixed(digits)}%`);
export const price = (n: number | null) => (n == null ? "—" : `$${n >= 1000 ? n.toFixed(0) : n.toFixed(2)}`);
export const big = (n: number | null) =>
  n == null ? "—" : n >= 1e9 ? `$${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${Math.round(n / 1e3)}K` : `$${Math.round(n)}`;
export const count = (n: number | null) => (n == null ? "—" : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e4 ? `${Math.round(n / 1e3)}K` : n.toLocaleString("en-US"));
export const tone = (n: number | null) => (n == null ? "text-ink-3" : n > 0 ? "text-up" : n < 0 ? "text-down" : "text-ink-2");
export const day = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
export const weekday = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" });

/** "AAPL Dec 19 $360 call". */
export const contractLabel = (r: Pick<OptionRow, "u" | "expiry" | "strike" | "type">) => `${r.u} ${day(r.expiry)} $${Number.isInteger(r.strike) ? r.strike : r.strike.toFixed(2)} ${r.type}`;

/** Into the Planner with the stock and the side. */
export function PlanIt({ t, side, className = "" }: { t: string; side: "long" | "short"; className?: string }) {
  return (
    <Link
      href={`/plan?t=${encodeURIComponent(t)}&side=${side}`}
      className={`inline-flex h-7 shrink-0 items-center rounded-md border border-line-strong bg-panel-2 px-2.5 text-xs font-medium text-ink transition hover:border-accent/50 hover:text-accent ${className}`}
    >
      Plan it
    </Link>
  );
}

export function TickerLink({ t }: { t: string }) {
  return (
    <Link href={`/symbol/${t}`} className="font-mono-nums font-semibold text-ink hover:text-accent">
      {t}
    </Link>
  );
}
