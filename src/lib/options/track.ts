import { bs } from "./pricing";
import { STRUCTURES, type Bias, type Leg, type Structure } from "./cards";

// Following a saved setup (step 3 of the swipe app): what the position is worth now, on the same estimate it was priced
// with, and whether it has closed. It closes at the take profit or the stop (on the stock's price), or at expiry, and
// counts as a win when it closes with an estimated profit. An iron condor has no take-profit line: it closes as a win
// once half its credit is in hand. Pure.

export type Saved = {
  structure: Structure;
  bias: Bias;
  expiry: string;
  legs: Leg[];
  net: number;
  vol: number;
  max_profit: number | null;
  take_profit: number[];
  stop_loss: number[];
};

/** The position's value per share (what closing it would bring in, or cost, for a credit), at `spot` with `days` left. */
export function positionValue(s: Saved, spot: number, days: number) {
  const T = Math.max(0, days) / 365;
  return s.legs.reduce((v, l) => v + (l.side === "buy" ? 1 : -1) * bs(l.type, spot, Number(l.strike), T, Number(s.vol)), 0);
}

/** Estimated profit or loss per contract (100 shares), in dollars. */
export function pnlAt(s: Saved, spot: number, days: number) {
  return Math.round((positionValue(s, spot, days) - Number(s.net)) * 100) || 0;
}

export type Check = { pnl: number; status: "open" | "win" | "loss"; reason: "take_profit" | "stop" | "expiry" | null };

/** Where a saved setup stands at `spot` on `today` (YYYY-MM-DD, New York). */
export function check(s: Saved, spot: number, today: string): Check {
  const days = Math.round((Date.parse(`${s.expiry}T21:00:00Z`) - Date.parse(`${today}T21:00:00Z`)) / 86_400_000);
  if (days <= 0) {
    const pnl = pnlAt(s, spot, 0);
    return { pnl, status: pnl > 0 ? "win" : "loss", reason: "expiry" };
  }
  const pnl = pnlAt(s, spot, days);
  const kind = STRUCTURES[s.structure].kind;
  const [tp] = s.take_profit.map(Number);
  const stops = s.stop_loss.map(Number);
  let reason: Check["reason"] = null;
  if (kind === "condor") {
    if (spot <= stops[0] || spot >= stops[1]) reason = "stop";
    else if (s.max_profit != null && pnl >= Number(s.max_profit) / 2) reason = "take_profit";
  } else if (s.bias === "bull") {
    if (tp != null && spot >= tp) reason = "take_profit";
    else if (stops[0] != null && spot <= stops[0]) reason = "stop";
  } else {
    if (tp != null && spot <= tp) reason = "take_profit";
    else if (stops[0] != null && spot >= stops[0]) reason = "stop";
  }
  if (!reason) return { pnl, status: "open", reason: null };
  return { pnl, status: pnl > 0 ? "win" : "loss", reason };
}

/** Consecutive New York days, ending today or yesterday, with at least one swipe. */
export function streak(days: string[], today: string) {
  const set = new Set(days);
  const back = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);
  let start = set.has(today) ? today : set.has(back(today, 1)) ? back(today, 1) : null;
  let n = 0;
  while (start && set.has(start)) {
    n++;
    start = back(start, 1);
  }
  return n;
}
