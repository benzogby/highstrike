import type { Metadata } from "next";
import { requireMember } from "@/lib/membership";
import { closedPositions, paperState } from "@/lib/paper";
import { PageHeader } from "@/components/ui";
import PositionsTable, { type PositionRow } from "./PositionsTable";

export const metadata: Metadata = { title: "Positions — HighStrike" };

const DAY = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" });
const contractOf = (expiry: string | null, strike: number | null, type: "call" | "put" | null) =>
  expiry && strike != null ? `${DAY.format(new Date(`${expiry}T12:00:00Z`))} $${Number.isInteger(strike) ? strike : strike.toFixed(2)} ${type ?? ""}`.trim() : null;

/**
 * Positions (Ben, 2026-11-19: "show closed positions as well… only show trades taken in this account (including paper
 * and live, with a toggle switch). Add sort by and filters"): every position in the member's account, open ones marked
 * to the market and closed ones with their result (src/lib/paper.ts), with filters and sorting in the table. Live
 * trading isn't connected yet, so its side says so.
 */
export default async function PositionsPage() {
  const { user } = await requireMember("/journal");
  const [paper, closed] = await Promise.all([paperState(user.id).catch(() => null), closedPositions(user.id).catch(() => [])]);

  const rows: PositionRow[] = [
    ...(paper?.positions ?? []).map((p) => ({
      id: `open:${p.symbol}`,
      symbol: p.symbol,
      open: true,
      enteredAt: p.openedAt,
      closedAt: null,
      type: p.kind === "stock" ? ("Stock" as const) : p.optionType === "put" ? ("Put" as const) : ("Call" as const),
      underlying: p.underlying,
      contract: p.kind === "option" ? contractOf(p.expiry, p.strike, p.optionType) : null,
      qty: p.qty,
      size: p.cost,
      pnl: p.pnl,
      pnlPct: p.pnlPct,
      dayPnl: p.dayPnl,
      expired: false,
    })),
    ...closed.map((c, i) => ({
      id: `closed:${c.symbol}:${i}`,
      symbol: c.symbol,
      open: false,
      enteredAt: c.openedAt,
      closedAt: c.closedAt,
      type: c.kind === "stock" ? ("Stock" as const) : c.optionType === "put" ? ("Put" as const) : ("Call" as const),
      underlying: c.underlying,
      contract: c.kind === "option" ? contractOf(c.expiry, c.strike, c.optionType) : null,
      qty: c.qty,
      size: c.cost,
      pnl: c.pnl,
      pnlPct: c.pnlPct,
      dayPnl: null,
      expired: c.expired,
    })),
  ];

  return (
    <>
      <PageHeader title="Positions" subtitle="Every position in your account, open and closed. Only you can see them." />
      <PositionsTable rows={rows} />
    </>
  );
}
