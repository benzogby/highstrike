import { bs, roundStrike, strikeStep, volatility } from "@/lib/options/pricing";

// A trade plan's numbers (entry, stop, target over a span of days): reward to risk, the moves in percent, and an
// estimated at-the-money option's value at the start, at the target and at the stop, by the same Black-Scholes and the
// stock's own volatility as every other "est." price in HighStrike (src/lib/options/pricing.ts). Education, not advice.

export type PlanNumbers = {
  rr: number | null;
  targetPct: number;
  stopPct: number;
  option: { type: "call" | "put"; strike: number; expiryDays: number; now: number; atTarget: number; atStop: number } | null;
};

export function planNumbers(side: "long" | "short", entry: number, stop: number, target: number, days: number, closes: number[]): PlanNumbers {
  const risk = Math.abs(entry - stop);
  const reward = Math.abs(target - entry);
  const targetPct = ((target - entry) / entry) * 100;
  const stopPct = ((stop - entry) / entry) * 100;
  let option: PlanNumbers["option"] = null;
  if (entry > 0 && target > 0 && stop > 0) {
    const type = side === "long" ? "call" : "put";
    const strike = roundStrike(entry, strikeStep(entry));
    const hold = Math.max(1, Math.round(days));
    // The option outlasts the plan by a week, so the plan's last day isn't spent in the final week's fast decay.
    const expiryDays = hold + 7;
    const v = volatility(closes.slice(-31));
    const now = bs(type, entry, strike, expiryDays / 365, v);
    const left = (expiryDays - hold) / 365;
    option = {
      type,
      strike,
      expiryDays,
      now,
      atTarget: bs(type, target, strike, left, v),
      atStop: bs(type, stop, strike, (expiryDays - hold / 2) / 365, v),
    };
  }
  return { rr: risk > 0 ? reward / risk : null, targetPct, stopPct, option };
}
