import { asOption, type OptionIdea } from "./optionIdea";
import type { Idea, Style } from "./ideas";

// The member's three answers (docs/plans/offer-overhaul.md item 3, Ben 2026-11-17: "3 questions → today's best idea,
// sized for them"): account size, risk per trade and style, saved on their profile (supabase/migrations/
// 20261118000000_trading_profile.sql). Sizing is a rule, never advice: the most one trade may lose is the account times
// the risk %. A bought option can lose its whole cost, so it sizes on that cost; shares size on the distance to the stop.

export type TradingProfile = { account: number; riskPct: number; style: Style };

export const ACCOUNT_CHOICES = [1_000, 2_500, 5_000, 10_000, 25_000, 50_000];
export const RISK_CHOICES = [0.5, 1, 2, 3];
export const STYLE_CHOICES: { key: Style; title: string; body: string }[] = [
  { key: "day", title: "Day trades", body: "In and out the same day. Needs you at the screen." },
  { key: "swing", title: "Swing trades", body: "A few days to a few weeks. Check in once or twice a day." },
  { key: "long", title: "Longer holds", body: "One to three months. The least screen time." },
];

/** The saved answers, or null until all three are in. */
export function profileOf(p: { account_size?: unknown; risk_pct?: unknown; trade_style?: unknown } | null | undefined): TradingProfile | null {
  const account = Number(p?.account_size);
  const riskPct = Number(p?.risk_pct);
  const style = p?.trade_style;
  if (!(account > 0) || !(riskPct > 0) || (style !== "day" && style !== "swing" && style !== "long")) return null;
  return { account, riskPct, style };
}

export const riskBudget = (p: TradingProfile) => Math.round(p.account * p.riskPct) / 100;

export const usd = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: n >= 100 ? 0 : 2, minimumFractionDigits: n >= 100 || n % 1 === 0 ? 0 : 2 })}`;

/** The idea's stop: its own, else the grading's 8% against it. */
export const stopOf = (i: Pick<Idea, "stop_price" | "entry_price" | "direction">) =>
  i.stop_price != null ? Number(i.stop_price) : i.entry_price != null ? +(i.entry_price * (i.direction === "long" ? 0.92 : 1.08)).toFixed(2) : null;

export type Sizing = {
  budget: number;
  option: OptionIdea | null;
  /** Contracts whose whole cost fits the budget, and one contract's cost. */
  contracts: number;
  contractCost: number | null;
  /** Shares whose loss at the stop fits the budget (and whose cost fits the account). */
  shares: number;
  stop: number | null;
  /** What the size risks, in dollars and as a share of the account. */
  risk: number;
  /** "option" when at least one contract fits the rule, else "shares". */
  use: "option" | "shares";
};

export function sizeFor(idea: Idea, p: TradingProfile): Sizing {
  const budget = riskBudget(p);
  const option = asOption(idea.option);
  const contractCost = option ? Math.round(option.premium * 100 * 100) / 100 : null;
  const contracts = contractCost ? Math.floor(budget / contractCost) : 0;
  const stop = stopOf(idea);
  const entry = idea.entry_price;
  const perShare = entry != null && stop != null ? Math.abs(entry - stop) : 0;
  const shares = perShare > 0 && entry ? Math.max(0, Math.min(Math.floor(budget / perShare), Math.floor(p.account / entry))) : 0;
  const use = contracts >= 1 ? "option" : "shares";
  const risk = use === "option" ? contracts * (contractCost ?? 0) : Math.round(shares * perShare * 100) / 100;
  return { budget, option, contracts, contractCost, shares, stop, risk, use };
}

/**
 * Today's best idea for these answers, by rule, from the house's open ideas of the last three mornings: the member's
 * style first, then one whose option fits their risk (else whose shares do), then the newest morning, then the scanner's
 * score. Returns the pick and the next two.
 */
export function pickFor(ideas: (Idea & { flow_score?: number | null })[], p: TradingProfile) {
  const days = [...new Set(ideas.map((i) => i.report_date))].sort().reverse().slice(0, 3);
  const pool = ideas.filter((i) => days.includes(i.report_date) && i.entry_price != null);
  const ranked = pool
    .map((i) => {
      const s = sizeFor(i, p);
      const fit = s.use === "option" ? 500 : s.shares > 0 ? 300 : 0;
      const score = (i.style === p.style ? 1000 : 0) + fit - 150 * days.indexOf(i.report_date) + Number(i.flow_score ?? 0);
      return { idea: i, sizing: s, score };
    })
    .sort((a, b) => b.score - a.score);
  return { pick: ranked[0] ? { ...ranked[0], pool: ranked.length } : null, more: ranked.slice(1, 3), styleMatched: ranked[0]?.idea.style === p.style };
}
