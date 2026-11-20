// The backtester (docs/plans/strategies.md): runs a strategy (spec.ts) over a stock's daily history and reports every
// trade it would have taken.
// - Entry at the close of a bar where every entry criterion and custom rule is true.
// - The contract by its rule: a call (a put when bearish) or a debit spread of them, at the expiry nearest (or first at
//   least) its days out — listed options expire on Fridays — and the strike nearest its delta, a percent from the
//   price, or at the money; or shares. Sized by contracts, dollars or a percent of the $25,000 account.
// - Each later bar, the stop group, then the exit group: "any" fires when one of its checks is true, "all" when every
//   one is. In "any", a stock-move level is caught inside the bar at that price (or the open when it gaps through);
//   otherwise checks are at the close. The option is closed at its expiry if nothing came first.
// - Options are priced with Black-Scholes at the stock's own recent volatility (a stand-in for implied volatility,
//   so "estimated" everywhere). Pure.

import type { Candle } from "@/lib/chart/types";
import { bs, roundStrike, strikeStep, volatility } from "@/lib/options/pricing";
import { Calc, type Context } from "./rules";
import { ACCOUNT, checksOf, type Check, type Exits, type Spec } from "./spec";

export type Trade = {
  entryT: string;
  exitT: string | null;
  entryPrice: number;
  exitPrice: number;
  reason: "exit" | "stop" | "expiry" | "open";
  /** Which checks fired, in words. */
  why: string;
  /** The stock's move in the trade's favour, percent. */
  stockPct: number;
  option: { type: "call" | "put"; strike: number; short: number | null; expiry: string; entry: number; exit: number; pct: number } | null;
  qty: number;
  /** Profit or loss in dollars, and as a percent of what it cost. */
  dollars: number;
  pct: number;
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
    totalDollars: number;
    avgDollars: number | null;
    maxDrawdown: number;
    avgBars: number | null;
  };
  /** Running total of dollars, one point per closed trade. */
  equity: { t: string; v: number }[];
  basis: "option" | "spread" | "stock";
  /** Daily bars tested. */
  barCount: number;
  from: string;
  to: string;
};

const IV_PREMIUM = 1.1;
const ivAt = (closes: number[], i: number) => volatility(closes.slice(Math.max(0, i - 20), i + 1)) * IV_PREMIUM;
const dayMs = 86_400_000;
const at = (t: string) => Date.parse(`${t.slice(0, 10)}T12:00:00Z`);
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const round = (n: number) => Math.round(n * 100) / 100;

/** The listed-style expiry (a Friday) nearest to, or first at least, `dte` days after `from`. */
export function expiryFor(from: string, dte: number, rule: "nearest" | "atLeast") {
  const target = at(from) + dte * dayMs;
  const d = new Date(target);
  const toFri = (5 - d.getUTCDay() + 7) % 7;
  const after = target + toFri * dayMs;
  const before = after - 7 * dayMs;
  if (rule === "atLeast" || before <= at(from)) return iso(after);
  return iso(target - before <= after - target ? before : after);
}

/** The strike the contract rule picks: a percent from the price, at a listed-style strike. */
function pickStrike(spec: Spec, type: "call" | "put", S: number) {
  return roundStrike(S * (1 + ((type === "call" ? 1 : -1) * spec.contract.strike.pct) / 100), strikeStep(S));
}

