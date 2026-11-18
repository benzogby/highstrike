import type { Style } from "@/lib/ideas";
import { addSessions, expiryFor, listsWeeklies, strikeGap, yearlyVol } from "@/lib/optionIdea";
import { bs, nickel, roundStrike } from "@/lib/options/pricing";

// The Trade Planner's numbers (docs/plans/offer-overhaul.md item 4): a style's starting plan, and the option a plan
// would use, priced the same way as every idea's option (src/lib/optionIdea.ts: Black-Scholes on the stock's own
// volatility, marked est.). The grade is src/lib/planGrade.ts.

/** A style's starting plan: trading days it runs, and the target and stop as % from the entry (reward 2× the risk). */
export const STYLE_PLAN: Record<Style, { hold: number; target: number; stop: number; label: string }> = {
  day: { hold: 1, target: 3, stop: 1.5, label: "Day" },
  swing: { hold: 10, target: 8, stop: 4, label: "Swing" },
  long: { hold: 40, target: 15, stop: 7.5, label: "Longer" },
};

export type PlanOption = {
  type: "call" | "put";
  strike: number;
  expiry: string;
  planEnd: string;
  /** Est. per share now, at the target on the plan's last day, and at the stop halfway through. */
  premium: number;
  atTarget: number;
  atStop: number;
};

const daysBetween = (a: string, b: string) => Math.max(0, Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000));

/** The plan's last trading day: today for a day trade, else `hold` sessions on. */
export const planEndOf = (today: string, hold: number) => (hold <= 1 ? today : addSessions(today, hold));

/**
 * The plan's option: a call for a long, a put for a short, at the listed strike nearest the entry, expiring on the first
 * listed Friday at least a week after the plan ends (so its last days aren't the fastest decay). Null under 21 closes.
 */
export function planOption(ticker: string, side: "long" | "short", entry: number, stop: number, target: number, today: string, hold: number, closes: number[]): PlanOption | null {
  if (closes.length < 21 || !(entry > 0)) return null;
  const type = side === "long" ? "call" : "put";
  const planEnd = planEndOf(today, hold);
  const expiry = expiryFor(planEnd, listsWeeklies(ticker));
  const strike = roundStrike(entry, strikeGap(entry));
  const vol = yearlyVol(closes.slice(-31));
  const total = Math.max(1, daysBetween(today, expiry)) / 365;
  const leftAtEnd = Math.max(1, daysBetween(planEnd, expiry)) / 365;
  const premium = nickel(bs(type, entry, strike, total, vol));
  if (premium < 0.05) return null;
  return {
    type,
    strike,
    expiry,
    planEnd,
    premium,
    atTarget: nickel(bs(type, target, strike, leftAtEnd, vol)),
    atStop: nickel(bs(type, stop, strike, (total + leftAtEnd) / 2, vol)),
  };
}

/** "Dec 19 $190 call". */
export function optionName(o: PlanOption) {
  const day = new Date(`${o.expiry}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return `${day} $${Number.isInteger(o.strike) ? o.strike : o.strike.toFixed(2)} ${o.type}`;
}
