// Strategies (Ben, 2026-11-19, docs/plans/strategies.md): a strategy is entry and exit rules (indicators, price action,
// volume), built from blocks — IF this AND that THEN enter — plus a target, a stop, a time limit and the option it
// trades. Pure: the same code runs the backtest (src/lib/strategies/backtest.ts), the editor's wording and, later, the
// live checks. No AI anywhere.

import type { Candle } from "@/lib/chart/types";

// ---- What a rule can look at ----------------------------------------------------------------------------------------

export type Operand =
  | { kind: "close" | "open" | "high" | "low" }
  | { kind: "sma" | "ema"; n: number }
  | { kind: "rsi"; n: number }
  | { kind: "macd" | "macdSignal" | "macdHist" }
  | { kind: "bbUpper" | "bbLower"; n: number }
  | { kind: "volume" }
  | { kind: "volumeAvg"; n: number }
  | { kind: "highest" | "lowest"; n: number }
  | { kind: "change"; n: number }
  | { kind: "gap" }
  | { kind: "value"; value: number };

export type Op = "above" | "below" | "crossesAbove" | "crossesBelow";

export type Condition = { left: Operand; op: Op; right: Operand };

export type Rules = {
  direction: "long" | "short";
  /** Every one must be true at a bar's close to enter. */
  entry: Condition[];
  /** Any one true at a bar's close exits (besides the target, the stop and the time limit). */
  exit: Condition[];
  /** Percent moves in the stock, from the entry: take profit, cut the loss. */
  targetPct: number | null;
  stopPct: number | null;
  /** Trading days at most. */
  maxDays: number | null;
  /** The option it trades: a call when long, a put when short, this many days out, nearest this delta. */
  option: { dte: number; delta: number } | null;
};

export type OperandKind = Operand["kind"];

/** The blocks the editor offers, in order, with their default settings. */
export const OPERANDS: { kind: OperandKind; label: string; params?: ("n" | "value")[]; def: Operand; group: string }[] = [
  { kind: "close", label: "Price", def: { kind: "close" }, group: "Price" },
  { kind: "open", label: "Open", def: { kind: "open" }, group: "Price" },
  { kind: "high", label: "High", def: { kind: "high" }, group: "Price" },
  { kind: "low", label: "Low", def: { kind: "low" }, group: "Price" },
  { kind: "highest", label: "Highest high of last N bars", params: ["n"], def: { kind: "highest", n: 20 }, group: "Price" },
  { kind: "lowest", label: "Lowest low of last N bars", params: ["n"], def: { kind: "lowest", n: 20 }, group: "Price" },
  { kind: "change", label: "% change over N bars", params: ["n"], def: { kind: "change", n: 5 }, group: "Price" },
  { kind: "gap", label: "Gap % at the open", def: { kind: "gap" }, group: "Price" },
  { kind: "sma", label: "Moving average (simple)", params: ["n"], def: { kind: "sma", n: 50 }, group: "Indicators" },
  { kind: "ema", label: "Moving average (exponential)", params: ["n"], def: { kind: "ema", n: 21 }, group: "Indicators" },
  { kind: "rsi", label: "RSI", params: ["n"], def: { kind: "rsi", n: 14 }, group: "Indicators" },
  { kind: "macd", label: "MACD line", def: { kind: "macd" }, group: "Indicators" },
  { kind: "macdSignal", label: "MACD signal", def: { kind: "macdSignal" }, group: "Indicators" },
  { kind: "macdHist", label: "MACD histogram", def: { kind: "macdHist" }, group: "Indicators" },
  { kind: "bbUpper", label: "Bollinger upper band", params: ["n"], def: { kind: "bbUpper", n: 20 }, group: "Indicators" },
  { kind: "bbLower", label: "Bollinger lower band", params: ["n"], def: { kind: "bbLower", n: 20 }, group: "Indicators" },
  { kind: "volume", label: "Volume", def: { kind: "volume" }, group: "Volume" },
  { kind: "volumeAvg", label: "Average volume of N bars", params: ["n"], def: { kind: "volumeAvg", n: 20 }, group: "Volume" },
  { kind: "value", label: "A number", params: ["value"], def: { kind: "value", value: 30 }, group: "Number" },
];

export const OPS: { op: Op; label: string }[] = [
  { op: "above", label: "is above" },
  { op: "below", label: "is below" },
  { op: "crossesAbove", label: "crosses above" },
  { op: "crossesBelow", label: "crosses below" },
];