/** Whether a group (stop or exit) fires on bar j, and the price it fires at. */
export function groupFires(
  g: Exits,
  checks: Check[],
  calc: Calc,
  j: number,
  s: { long: boolean; entry: number; bar: Candle; optPct: number | null; dollars: number; days: number; dte: number | null; positive: boolean }
): { price: number; why: string } | null {
  if (!checks.length) return null;
  const close = s.bar.c;
  const fav = (p: number) => ((p - s.entry) / s.entry) * 100 * (s.long ? 1 : -1);
  let levelPrice: number | null = null;
  const results = checks.map((k) => {
    if ("cond" in k) return calc.holds(k.cond, j);
    const want = k.value;
    switch (k.trade) {
      case "stockPct": {
        // In "any", the level is caught inside the bar.
        if (g.mode === "any") {
          const extreme = want >= 0 ? (s.long ? s.bar.h : s.bar.l) : s.long ? s.bar.l : s.bar.h;
          if (want >= 0 ? fav(extreme) >= want : fav(extreme) <= want) {
            const level = s.entry * (1 + ((s.long ? 1 : -1) * want) / 100);
            const gapped = want >= 0 ? fav(s.bar.o) >= want : fav(s.bar.o) <= want;
            levelPrice = gapped ? s.bar.o : level;
            return true;
          }
          return false;
        }
        return want >= 0 ? fav(close) >= want : fav(close) <= want;
      }
      case "optionPct":
        return s.optPct != null && (want >= 0 ? s.optPct >= want : s.optPct <= want);
      case "dollars":
        return want >= 0 ? s.dollars >= want : s.dollars <= want;
      case "days":
        return s.days >= want;
      case "dte":
        return s.dte != null && s.dte <= want;
    }
  });
  const fired = g.mode === "any" ? results.some(Boolean) : results.every(Boolean);
  if (!fired) return null;
  const why = checks
    .map((k, n) => (results[n] ? k : null))
    .filter(Boolean)
    .map((k) => ("cond" in k! ? "rule" : k!.trade))
    .join(", ");
  return { price: g.mode === "any" && levelPrice != null ? levelPrice : close, why };
}

/** The backtest periods a member can pick (Ben, 2026-11-19: "set the backtest period with a dropdown"). */
export const PERIODS = [
  ["3m", "Past 3 months"],
  ["6m", "Past 6 months"],
  ["ytd", "Year to date"],
  ["1y", "Past year"],
  ["2y", "Past 2 years"],
  ["3y", "Past 3 years"],
  ["5y", "Past 5 years"],
  ["all", "All (since 2016)"],
] as const;
export type Period = (typeof PERIODS)[number][0];

/** The first day a period covers, as of `today`; null for all of it. */
export function periodStart(p: Period, today: string): string | null {
  if (p === "all") return null;
  if (p === "ytd") return `${today.slice(0, 4)}-01-01`;
  const months = { "3m": 3, "6m": 6, "1y": 12, "2y": 24, "3y": 36, "5y": 60 }[p];
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString().slice(0, 10);
}

/**
 * `from`: only take trades that enter on or after this day. The bars before it still count for the indicators (a
 * 200-day average is ready on the first day of the period).
 */
