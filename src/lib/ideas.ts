// Trade ideas (Ben, 2026-11-02: "Need to make this all about TRADE IDEAS. The best way to get and evaluate trade
// ideas"): every idea lives in public.setups with its source and style (supabase/migrations/20261103000000_trade_ideas.sql).
// The AI's morning picks are the first source; the others arrive one by one, so the feed only offers the ones with ideas.

export const SOURCES = {
  ai: "AI picks",
  flow: "Options flow",
  catalyst: "Catalysts",
  watchlist: "Your watchlist",
  pasted: "Pasted",
  builder: "Idea builder",
  member: "Members",
  pro: "Pro traders",
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
};

export const IDEA_COLUMNS =
  "id, report_date, ticker, direction, source, style, headline, justification, entry_criteria, price_target, time_frame, status, entry_price, target_price, current_pct, result_pct";

/** The idea's one line: its headline, else the first sentence of its reasoning (ideas from before headlines). */
export const headlineOf = (i: Pick<Idea, "headline" | "justification">) => i.headline?.trim() || i.justification.split(/(?<=\.)\s/)[0];

/** The first day the feed shows: `days` back, as report dates are written. */
export const ideasSince = (days = 30) => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
