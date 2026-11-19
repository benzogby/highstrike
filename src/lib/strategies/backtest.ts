// The backtester (docs/plans/strategies.md): runs a strategy's rules over a stock's daily history and reports every
// trade it would have taken. Entries happen at the close of the bar where every entry rule is true; exits at the
// target or the stop (inside a bar, at that price, or at the open when it gaps through), at the close when an exit rule
// is true or the time limit is up, or at the option's expiry. The option is priced with Black-Scholes at the stock's
// own recent volatility (a stand-in for implied volatility, so marked "estimated" everywhere). Pure.

import type { Candle } from "@/lib/chart/types";
import { bs, normCdf, roundStrike, strikeStep, volatility, RATE } from "@/lib/options/pricing";
import { Calc, type Context, type Rules } from "./rules";

export type Trade = {
  entryT: string;
  exitT: string | null;
  entryPrice: number;
  exitPrice: number;
  reason: "target" | "stop" | "rule" | "time" | "expiry" | "open";
  /** The stock's move in the trade's favour, percent. */
  stockPct: number;
  option: { type: "call" | "put"; strike: number; expiry: string; entry: number; exit: number; pct: number } | null;
  bars: number;
};

export type Result = {
  trades: Trade[];
  stats: {
    count: number;
    wins: number;
    winRate: number | null;
    avgWin: number | null;
    avgLoss: number | null;
    /** Average result per trade, percent. */
    expectancy: number | null;
    /** Dollars made with $1,000 in each trade. */
    totalDollars: number;
    maxDrawdown: number;
    avgBars: number | null;
  };
  /** Running total of dollars (at $1,000 a trade), one point per closed trade. */
  equity: { t: string; v: number }[];
  /** On the option when the strategy has one, else on the shares. */
  basis: "option" | "stock";
  from: string;
  to: string;
};

