import type { Candle } from "@/lib/chart/types";
import { volatility } from "@/lib/options/pricing";

// The Trade Planner's A–F grade (docs/plans/offer-overhaul.md item 4, Ben 2026-11-17: "grade any trade plan A–F").
// Rules only, no AI, and every check says why in plain words. It grades the PLAN against the stock's own history and the
// member's own risk rule; it is education, never a call on whether to trade. Pure: the page passes the daily candles.
//
// Eight checks, each scored 0–100, averaged by weight (a check that can't be worked out is left out, and says so):
//   Trend (20)          long: price over its 50-day average, the 50 over the 200, the 21 rising (short: the reverse).
//   Reward to risk (15) target distance ÷ stop distance: 3+ → 100, 2+ → 90, 1.5+ → 70, 1+ → 45, under 1 → 10.
//   Stop room (10)      stop distance ÷ the average daily range (ATR 14): under 0.75 → 30 (inside a normal day's swing),
//                       0.75–1 → 60, 1–3 → 100, 3–5 → 70, over 5 → 40.
//   Target reach (20)   target distance ÷ a typical move over the hold (price × yearly volatility × √(days ÷ 252)):
//                       ≤0.75 → 100, ≤1 → 85, ≤1.5 → 60, ≤2 → 35, more → 15.
//   Option price (10)   options only: today's 20-day volatility against the last year's (its percentile, a stand-in for
//                       IV rank until real chains): ≤30 → 100, ≤60 → 75, ≤80 → 50, more → 25.
//   Earnings (10)       an earnings date inside the plan (or before the option expires) → 25; none → 100.
//   Liquidity (5)       average dollar volume over 20 days: $500M+ → 100, $100M+ → 85, $20M+ → 60, less → 25.
//   Size (10)           what the size risks ÷ the member's risk per trade: ≤1 → 100, ≤1.25 → 70, ≤2 → 35, more → 0.
// Letter: 85+ A, 72+ B, 58+ C, 45+ D, else F. Caps: reward under risk, or a size over 1.5× the rule, is a D at best;
// an A needs every check at 50 or more.

export type Check = { key: string; name: string; score: number | null; weight: number; text: string };
export type Grade = { letter: "A" | "B" | "C" | "D" | "F"; score: number; checks: Check[]; capped: string | null } | { error: string };