export function backtest(bars: Candle[], spec: Spec, ctx: Context = {}, from: string | null = null): Result {
  const calc = new Calc(bars, ctx);
  const closes = bars.map((b) => b.c);
  const long = spec.direction === "long";
  const type: "call" | "put" = long ? "call" : "put";
  const ct = spec.contract;
  const basis: Result["basis"] = ct.kind === "shares" ? "stock" : ct.kind === "spread" ? "spread" : "option";
  const entryChecks = checksOf(spec.entry).flatMap((k) => ("cond" in k ? [k.cond] : []));
  const exitChecks = checksOf(spec.exit);
  const stopChecks = checksOf(spec.stop);
  const trades: Trade[] = [];

  const valueAt = (leg: { strike: number; short: number | null; expiry: string } | null, S: number, t: string, i: number) => {
    if (!leg) return S;
    const T = Math.max(0, (at(leg.expiry) - at(t)) / dayMs) / 365;
    const v = ivAt(closes, i);
    const a = bs(type, S, leg.strike, T, v);
    return leg.short != null ? Math.max(0, a - bs(type, S, leg.short, T, v)) : a;
  };

  // The first bar a trade can enter on (none when the period starts after the last bar).
  const at0 = from ? bars.findIndex((b) => b.t.slice(0, 10) >= from) : 1;
  const first = at0 < 0 ? bars.length : Math.max(1, at0);
  let i = first;
  while (i < bars.length) {
    if (!entryChecks.length || !entryChecks.every((c) => calc.holds(c, i))) {
      i++;
      continue;
    }
    const e = bars[i];
    const S0 = e.c;
    let leg: { strike: number; short: number | null; expiry: string } | null = null;
    if (ct.kind !== "shares") {
      const expiry = expiryFor(e.t, ct.dte, ct.expiryRule);
      const strike = pickStrike(spec, type, S0);
      const step = strikeStep(S0);
      leg = { strike, short: ct.kind === "spread" ? strike + (type === "call" ? 1 : -1) * ct.width * step : null, expiry };
    }
    const entryVal = Math.max(leg ? 0.05 : 0.01, valueAt(leg, S0, e.t, i));
    const mult = leg ? 100 : 1;
    const each = entryVal * mult;
    const qty = Math.max(1, ct.size.by === "contracts" ? ct.size.value : Math.floor((ct.size.by === "dollars" ? ct.size.value : (ACCOUNT * ct.size.value) / 100) / each));

    let exitAt = -1;
    let exitPrice = S0;
    let reason: Trade["reason"] = "open";
    let why = "";
    for (let j = i + 1; j < bars.length; j++) {
      const b = bars[j];
      const val = valueAt(leg, b.c, b.t, j);
      const st = {
        long,
        entry: S0,
        bar: b,
        optPct: leg ? ((val - entryVal) / entryVal) * 100 : null,
        dollars: (val - entryVal) * qty * mult,
        days: j - i,
        dte: leg ? (at(leg.expiry) - at(b.t)) / dayMs : null,
        positive: val >= entryVal,
      };
      // The stop first (the cautious reading when both happen in a bar).
      const stop = groupFires(spec.stop, stopChecks, calc, j, st);
      if (stop) {
        [exitAt, exitPrice, reason, why] = [j, stop.price, "stop", stop.why];
        break;
      }
      const ex = groupFires(spec.exit, exitChecks, calc, j, st);
      if (ex) {
        [exitAt, exitPrice, reason, why] = [j, ex.price, "exit", ex.why];
        break;
      }
      if (leg && b.t.slice(0, 10) >= leg.expiry) {
        [exitAt, exitPrice, reason, why] = [j, b.c, "expiry", "expiry"];
        break;
      }
    }
    const end = exitAt >= 0 ? exitAt : bars.length - 1;
    if (exitAt < 0) exitPrice = bars[end].c;
    const exitVal = valueAt(leg, exitPrice, bars[end].t, end);
    const dollars = (exitVal - entryVal) * qty * mult;
    const stockPct = ((exitPrice - S0) / S0) * 100 * (long ? 1 : -1);
    const pct = leg ? ((exitVal - entryVal) / entryVal) * 100 : stockPct;
    trades.push({
      entryT: e.t,
      exitT: exitAt >= 0 ? bars[end].t : null,
      entryPrice: round(S0),
      exitPrice: round(exitPrice),
      reason,
      why,
      stockPct,
      option: leg ? { type, strike: leg.strike, short: leg.short, expiry: leg.expiry, entry: round(entryVal), exit: round(exitVal), pct } : null,
      qty,
      dollars: Math.round(dollars),
      pct,
      bars: end - i,
    });
    i = exitAt >= 0 ? exitAt + 1 : bars.length;
  }

  const closed = trades.filter((t) => t.reason !== "open");
  const wins = closed.filter((t) => t.dollars > 0);
  const losses = closed.filter((t) => t.dollars <= 0);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  let run = 0;
  let peak = 0;
  let dd = 0;
  const equity: Result["equity"] = [];
  for (const t of closed) {
    run += t.dollars;
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
      avgWin: avg(wins.map((t) => t.pct)),
      avgLoss: avg(losses.map((t) => t.pct)),
      expectancy: avg(closed.map((t) => t.pct)),
      totalDollars: Math.round(run),
      avgDollars: avg(closed.map((t) => t.dollars)),
      maxDrawdown: Math.round(dd),
      avgBars: avg(closed.map((t) => t.bars)),
    },
    equity,
    basis,
    barCount: Math.max(0, bars.length - first + 1),
    from: (from ?? bars[0]?.t ?? "").slice(0, 10),
    to: bars[bars.length - 1]?.t ?? "",
  };
}
