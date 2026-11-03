import { bs } from "@/lib/options/pricing";
import { asOption, contractName, type OptionIdea } from "@/lib/optionIdea";

// The trades a member took and their journal (Ben, 2026-11-03: "Yes: track + journal": "I took this" on any idea, then
// their open trades, results and a simple journal with notes, all private; table public.trades,
// supabase/migrations/20261103190000_trades.sql). A trade is shares, or option contracts of 100 shares as the idea
// suggested them. Prices are per share, as a broker shows them. An open option is marked at its estimated value now:
// the same Black-Scholes and the same volatility it was priced with (src/lib/optionIdea.ts), at the stock's live price,
// so it says "est." wherever it shows. Shared by the server and the browser: no database or network here.

export type Trade = {
  id: string;
  setup_id: string | null;
  ticker: string;
  direction: "long" | "short";
  instrument: "stock" | "option";
  option: unknown;
  entry_price: number;
  quantity: number;
  target: number | null;
  stop: number | null;
  opened_on: string;
  status: "open" | "closed";
  exit_price: number | null;
  closed_on: string | null;
  notes: string | null;
  alerted: "target" | "stop" | null;
};

export const TRADE_COLUMNS =
  "id, setup_id, ticker, direction, instrument, option, entry_price, quantity, target, stop, opened_on, status, exit_price, closed_on, notes, alerted";

/** Shares in one unit: 1 for a share, 100 for an option contract. */
export const unitSize = (t: Pick<Trade, "instrument">) => (t.instrument === "option" ? 100 : 1);

/** An option's (or a spread's) est. value per share with the stock at `spot` on `day` (YYYY-MM-DD), at the volatility it was priced with. */
export function optionValue(o: OptionIdea, spot: number, day: string) {
  const years = Math.max(0, (Date.parse(`${o.expiry}T21:00:00Z`) - Date.parse(`${day}T21:00:00Z`)) / (365 * 86_400_000));
  const type = o.kind === "call" || o.kind === "call_spread" ? "call" : "put";
  const bought = bs(type, spot, o.strike, years, o.vol);
  const sold = o.short != null ? bs(type, spot, o.short, years, o.vol) : 0;
  return Math.max(0, bought - sold);
}

/** What the trade is worth per share now: the stock's live price, or the option's est. value at it. Null without a live price. */
export function markOf(t: Trade, spot: number | null | undefined, day: string): { price: number; est: boolean } | null {
  if (spot == null) return null;
  if (t.instrument === "stock") return { price: spot, est: false };
  const o = asOption(t.option);
  return o ? { price: Math.round(optionValue(o, spot, day) * 100) / 100, est: true } : null;
}

/** Profit or loss at `price` per share (the exit, or the mark): dollars and percent. Short shares gain as the stock falls; an option is always bought, so it gains as it rises. */
export function pnl(t: Pick<Trade, "instrument" | "direction" | "entry_price" | "quantity">, price: number) {
  const sign = t.instrument === "stock" && t.direction === "short" ? -1 : 1;
  const per = (price - Number(t.entry_price)) * sign;
  return { dollars: per * Number(t.quantity) * unitSize(t), pct: (per / Number(t.entry_price)) * 100 };
}

/** "AAPL Nov 20 $230 call", or "AAPL shares". */
export function tradeName(t: Pick<Trade, "ticker" | "instrument" | "option">) {
  const o = t.instrument === "option" ? asOption(t.option) : null;
  return o ? contractName(t.ticker, o) : `${t.ticker} shares`;
}

/** How many, in words: "100 shares", "2 contracts". */
export function sizeLabel(t: Pick<Trade, "instrument" | "quantity">) {
  const n = Number(t.quantity);
  const q = Number.isInteger(n) ? n.toLocaleString("en-US") : n.toLocaleString("en-US", { maximumFractionDigits: 4 });
  return t.instrument === "option" ? `${q} contract${n === 1 ? "" : "s"}` : `${q} share${n === 1 ? "" : "s"}`;
}

/** The record over closed trades: how many, the wins, the win rate, and the money made or lost. */
export function record(trades: Trade[]) {
  const closed = trades.filter((t) => t.status === "closed" && t.exit_price != null);
  const results = closed.map((t) => pnl(t, Number(t.exit_price)).dollars);
  const wins = results.filter((d) => d > 0).length;
  return {
    closed: closed.length,
    wins,
    winRate: closed.length ? Math.round((wins / closed.length) * 100) : null,
    realized: results.reduce((s, d) => s + d, 0),
  };
}

/** The stock reached the trade's target or stop: which, for the stock at `spot`, or null. */
export function levelHit(t: Pick<Trade, "direction" | "target" | "stop">, spot: number): "target" | "stop" | null {
  const long = t.direction === "long";
  if (t.target != null && (long ? spot >= Number(t.target) : spot <= Number(t.target))) return "target";
  if (t.stop != null && (long ? spot <= Number(t.stop) : spot >= Number(t.stop))) return "stop";
  return null;
}

/** Today in New York, YYYY-MM-DD: the day a trade opens or closes on. */
export const nyToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());

export const money = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const signedMoney = (n: number) => `${n > 0 ? "+" : ""}${money(n)}`;
export const signedPct = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;