export type PlanInput = {
  side: "long" | "short";
  entry: number;
  stop: number;
  target: number;
  /** Trading days the plan runs. */
  holdDays: number;
  instrument: "option" | "shares";
  /** What the chosen size loses if it all goes wrong (an option's whole cost; shares to the stop). */
  sizeRisk: number | null;
  /** The member's risk per trade in dollars, when they've given it. */
  budget: number | null;
  /** YYYY-MM-DD; null: none listed; undefined: unknown. */
  earnings: string | null | undefined;
  /** The plan's last day and, for an option, its expiry (YYYY-MM-DD). */
  planEnd: string;
  expiry: string | null;
};

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const sma = (xs: number[], n: number, end = xs.length) => (end >= n ? avg(xs.slice(end - n, end)) : NaN);
const money = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: n >= 100 ? 0 : 2, minimumFractionDigits: n >= 100 ? 0 : 2 })}`;
const big = (n: number) => (n >= 1e9 ? `$${(n / 1e9).toFixed(1)}B` : `$${Math.round(n / 1e6)}M`);
const shortDay = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export function atr(bars: Candle[], n = 14) {
  const tr: number[] = [];
  for (let i = Math.max(1, bars.length - n); i < bars.length; i++) {
    const b = bars[i];
    const pc = bars[i - 1].c;
    tr.push(Math.max(b.h - b.l, Math.abs(b.h - pc), Math.abs(b.l - pc)));
  }
  return avg(tr);
}

/** Today's 20-day volatility as a percentile of the last year's (0–100), or null with under ~80 days of history. */
export function volPercentile(closes: number[]) {
  if (closes.length < 80) return null;
  const series: number[] = [];
  for (let end = Math.max(21, closes.length - 252); end <= closes.length; end++) series.push(volatility(closes.slice(end - 21, end)));
  const now = series[series.length - 1];
  return Math.round((series.filter((v) => v <= now).length / series.length) * 100);
}

export function gradePlan(bars: Candle[], p: PlanInput): Grade {
  const long = p.side === "long";
  if (!(p.entry > 0 && p.stop > 0 && p.target > 0)) return { error: "Enter an entry, a stop and a target." };
  if (long ? p.stop >= p.entry : p.stop <= p.entry) return { error: `For a ${p.side}, the stop goes ${long ? "below" : "above"} the entry.` };
  if (long ? p.target <= p.entry : p.target >= p.entry) return { error: `For a ${p.side}, the target goes ${long ? "above" : "below"} the entry.` };
  if (bars.length < 30) return { error: "There isn't enough price history to grade this stock." };

  const closes = bars.map((b) => b.c);
  const last = closes[closes.length - 1];
  const risk = Math.abs(p.entry - p.stop);
  const reward = Math.abs(p.target - p.entry);
  const checks: Check[] = [];

  // Trend
  {
    const m50 = sma(closes, 50);
    const m200 = sma(closes, 200);
    const m21 = sma(closes, 21);
    const m21Before = sma(closes, 21, closes.length - 5);
    const tests: [boolean, string][] = [];
    if (!Number.isNaN(m50)) tests.push([long ? last > m50 : last < m50, `price ${last > m50 ? "above" : "below"} its 50-day average`]);
    if (!Number.isNaN(m50) && !Number.isNaN(m200)) tests.push([long ? m50 > m200 : m50 < m200, `the 50-day ${m50 > m200 ? "above" : "below"} the 200-day`]);
    if (!Number.isNaN(m21) && !Number.isNaN(m21Before)) tests.push([long ? m21 > m21Before : m21 < m21Before, `the 21-day ${m21 > m21Before ? "rising" : "falling"}`]);
    const ok = tests.filter((t) => t[0]).length;
    const score = tests.length ? Math.round((ok / tests.length) * 100) : null;
    const facts = tests.map((t) => t[1]).join(", ");
    checks.push({
      key: "trend",
      name: "Trend",
      weight: 20,
      score,
      text:
        score == null
          ? "Not enough history for the moving averages."
          : score >= 99
            ? `With the trend: ${facts}.`
            : score <= 1
              ? `Against the trend: ${facts}. Trading against it works less often.`
              : `Mixed: ${facts}.`,
    });
  }

  // Reward to risk (to two places, so a plan built at 2 to 1 isn't marked down for a cent of rounding)
  {
    const rr = Math.round((reward / risk) * 100) / 100;
    const score = rr >= 3 ? 100 : rr >= 2 ? 90 : rr >= 1.5 ? 70 : rr >= 1 ? 45 : 10;
    const need = Math.round((1 / (1 + rr)) * 100);
    checks.push({
      key: "rr",
      name: "Reward to risk",
      weight: 15,
      score,
      text: `${rr.toFixed(1)} to 1: you aim to make ${money(reward)} a share for every ${money(risk)} you risk, so it pays over time if it works more than ${need}% of the time.`,
    });
  }

  // Stop room
  {
    const a = atr(bars);
    const k = risk / a;
    const score = k < 0.75 ? 30 : k < 1 ? 60 : k <= 3 ? 100 : k <= 5 ? 70 : 40;
    checks.push({
      key: "stop",
      name: "Stop room",
      weight: 10,
      score: Number.isFinite(k) ? score : null,
      text: !Number.isFinite(k)
        ? "No daily ranges to measure."
        : k < 0.75
          ? `The stop is ${k.toFixed(1)}× a normal day's range (${money(a)}): an ordinary day can knock you out.`
          : k > 5
            ? `The stop is ${k.toFixed(1)}× a normal day's range (${money(a)}): very wide, so the size has to be small.`
            : `The stop is ${k.toFixed(1)}× a normal day's range (${money(a)}): room for normal swings.`,
    });
  }

  // Target reach
  {
    const vol = volatility(closes.slice(-61));
    const typical = p.entry * vol * Math.sqrt(Math.max(1, p.holdDays) / 252);
    const z = reward / typical;
    const score = z <= 0.75 ? 100 : z <= 1 ? 85 : z <= 1.5 ? 60 : z <= 2 ? 35 : 15;
    checks.push({
      key: "reach",
      name: "Target reach",
      weight: 20,
      score,
      text: `A typical move over ${p.holdDays} trading day${p.holdDays === 1 ? "" : "s"} is about ${money(typical)}; the target needs ${money(reward)} (${z.toFixed(1)}×). ${z > 1.5 ? "That's a big ask for the time." : z <= 1 ? "Reachable in an ordinary stretch." : "Possible, but it needs a good run."}`,
    });
  }

  // Option price
  if (p.instrument === "option") {
    const pct = volPercentile(closes);
    const score = pct == null ? null : pct <= 30 ? 100 : pct <= 60 ? 75 : pct <= 80 ? 50 : 25;
    checks.push({
      key: "iv",
      name: "Option price",
      weight: 10,
      score,
      text:
        pct == null
          ? "Not enough history to tell whether options are cheap or dear."
          : `The stock is swinging more than it has on ${pct}% of the past year's days${pct > 80 ? ", so options are likely expensive: a spread costs less" : pct <= 30 ? ", so options are likely cheap" : ""}. (Est. from price swings until live option data.)`,
    });
  }

  // Earnings
  {
    const end = p.instrument === "option" && p.expiry && p.expiry > p.planEnd ? p.expiry : p.planEnd;
    if (p.earnings === undefined) {
      checks.push({ key: "earnings", name: "Earnings", weight: 10, score: null, text: "Couldn't check the earnings date: look it up before you trade." });
    } else {
      const inside = p.earnings != null && p.earnings <= end;
      checks.push({
        key: "earnings",
        name: "Earnings",
        weight: 10,
        score: inside ? 25 : 100,
        text: inside
          ? `Earnings on ${shortDay(p.earnings!)}, inside the plan: the stock can gap past the stop${p.instrument === "option" ? ", and options lose value when the event is over (IV crush)" : ""}.`
          : p.earnings
            ? `Next earnings ${shortDay(p.earnings)}, after the plan ends.`
            : "No earnings date in the next 100 days.",
      });
    }
  }

  // Liquidity
  {
    const recent = bars.slice(-20);
    const dollars = avg(recent.map((b) => b.c * b.v));
    const score = dollars >= 5e8 ? 100 : dollars >= 1e8 ? 85 : dollars >= 2e7 ? 60 : 25;
    checks.push({
      key: "liquidity",
      name: "Liquidity",
      weight: 5,
      score: Number.isFinite(dollars) && dollars > 0 ? score : null,
      text: `About ${big(dollars)} trades a day.${dollars < 2e7 ? " Thin: wide spreads, and options may be hard to fill." : ""}`,
    });
  }

  // Size
  {
    let score: number | null = null;
    let text: string;
    if (p.budget == null) text = "Answer the three questions (account and risk) to check the size.";
    else if (p.sizeRisk == null || p.sizeRisk <= 0) text = `No size yet. Your rule allows ${money(p.budget)} at risk.`;
    else {
      const k = p.sizeRisk / p.budget;
      score = k <= 1 ? 100 : k <= 1.25 ? 70 : k <= 2 ? 35 : 0;
      text =
        k <= 1
          ? `Risks ${money(p.sizeRisk)}, inside your ${money(p.budget)} rule.`
          : `Risks ${money(p.sizeRisk)}, ${k.toFixed(1)}× your ${money(p.budget)} rule.${p.instrument === "option" ? " A bought option can lose its whole cost." : ""}`;
    }
    checks.push({ key: "size", name: "Size", weight: 10, score, text });
  }

  const scored = checks.filter((c) => c.score != null);
  const total = scored.reduce((a, c) => a + c.weight, 0);
  let score = Math.round(scored.reduce((a, c) => a + (c.score as number) * c.weight, 0) / total);
  let capped: string | null = null;
  const rr = reward / risk;
  const sizeK = p.budget && p.sizeRisk ? p.sizeRisk / p.budget : 0;
  if ((rr < 0.995 || sizeK > 1.5) && score > 57) {
    capped = rr < 0.995 ? "It risks more than it aims to make, so it can't grade above D." : "The size risks more than 1.5× your rule, so it can't grade above D.";
    score = 57;
  } else if (score >= 85 && scored.some((c) => (c.score as number) < 50)) {
    capped = `${scored.find((c) => (c.score as number) < 50)!.name} is weak, so it can't be an A.`;
    score = 84;
  }
  const letter = score >= 85 ? "A" : score >= 72 ? "B" : score >= 58 ? "C" : score >= 45 ? "D" : "F";
  return { letter, score, checks, capped };
}