/** "RSI(14)", "Moving average 50", "30". */
export function operandText(o: Operand): string {
  switch (o.kind) {
    case "close":
      return "Price";
    case "open":
    case "high":
    case "low":
      return o.kind[0].toUpperCase() + o.kind.slice(1);
    case "sma":
      return `${o.n}-bar average`;
    case "ema":
      return `${o.n}-bar EMA`;
    case "rsi":
      return `RSI(${o.n})`;
    case "macd":
      return "MACD";
    case "macdSignal":
      return "MACD signal";
    case "macdHist":
      return "MACD histogram";
    case "bbUpper":
      return `Upper band (${o.n})`;
    case "bbLower":
      return `Lower band (${o.n})`;
    case "volume":
      return "Volume";
    case "volumeAvg":
      return `${o.n}-bar avg volume`;
    case "highest":
      return `${o.n}-bar high`;
    case "lowest":
      return `${o.n}-bar low`;
    case "change":
      return `${o.n}-bar % change`;
    case "gap":
      return "Gap %";
    case "value":
      return String(o.value);
  }
}

export const conditionText = (c: Condition) => `${operandText(c.left)} ${OPS.find((o) => o.op === c.op)?.label ?? c.op} ${operandText(c.right)}`;

// ---- Series ---------------------------------------------------------------------------------------------------------

type Series = (number | null)[];

function smaOf(v: number[], n: number): Series {
  const out: Series = [];
  let sum = 0;
  for (let i = 0; i < v.length; i++) {
    sum += v[i];
    if (i >= n) sum -= v[i - n];
    out.push(i >= n - 1 ? sum / n : null);
  }
  return out;
}

function emaOf(v: number[], n: number): Series {
  const k = 2 / (n + 1);
  const out: Series = [];
  let e: number | null = null;
  for (let i = 0; i < v.length; i++) {
    if (i < n - 1) {
      out.push(null);
      continue;
    }
    e = e == null ? v.slice(i - n + 1, i + 1).reduce((a, b) => a + b, 0) / n : v[i] * k + e * (1 - k);
    out.push(e);
  }
  return out;
}

