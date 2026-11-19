// Trade ideas (Ben, 2026-11-02: "Need to make this all about TRADE IDEAS. The best way to get and evaluate trade
// ideas"): every idea lives in public.setups with its source and style (supabase/migrations/20261103000000_trade_ideas.sql).
// The AI's morning picks are the first source; the others arrive one by one, so the feed only offers the ones with ideas.

export const SOURCES = {
  // HighStrike's own strategies firing, with their record (src/lib/strategies/ideas.ts): the day's ideas, first.
  strategy: "Strategies",
  ai: "Scanner picks",
  flow: "Options flow",
  catalyst: "Catalysts",
  watchlist: "Your watchlist",
  pasted: "Pasted",
  builder: "Idea builder",
  member: "Members",
  pro: "Pro traders",
  planner: "Your plans",
} as const;
export type Source = keyof typeof SOURCES;

export const STYLES = { day: "Day trade", swing: "Swing", long: "Long-term" } as const;
export type Style = keyof typeof STYLES;

export const STATUS = {
  open: { label: "Open", tone: "neutral" },
  target_hit: { label: "Target hit", tone: "up" },
  stopped: { label: "Stopped", tone: "down" },
  expired: { label: "Expired", tone: "neutral" },
} as const;

export type Idea = {
  id: string;
  report_date: string;
  ticker: string;
  direction: "long" | "short";
  source: Source;
  style: Style;
  headline: string | null;
  justification: string;
  entry_criteria: string[];
  price_target: string;
  time_frame: string;
  status: keyof typeof STATUS;
  entry_price: number | null;
  target_price: number | null;
  current_pct: number | null;
  result_pct: number | null;
  /** The idea's own stop, when it has one (pasted ideas); else the grading's 8%. */
  stop_price: number | null;
  /** The option contract it names, like "190C 11/15 @ 2.4". */
  contract: string | null;
  /** The member it belongs to (pasted ideas); null for the house's shared ideas. */
  owner_id: string | null;
  /** Its option, estimated when it was made (src/lib/optionIdea.ts); read it through asOption. */
  option: unknown;
  /** For an idea from a strategy: the strategy and how it did on this stock before (src/lib/strategies/ideas.ts). */
  record: { strategy: string; name: string; trades: number; winRate: number; avg: number; basis: "option" | "stock"; since: string } | null;
};

/** "Won 58% of 31 trades since 2016, +17.6% a trade on the option". */
export const recordLine = (r: NonNullable<Idea["record"]>) =>
  `Won ${r.winRate}% of ${r.trades} trades since ${r.since}, ${r.avg > 0 ? "+" : ""}${r.avg}% a trade on the ${r.basis === "option" ? "option" : "shares"}`;

export const IDEA_COLUMNS =
  "id, report_date, ticker, direction, source, style, headline, justification, entry_criteria, price_target, time_frame, status, entry_price, target_price, current_pct, result_pct, stop_price, contract, owner_id, option, record";

/** The idea's one line: its headline, else the first sentence of its reasoning (ideas from before headlines). */
export const headlineOf = (i: Pick<Idea, "headline" | "justification">) => i.headline?.trim() || i.justification.split(/(?<=\.)\s/)[0];

/** The first day the feed shows: `days` back, as report dates are written. */
export const ideasSince = (days = 30) => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
