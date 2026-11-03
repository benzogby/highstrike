import type { EnrichedRow } from "@/lib/setupEngine";
import type { Style } from "@/lib/ideas";

// The idea builder (piece 4 of the trade-ideas plan, Ben 2026-11-02, built without AI: "Do this all without AI APIs"):
// the member says what kind of trade they want, and these rules find the names in the scanner's universe that fit right
// now, each turned into an idea with an entry, a target and a stop, and the reasons it matched. Pure; the page loads
// the scan (src/lib/setupEngine.ts → enrichedScan).

export type Want = {
  side: "long" | "short" | "any";
  style: Style;
  /** momentum: with the trend; pullback: a dip inside a trend; reversal: a stretched move turning; any. */
  setup: "momentum" | "pullback" | "reversal" | "any";
  /** Only stocks at or under this price (smaller accounts), or none. */
  maxPrice: number | null;
  insiders: "buying" | "any";
  crowd: "with" | "against" | "any";
};

export const SETUPS = {
  any: "Any setup",
  momentum: "Riding the trend",
  pullback: "Buying the dip in a trend",
  reversal: "A stretched move turning",
} as const;

/** Target and stop by style, both from the entry: every built idea risks half what it aims to make. */
export const PLAN: Record<Style, { target: number; stop: number; timeFrame: string; days: number }> = {
  day: { target: 3, stop: 1.5, timeFrame: "Today", days: 0 },
  swing: { target: 8, stop: 4, timeFrame: "1-2 weeks", days: 14 },
  long: { target: 15, stop: 7.5, timeFrame: "1-3 months", days: 60 },
};

export type Built = {
  ticker: string;
  name: string;
  direction: "long" | "short";
  style: Style;
  price: number;
  target: number;
  stop: number;
  timeFrame: string;
  /** Why it matched, in plain words. */
  reasons: string[];
  /** How strongly it fits, 0-100, for the order. */
  fit: number;
};

const pct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
const big = (n: number) => (n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : `$${Math.round(n / 1e3)}K`);

/** One name, one side: whether it fits what the member wants, and why. Null when it doesn't. */
function fits(r: EnrichedRow, side: "long" | "short", w: Want): Built | null {
  const up = side === "long";
  const reasons: string[] = [];
  const trend = r.mom5d;
  const today = r.changePct;
  const range = r.rangePos;
  if (w.maxPrice != null && r.price > w.maxPrice) return null;

  if (w.setup === "momentum" || w.setup === "any") {
    const withTrend = trend != null && (up ? trend > 1 : trend < -1);
    const withToday = up ? today > 0 : today < 0;
    if (w.setup === "momentum" && !(withTrend && withToday)) return null;
    if (withTrend) reasons.push(`${pct(trend!)} over 5 sessions, ${up ? "up" : "down"}trending`);
    if (withToday) reasons.push(`${pct(today)} today, the same way`);
  }
  if (w.setup === "pullback") {
    const trendOk = trend != null && (up ? trend > 2 : trend < -2);
    const dip = up ? today < -0.3 : today > 0.3;
    if (!(trendOk && dip)) return null;
    reasons.push(`${pct(trend!)} over 5 sessions, but ${up ? "pulling back" : "bouncing"} today (${pct(today)})`);
  }
  if (w.setup === "reversal") {
    const stretched = trend != null && (up ? trend <= -5 : trend >= 5);
    const turning = up ? today > 0.5 : today < -0.5;
    if (!(stretched && turning)) return null;
    reasons.push(`${pct(trend!)} over 5 sessions, now turning ${up ? "up" : "down"} (${pct(today)} today)`);
  }
  if (w.setup !== "pullback" && range != null && (up ? range >= 0.7 : range <= 0.3)) reasons.push(`Trading near the day's ${up ? "high" : "low"}`);
  if (w.style === "day" && Math.abs(today) < 1) return null;
  if (w.style === "day") reasons.push(`Moving ${Math.abs(today).toFixed(1)}% today, enough for a day trade`);

  if (w.insiders === "buying") {
    if (r.insBuyers === 0) return null;
    reasons.push(`${r.insBuyers} insider${r.insBuyers === 1 ? "" : "s"} bought in 14 days${r.insBuyValue > 0 ? ` (${big(r.insBuyValue)})` : ""}`);
  }
  const lean = r.chatterBullishPct;
  if (w.crowd !== "any") {
    if (lean == null) return null;
    const agrees = up ? lean >= 60 : lean <= 40;
    const disagrees = up ? lean <= 40 : lean >= 60;
    if (w.crowd === "with" ? !agrees : !disagrees) return null;
    reasons.push(`The crowd is ${lean}% bullish${w.crowd === "against" ? ", against the trade" : ""}`);
  }

  const lean100 = up ? r.score : 100 - r.score;
  if (w.setup === "any" && lean100 < 55) return null;
  if (reasons.length === 0) return null;
  const plan = PLAN[w.style];
  const k = up ? 1 : -1;
  return {
    ticker: r.ticker,
    name: r.name,
    direction: side,
    style: w.style,
    price: r.price,
    target: +(r.price * (1 + (k * plan.target) / 100)).toFixed(2),
    stop: +(r.price * (1 - (k * plan.stop) / 100)).toFixed(2),
    timeFrame: plan.timeFrame,
    reasons,
    fit: Math.max(0, Math.min(100, Math.round(lean100 + reasons.length * 4 + (r.insBuyers > 0 && up ? 6 : 0)))),
  };
}

/** The ten best fits for what the member wants, strongest first, at most one side per name. */
export function buildIdeas(rows: EnrichedRow[], w: Want, limit = 10): Built[] {
  const out: Built[] = [];
  for (const r of rows) {
    if (!r.live || !(r.price > 0)) continue;
    const sides: ("long" | "short")[] = w.side === "any" ? ["long", "short"] : [w.side];
    const best = sides
      .map((s) => fits(r, s, w))
      .filter((b): b is Built => b != null)
      .sort((a, b) => b.fit - a.fit)[0];
    if (best) out.push(best);
  }
  return out.sort((a, b) => b.fit - a.fit).slice(0, limit);
}