function rsiOf(c: number[], n: number): Series {
  const out: Series = c.map(() => null);
  if (c.length <= n) return out;
  let g = 0;
  let l = 0;
  for (let i = 1; i <= n; i++) {
    const ch = c[i] - c[i - 1];
    if (ch > 0) g += ch;
    else l -= ch;
  }
  g /= n;
  l /= n;
  out[n] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
  for (let i = n + 1; i < c.length; i++) {
    const ch = c[i] - c[i - 1];
    g = (g * (n - 1) + Math.max(ch, 0)) / n;
    l = (l * (n - 1) + Math.max(-ch, 0)) / n;
    out[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
  }
  return out;
}

const key = (o: Operand) => JSON.stringify(o);

/** Every operand's values over the bars, worked out once per backtest. */
export class Calc {
  private cache = new Map<string, Series>();
  private closes: number[];

  constructor(private bars: Candle[]) {
    this.closes = bars.map((b) => b.c);
  }

  series(o: Operand): Series {
    const k = key(o);
    const hit = this.cache.get(k);
    if (hit) return hit;
    const b = this.bars;
    const c = this.closes;
    let s: Series;
    switch (o.kind) {
      case "close":
      case "open":
      case "high":
      case "low":
        s = b.map((x) => x[o.kind[0] as "c" | "o" | "h" | "l"]);
        break;
      case "sma":
        s = smaOf(c, o.n);
        break;
      case "ema":
        s = emaOf(c, o.n);
        break;
      case "rsi":
        s = rsiOf(c, o.n);
        break;
      case "macd":
      case "macdSignal":
      case "macdHist": {
        const fast = emaOf(c, 12);
        const slow = emaOf(c, 26);
        const line = c.map((_, i) => (fast[i] != null && slow[i] != null ? fast[i]! - slow[i]! : null));
        const start = line.findIndex((v) => v != null);
        const sig: Series = line.map(() => null);
        if (start >= 0) {
          const e = emaOf(line.slice(start) as number[], 9);
          e.forEach((v, j) => (sig[start + j] = v));
        }
        s = o.kind === "macd" ? line : o.kind === "macdSignal" ? sig : line.map((v, i) => (v != null && sig[i] != null ? v - sig[i]! : null));
        break;
      }
      case "bbUpper":
      case "bbLower": {
        const mid = smaOf(c, o.n);
        s = c.map((_, i) => {
          if (mid[i] == null) return null;
          const win = c.slice(i - o.n + 1, i + 1);
          const sd = Math.sqrt(win.reduce((a, v) => a + (v - mid[i]!) ** 2, 0) / o.n);
          return o.kind === "bbUpper" ? mid[i]! + 2 * sd : mid[i]! - 2 * sd;
        });
        break;
      }
      case "volume":
        s = b.map((x) => x.v);
        break;
      case "volumeAvg":
        s = smaOf(b.map((x) => x.v), o.n);
        break;
      case "highest":
      case "lowest":
        // The last N bars before this one, so "price crosses above the 20-bar high" can happen.
        s = b.map((_, i) => {
          if (i < o.n) return null;
          const win = b.slice(i - o.n, i);
          return o.kind === "highest" ? Math.max(...win.map((x) => x.h)) : Math.min(...win.map((x) => x.l));
        });
        break;
      case "change":
        s = c.map((v, i) => (i >= o.n && c[i - o.n] > 0 ? ((v - c[i - o.n]) / c[i - o.n]) * 100 : null));
        break;
      case "gap":
        s = b.map((x, i) => (i > 0 && b[i - 1].c > 0 ? ((x.o - b[i - 1].c) / b[i - 1].c) * 100 : null));
        break;
      case "value":
        s = b.map(() => o.value);
        break;
    }
    this.cache.set(k, s);
    return s;
  }

  /** Whether a condition holds at bar i (crosses compare with bar i − 1). */
  holds(cnd: Condition, i: number): boolean {
    const L = this.series(cnd.left);
    const R = this.series(cnd.right);
    const l = L[i];
    const r = R[i];
    if (l == null || r == null) return false;
    if (cnd.op === "above") return l > r;
    if (cnd.op === "below") return l < r;
    const lp = L[i - 1];
    const rp = R[i - 1];
    if (lp == null || rp == null) return false;
    return cnd.op === "crossesAbove" ? lp <= rp && l > r : lp >= rp && l < r;
  }

  /** All true (entry); with none, never. */
  all(cs: Condition[], i: number) {
    return cs.length > 0 && cs.every((c) => this.holds(c, i));
  }

  /** Any true (exit). */
  any(cs: Condition[], i: number) {
    return cs.some((c) => this.holds(c, i));
  }
}

/** A rule set that can be trusted from a form: known kinds, sane numbers. */
export function cleanRules(raw: unknown): Rules | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<Rules>;
  const kinds = new Set(OPERANDS.map((o) => o.kind));
  const ops = new Set(OPS.map((o) => o.op));
  const operand = (o: unknown): Operand | null => {
    if (!o || typeof o !== "object") return null;
    const x = o as { kind?: string; n?: unknown; value?: unknown };
    if (!x.kind || !kinds.has(x.kind as OperandKind)) return null;
    const spec = OPERANDS.find((d) => d.kind === x.kind)!;
    const out: Record<string, unknown> = { kind: x.kind };
    if (spec.params?.includes("n")) {
      const n = Math.round(Number(x.n));
      if (!(n >= 1 && n <= 400)) return null;
      out.n = n;
    }
    if (spec.params?.includes("value")) {
      const v = Number(x.value);
      if (!Number.isFinite(v)) return null;
      out.value = v;
    }
    return out as Operand;
  };
  const conds = (list: unknown): Condition[] | null => {
    if (!Array.isArray(list) || list.length > 8) return null;
    const out: Condition[] = [];
    for (const c of list) {
      const left = operand((c as Condition)?.left);
      const right = operand((c as Condition)?.right);
      const op = (c as Condition)?.op;
      if (!left || !right || !ops.has(op)) return null;
      out.push({ left, op, right });
    }
    return out;
  };
  const entry = conds(r.entry);
  const exit = conds(r.exit ?? []);
  if (!entry || !entry.length || !exit) return null;
  const pct = (v: unknown) => (v == null || v === "" ? null : Number(v) > 0 && Number(v) <= 500 ? Number(v) : null);
  const days = r.maxDays == null ? null : Math.round(Number(r.maxDays));
  const opt = r.option;
  return {
    direction: r.direction === "short" ? "short" : "long",
    entry,
    exit,
    targetPct: pct(r.targetPct),
    stopPct: pct(r.stopPct),
    maxDays: days != null && days >= 1 && days <= 250 ? days : null,
    option:
      opt && Number(opt.dte) >= 1 && Number(opt.dte) <= 400 && Number(opt.delta) > 0 && Number(opt.delta) < 1
        ? { dte: Math.round(Number(opt.dte)), delta: Number(opt.delta) }
        : null,
  };
}
