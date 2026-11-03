import { STRUCTURES, type Bias, type Structure } from "./cards";

// Taste (step 4 of the swipe app; Ben 2026-11-02: "Your rights and lefts tune which setups you see first (by rules:
// side, style, risk)"): what share of each kind of card a member swipes right on, by the kind of trade, its side, how
// long it runs, how much it risks and how likely it is to pay, then each new card weighted by how well it matches. It
// starts after ten swipes, and never stops showing the rest: a card that matches badly still comes up, just less. Pure.

type Features = { structure: Structure; bias: Bias; dte: number; max_loss: number; pop: number };

/** The traits a member's taste is learned on, as keys like "kind:credit" or "risk:<500". */
export function traits(c: Features): string[] {
  const kind = STRUCTURES[c.structure]?.kind ?? "single";
  const dte = Number(c.dte);
  const loss = Number(c.max_loss);
  const pop = Number(c.pop);
  return [
    `kind:${kind}`,
    `side:${c.bias}`,
    `time:${dte <= 10 ? "week" : dte <= 25 ? "weeks" : dte <= 40 ? "month" : "months"}`,
    `risk:${loss < 200 ? "<200" : loss < 500 ? "<500" : loss < 1000 ? "<1000" : "1000+"}`,
    `odds:${pop < 0.35 ? "long shot" : pop < 0.6 ? "coin flip" : "likely"}`,
  ];
}

export type Taste = { swipes: number; rate: Map<string, { right: number; total: number }> };

/** The member's taste from their swipes, newest first (the last 300 count). */
export function learnTaste(swipes: { action: string; card: Features }[]): Taste {
  const rate = new Map<string, { right: number; total: number }>();
  for (const s of swipes.slice(0, 300)) {
    for (const t of traits(s.card)) {
      const r = rate.get(t) ?? { right: 0, total: 0 };
      r.total++;
      if (s.action === "right") r.right++;
      rate.set(t, r);
    }
  }
  return { swipes: Math.min(300, swipes.length), rate };
}

/**
 * How much more (or less) often to show a card: 1 until ten swipes, then the average of its traits' right-swipe rates
 * (each smoothed toward the member's overall rate) against that overall rate, kept between 0.35× and 3×.
 */
export function tasteWeight(t: Taste, c: Features) {
  if (t.swipes < 10) return 1;
  let rights = 0;
  let total = 0;
  for (const [k, r] of t.rate) {
    if (!k.startsWith("kind:")) continue;
    rights += r.right;
    total += r.total;
  }
  const base = (rights + 1) / (total + 2);
  const scores = traits(c).map((k) => {
    const r = t.rate.get(k) ?? { right: 0, total: 0 };
    // Smoothed: a trait seen a few times leans on the overall rate (as if five average swipes were added).
    return (r.right + 5 * base) / (r.total + 5) / base;
  });
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  return Math.max(0.35, Math.min(3, avg ** 2));
}

/** What a trait means, for "Showing you more …" */
export function traitLabel(key: string) {
  const [k, v] = key.split(":");
  if (k === "kind") return { single: "single calls and puts", debit: "debit spreads", credit: "credit spreads", condor: "iron condors" }[v] ?? v;
  if (k === "side") return { bull: "bullish setups", bear: "bearish setups", neutral: "neutral setups" }[v] ?? v;
  if (k === "time") return { week: "trades under 10 days", weeks: "2-3 week trades", month: "monthly trades", months: "longer trades" }[v] ?? v;
  if (k === "risk") return v === "1000+" ? "bigger trades" : `trades risking under $${v.slice(1)}`;
  return `${v} odds`;
}

/** The traits a member swipes right on most (at least five swipes, well above their usual rate), best first. */
export function favorites(t: Taste, n = 2) {
  if (t.swipes < 10) return [];
  let rights = 0;
  let total = 0;
  for (const [k, r] of t.rate) {
    if (!k.startsWith("kind:")) continue;
    rights += r.right;
    total += r.total;
  }
  const base = rights / Math.max(1, total);
  return [...t.rate.entries()]
    .filter(([, r]) => r.total >= 5 && r.right / r.total >= base + 0.15)
    .sort((a, b) => b[1].right / b[1].total - a[1].right / a[1].total)
    .slice(0, n)
    .map(([k]) => traitLabel(k));
}