/** A premium over the stock's own volatility, since options usually price above what the stock has been doing. */
const IV_PREMIUM = 1.1;
const ivAt = (closes: number[], i: number) => volatility(closes.slice(Math.max(0, i - 20), i + 1)) * IV_PREMIUM;
const days = (a: string, b: string) => (Date.parse(`${b.slice(0, 10)}T12:00:00Z`) - Date.parse(`${a.slice(0, 10)}T12:00:00Z`)) / 86_400_000;
const addDays = (t: string, n: number) => new Date(Date.parse(`${t.slice(0, 10)}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** The listed-style strike whose delta is nearest the one asked for. */
function strikeFor(type: "call" | "put", S: number, T: number, v: number, delta: number) {
  const step = strikeStep(S);
  let best = roundStrike(S, step);
  let gap = Infinity;
  for (let k = -40; k <= 40; k++) {
    const K = roundStrike(S, step) + k * step;
    if (K <= 0) continue;
    const d1 = (Math.log(S / K) + (RATE + (v * v) / 2) * T) / (v * Math.sqrt(T));
    const d = type === "call" ? normCdf(d1) : 1 - normCdf(d1);
    if (Math.abs(d - delta) < gap) {
      gap = Math.abs(d - delta);
      best = K;
    }
  }
  return best;
}

export function backtest(bars: Candle[], rules: Rules, ctx: Context = {}): Result {
  const calc = new Calc(bars, ctx);
  const closes = bars.map((b) => b.c);
  const long = rules.direction === "long";
  const type: "call" | "put" = long ? "call" : "put";
  const trades: Trade[] = [];

  let i = 1;
  while (i < bars.length) {
    if (!calc.all(rules.entry, i)) {
      i++;
      continue;
    }
    // Enter at this bar's close.
    const e = bars[i];
    const entry = e.c;
    const target = rules.targetPct ? entry * (1 + ((long ? 1 : -1) * rules.targetPct) / 100) : null;
    const stop = rules.stopPct ? entry * (1 - ((long ? 1 : -1) * rules.stopPct) / 100) : null;
    let opt: { strike: number; expiry: string; entry: number } | null = null;
    if (rules.option) {
      const v = ivAt(closes, i);
      const T = rules.option.dte / 365;
      const strike = strikeFor(type, entry, T, v, rules.option.delta);
      opt = { strike, expiry: addDays(e.t, rules.option.dte), entry: Math.max(0.05, bs(type, entry, strike, T, v)) };
    }

    let exitAt = -1;
    let exitPrice = entry;
    let reason: Trade["reason"] = "open";
    for (let j = i + 1; j < bars.length; j++) {
      const b = bars[j];
      // The stop first when a bar touches both (the cautious reading).
      if (stop != null && (long ? b.l <= stop : b.h >= stop)) {
        exitAt = j;
        exitPrice = long ? Math.min(b.o, stop) : Math.max(b.o, stop);
        reason = "stop";
        break;
      }
      if (target != null && (long ? b.h >= target : b.l <= target)) {
        exitAt = j;
        exitPrice = long ? Math.max(b.o, target) : Math.min(b.o, target);
        reason = "target";
        break;
      }
      if (opt && b.t.slice(0, 10) >= opt.expiry) {
        exitAt = j;
        exitPrice = b.c;
        reason = "expiry";
        break;
      }
      if (calc.any(rules.exit, j)) {
        exitAt = j;
        exitPrice = b.c;
        reason = "rule";
        break;
      }
      if (rules.maxDays && j - i >= rules.maxDays) {
        exitAt = j;
        exitPrice = b.c;
        reason = "time";
        break;
      }
    }
    const end = exitAt >= 0 ? exitAt : bars.length - 1;
    if (exitAt < 0) exitPrice = bars[end].c;
    const stockPct = ((exitPrice - entry) / entry) * 100 * (long ? 1 : -1);
    let option: Trade["option"] = null;
    if (opt) {
      const T = Math.max(0, days(bars[end].t, opt.expiry)) / 365;
      const exitOpt = Math.max(0, bs(type, exitPrice, opt.strike, T, ivAt(closes, end)));
      option = { type, strike: opt.strike, expiry: opt.expiry, entry: round(opt.entry), exit: round(exitOpt), pct: ((exitOpt - opt.entry) / opt.entry) * 100 };
    }
    trades.push({ entryT: e.t, exitT: exitAt >= 0 ? bars[end].t : null, entryPrice: round(entry), exitPrice: round(exitPrice), reason, stockPct, option, bars: end - i });
    // The next trade can start after this one ends.
    i = exitAt >= 0 ? exitAt + 1 : bars.length;
  }

  const basis: Result["basis"] = rules.option ? "option" : "stock";
  const pctOf = (t: Trade) => (basis === "option" && t.option ? t.option.pct : t.stockPct);
  const closed = trades.filter((t) => t.reason !== "open");
  const wins = closed.filter((t) => pctOf(t) > 0);
  const losses = closed.filter((t) => pctOf(t) <= 0);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  let run = 0;
  let peak = 0;
  let dd = 0;
  const equity: Result["equity"] = [];
  for (const t of closed) {
    run += pctOf(t) * 10; // $1,000 a trade
    peak = Math.max(peak, run);
    dd = Math.max(dd, peak - run);
    equity.push({ t: t.exitT!, v: Math.round(run) });
  }
  return {
    trades,
    stats: {
      count: closed.length,
      wins: wins.length,
      winRate: closed.length ? Math.round((wins.length / closed.length) * 1000) / 10 : null,
      avgWin: avg(wins.map(pctOf)),
      avgLoss: avg(losses.map(pctOf)),
      expectancy: avg(closed.map(pctOf)),
      totalDollars: Math.round(run),
      maxDrawdown: Math.round(dd),
      avgBars: avg(closed.map((t) => t.bars)),
    },
    equity,
    basis,
    from: bars[0]?.t ?? "",
    to: bars[bars.length - 1]?.t ?? "",
  };
}

const round = (n: number) => Math.round(n * 100) / 100;
