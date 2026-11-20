// A strategy, version 2 (Ben, 2026-11-19: "Each strategy should have tabs: Entry, Contract, Exit, Stop, Backtest").
// - Entry: a list of indicator criteria, each switched on or off with its own sensitivity (its numbers), all of the
//   ones that are on true to enter; plus custom rule blocks (src/lib/strategies/rules.ts) for anything else.
// - Contract: a single option, a debit spread or shares; the expiry, the strike, the spread's width and the size.
// - Exit (taking profit) and Stop (cutting a loss): criteria the same way, with a switch for "all true" or "any one
//   true", plus custom blocks.
// Version 1 strategies (rules.ts's Rules) are converted on read. Pure.

import { cleanRules, OPERANDS, OPS, conditionText, type Condition, type Operand, type Rules } from "./rules";

// ---- Criteria -------------------------------------------------------------------------------------------------------

export type Group = "entry" | "exit" | "stop";
export type Param = { key: string; min: number; max: number; step: number; def: number; unit?: string };
/** What a criterion becomes: a rule on the bars, or a check on the trade itself. */
export type Check =
  | { cond: Condition }
  | { trade: "stockPct" | "optionPct" | "days" | "dte" | "dollars"; value: number };

export type CriterionDef = {
  id: string;
  group: Group;
  /** The sentence, with {key} where each number goes. */
  text: string;
  params: Param[];
  /** On a backtest, the plain words for the trade's exit. */
  build: (p: Record<string, number>) => Check;
};

const v = (value: number): Operand => ({ kind: "value", value });
const c = (left: Operand, op: Condition["op"], right: Operand): Check => ({ cond: { left, op, right } });
const N = (def: number, max = 250): Param => ({ key: "n", min: 2, max, step: 1, def, unit: "days" });

export const CRITERIA: CriterionDef[] = [
  // Entry
  { id: "aboveMA", group: "entry", text: "Price is above its {n}-day average", params: [N(50)], build: (p) => c({ kind: "close" }, "above", { kind: "sma", n: p.n }) },
  { id: "belowMA", group: "entry", text: "Price is below its {n}-day average", params: [N(50)], build: (p) => c({ kind: "close" }, "below", { kind: "sma", n: p.n }) },
  { id: "rsiLow", group: "entry", text: "RSI({n}) is below {x}", params: [N(14, 50), { key: "x", min: 5, max: 50, step: 1, def: 30 }], build: (p) => c({ kind: "rsi", n: p.n }, "below", v(p.x)) },
  { id: "rsiHigh", group: "entry", text: "RSI({n}) is above {x}", params: [N(14, 50), { key: "x", min: 50, max: 95, step: 1, def: 70 }], build: (p) => c({ kind: "rsi", n: p.n }, "above", v(p.x)) },
  { id: "rsiUp", group: "entry", text: "RSI({n}) crosses above {x}", params: [N(14, 50), { key: "x", min: 10, max: 90, step: 1, def: 30 }], build: (p) => c({ kind: "rsi", n: p.n }, "crossesAbove", v(p.x)) },
  { id: "rsiDown", group: "entry", text: "RSI({n}) crosses below {x}", params: [N(14, 50), { key: "x", min: 10, max: 90, step: 1, def: 70 }], build: (p) => c({ kind: "rsi", n: p.n }, "crossesBelow", v(p.x)) },
  { id: "breakout", group: "entry", text: "Closes above its {n}-day high", params: [N(20)], build: (p) => c({ kind: "close" }, "crossesAbove", { kind: "highest", n: p.n }) },
  { id: "breakdown", group: "entry", text: "Closes below its {n}-day low", params: [N(20)], build: (p) => c({ kind: "close" }, "crossesBelow", { kind: "lowest", n: p.n }) },
  { id: "goldenCross", group: "entry", text: "{a}-day average crosses above the {b}-day", params: [{ key: "a", min: 2, max: 200, step: 1, def: 20, unit: "days" }, { key: "b", min: 5, max: 250, step: 1, def: 50, unit: "days" }], build: (p) => c({ kind: "sma", n: p.a }, "crossesAbove", { kind: "sma", n: p.b }) },
  { id: "deathCross", group: "entry", text: "{a}-day average crosses below the {b}-day", params: [{ key: "a", min: 2, max: 200, step: 1, def: 20, unit: "days" }, { key: "b", min: 5, max: 250, step: 1, def: 50, unit: "days" }], build: (p) => c({ kind: "sma", n: p.a }, "crossesBelow", { kind: "sma", n: p.b }) },
  { id: "macdUp", group: "entry", text: "MACD crosses above its signal", params: [], build: () => c({ kind: "macd" }, "crossesAbove", { kind: "macdSignal" }) },
  { id: "macdDown", group: "entry", text: "MACD crosses below its signal", params: [], build: () => c({ kind: "macd" }, "crossesBelow", { kind: "macdSignal" }) },
  { id: "bbBounce", group: "entry", text: "Closes back above the lower band ({n})", params: [N(20, 100)], build: (p) => c({ kind: "close" }, "crossesAbove", { kind: "bbLower", n: p.n }) },
  { id: "bbBreak", group: "entry", text: "Closes above the upper band ({n})", params: [N(20, 100)], build: (p) => c({ kind: "close" }, "crossesAbove", { kind: "bbUpper", n: p.n }) },
  { id: "volume", group: "entry", text: "Volume is over {x}× its {n}-day average", params: [{ key: "x", min: 1, max: 10, step: 0.1, def: 1.5 }, N(20, 100)], build: (p) => c({ kind: "volumeRatio", n: p.n }, "above", v(p.x)) },
  { id: "gapUp", group: "entry", text: "Opens more than {x}% higher", params: [{ key: "x", min: 0.5, max: 20, step: 0.5, def: 2, unit: "%" }], build: (p) => c({ kind: "gap" }, "above", v(p.x)) },
  { id: "gapDown", group: "entry", text: "Opens more than {x}% lower", params: [{ key: "x", min: 0.5, max: 20, step: 0.5, def: 2, unit: "%" }], build: (p) => c({ kind: "gap" }, "below", v(-p.x)) },
  { id: "runUp", group: "entry", text: "Up more than {x}% over {n} days", params: [{ key: "x", min: 1, max: 50, step: 0.5, def: 10, unit: "%" }, N(10, 60)], build: (p) => c({ kind: "change", n: p.n }, "above", v(p.x)) },
  { id: "pullback", group: "entry", text: "Down more than {x}% over {n} days", params: [{ key: "x", min: 1, max: 50, step: 0.5, def: 8, unit: "%" }, N(10, 60)], build: (p) => c({ kind: "change", n: p.n }, "below", v(-p.x)) },
  { id: "newsBusy", group: "entry", text: "{x} or more headlines in the last {n} days", params: [{ key: "x", min: 1, max: 30, step: 1, def: 3 }, N(2, 10)], build: (p) => c({ kind: "newsCount", n: p.n }, "above", v(p.x - 0.5)) },
  { id: "newsGood", group: "entry", text: "News tone over {n} days is above {x}", params: [N(3, 10), { key: "x", min: -5, max: 10, step: 1, def: 0 }], build: (p) => c({ kind: "newsTone", n: p.n }, "above", v(p.x)) },
  { id: "newsBad", group: "entry", text: "News tone over {n} days is below {x}", params: [N(3, 10), { key: "x", min: -10, max: 5, step: 1, def: 0 }], build: (p) => c({ kind: "newsTone", n: p.n }, "below", v(p.x)) },

  // Exit: taking profit
  { id: "x-stockGain", group: "exit", text: "The stock moves {x}% in the trade's favour", params: [{ key: "x", min: 0.5, max: 100, step: 0.5, def: 6, unit: "%" }], build: (p) => ({ trade: "stockPct", value: p.x }) },
  { id: "x-optionGain", group: "exit", text: "The option is up {x}%", params: [{ key: "x", min: 5, max: 1000, step: 5, def: 50, unit: "%" }], build: (p) => ({ trade: "optionPct", value: p.x }) },
  { id: "x-dollars", group: "exit", text: "The position is up ${x}", params: [{ key: "x", min: 10, max: 100000, step: 10, def: 500 }], build: (p) => ({ trade: "dollars", value: p.x }) },
  { id: "x-rsiHigh", group: "exit", text: "RSI({n}) is above {x}", params: [N(14, 50), { key: "x", min: 50, max: 95, step: 1, def: 70 }], build: (p) => c({ kind: "rsi", n: p.n }, "above", v(p.x)) },
  { id: "x-rsiLow", group: "exit", text: "RSI({n}) is below {x}", params: [N(14, 50), { key: "x", min: 5, max: 50, step: 1, def: 30 }], build: (p) => c({ kind: "rsi", n: p.n }, "below", v(p.x)) },
  { id: "x-upperBand", group: "exit", text: "Closes above the upper band ({n})", params: [N(20, 100)], build: (p) => c({ kind: "close" }, "above", { kind: "bbUpper", n: p.n }) },
  { id: "x-lowerBand", group: "exit", text: "Closes below the lower band ({n})", params: [N(20, 100)], build: (p) => c({ kind: "close" }, "below", { kind: "bbLower", n: p.n }) },
  { id: "x-macdDown", group: "exit", text: "MACD crosses below its signal", params: [], build: () => c({ kind: "macd" }, "crossesBelow", { kind: "macdSignal" }) },
  { id: "x-macdUp", group: "exit", text: "MACD crosses above its signal", params: [], build: () => c({ kind: "macd" }, "crossesAbove", { kind: "macdSignal" }) },
  { id: "x-belowEMA", group: "exit", text: "Closes below its {n}-day EMA", params: [N(10, 100)], build: (p) => c({ kind: "close" }, "crossesBelow", { kind: "ema", n: p.n }) },
  { id: "x-aboveEMA", group: "exit", text: "Closes above its {n}-day EMA", params: [N(10, 100)], build: (p) => c({ kind: "close" }, "crossesAbove", { kind: "ema", n: p.n }) },
  { id: "x-days", group: "exit", text: "After {x} trading days", params: [{ key: "x", min: 1, max: 250, step: 1, def: 20, unit: "days" }], build: (p) => ({ trade: "days", value: p.x }) },
  { id: "x-expiry", group: "exit", text: "{x} days before the option expires", params: [{ key: "x", min: 0, max: 60, step: 1, def: 5, unit: "days" }], build: (p) => ({ trade: "dte", value: p.x }) },
  { id: "x-newsBad", group: "exit", text: "News tone over {n} days turns below {x}", params: [N(2, 10), { key: "x", min: -10, max: 5, step: 1, def: 0 }], build: (p) => c({ kind: "newsTone", n: p.n }, "below", v(p.x)) },

  // Stop: cutting a loss
  { id: "s-stockLoss", group: "stop", text: "The stock moves {x}% against the trade", params: [{ key: "x", min: 0.5, max: 100, step: 0.5, def: 4, unit: "%" }], build: (p) => ({ trade: "stockPct", value: -p.x }) },
  { id: "s-optionLoss", group: "stop", text: "The option is down {x}%", params: [{ key: "x", min: 5, max: 100, step: 5, def: 50, unit: "%" }], build: (p) => ({ trade: "optionPct", value: -p.x }) },
  { id: "s-dollars", group: "stop", text: "The position is down ${x}", params: [{ key: "x", min: 10, max: 100000, step: 10, def: 300 }], build: (p) => ({ trade: "dollars", value: -p.x }) },
  { id: "s-belowMA", group: "stop", text: "Closes below its {n}-day average", params: [N(20)], build: (p) => c({ kind: "close" }, "below", { kind: "sma", n: p.n }) },
  { id: "s-aboveMA", group: "stop", text: "Closes above its {n}-day average", params: [N(20)], build: (p) => c({ kind: "close" }, "above", { kind: "sma", n: p.n }) },
  { id: "s-newLow", group: "stop", text: "Closes below its {n}-day low", params: [N(10)], build: (p) => c({ kind: "close" }, "crossesBelow", { kind: "lowest", n: p.n }) },
  { id: "s-newHigh", group: "stop", text: "Closes above its {n}-day high", params: [N(10)], build: (p) => c({ kind: "close" }, "crossesAbove", { kind: "highest", n: p.n }) },
  { id: "s-rsiLow", group: "stop", text: "RSI({n}) drops below {x}", params: [N(14, 50), { key: "x", min: 5, max: 60, step: 1, def: 35 }], build: (p) => c({ kind: "rsi", n: p.n }, "crossesBelow", v(p.x)) },
  { id: "s-rsiHigh", group: "stop", text: "RSI({n}) rises above {x}", params: [N(14, 50), { key: "x", min: 40, max: 95, step: 1, def: 65 }], build: (p) => c({ kind: "rsi", n: p.n }, "crossesAbove", v(p.x)) },
  { id: "s-days", group: "stop", text: "After {x} trading days", params: [{ key: "x", min: 1, max: 250, step: 1, def: 10, unit: "days" }], build: (p) => ({ trade: "days", value: p.x }) },
  { id: "s-newsBad", group: "stop", text: "News tone over {n} days drops below {x}", params: [N(2, 10), { key: "x", min: -10, max: 5, step: 1, def: -1 }], build: (p) => c({ kind: "newsTone", n: p.n }, "below", v(p.x)) },
];

export const criteriaFor = (g: Group) => CRITERIA.filter((d) => d.group === g);
const byId = new Map(CRITERIA.map((d) => [d.id, d]));
export const criterionDef = (id: string) => byId.get(id) ?? null;

/** A criterion as a strategy holds it: on or off, with its numbers. */
export type Criterion = { id: string; on: boolean; p: Record<string, number> };

/** "RSI(14) is below 30", with its numbers filled in. */
export function criterionText(cr: Criterion) {
  const d = byId.get(cr.id);
  if (!d) return cr.id;
  return d.text.replace(/\{(\w+)\}/g, (_, k) => String(cr.p[k] ?? d.params.find((x) => x.key === k)?.def ?? ""));
}

// ---- The strategy ---------------------------------------------------------------------------------------------------

export type Contract = {
  /** A call (or a put when bearish), a debit spread of them, or shares. */
  kind: "single" | "spread" | "shares";
  /** Days to expiry it aims for, and whether that's the nearest listed or the first at least that far. */
  dte: number;
  expiryRule: "nearest" | "atLeast";
  /**
   * The strike, as a percent from the stock's price (Ben, 2026-11-19: "I dont know what 0.5 means… Percent from the
   * price"): 0 is at the money, positive is out of the money (a call above the price, a put below it), negative in it.
   */
  strike: { pct: number };
  /** A spread's width, in strikes past the one it buys. */
  width: number;
  /** How much to buy: a number of contracts (or shares), dollars a trade, or a percent of the account. */
  size: { by: "contracts" | "dollars" | "accountPct"; value: number };
};

export type Exits = { mode: "any" | "all"; criteria: Criterion[]; custom: Condition[] };

export type Spec = {
  version: 2;
  direction: "long" | "short";
  entry: { criteria: Criterion[]; custom: Condition[] };
  contract: Contract;
  exit: Exits;
  stop: Exits;
};

export const ACCOUNT = 25_000;
/** How far the strike can be from the price, either way, in percent. */
export const STRIKE_RANGE = 20;

/** A delta turned into about the same percent from the price (a month out, at typical volatility), to the half percent. */
export const pctFromDelta = (delta: number) => (Number.isFinite(delta) ? Math.round((0.5 - delta) * 15 * 2) / 2 : 2);
export const DEFAULT_CONTRACT: Contract = { kind: "single", dte: 30, expiryRule: "nearest", strike: { pct: 2 }, width: 2, size: { by: "contracts", value: 1 } };

/** Every criterion for a group, off, with its defaults, overlaid with the ones given. */
export function fullList(g: Group, given: Criterion[] = []): Criterion[] {
  const have = new Map(given.map((x) => [x.id, x]));
  return criteriaFor(g).map((d) => {
    const h = have.get(d.id);
    const p: Record<string, number> = {};
    for (const q of d.params) p[q.key] = h?.p?.[q.key] ?? q.def;
    return { id: d.id, on: Boolean(h?.on), p };
  });
}

/** A Spec where only the named criteria are on (for templates). */
export function on(g: Group, list: [string, Record<string, number>?][]): Criterion[] {
  return fullList(g, list.map(([id, p]) => ({ id, on: true, p: p ?? {} })));
}

/** The checks a group's criteria and custom blocks add up to. */
export function checksOf(x: { criteria: Criterion[]; custom: Condition[] }): Check[] {
  const out: Check[] = [];
  for (const cr of x.criteria) {
    if (!cr.on) continue;
    const d = byId.get(cr.id);
    if (d) out.push(d.build(cr.p));
  }
  for (const cond of x.custom) out.push({ cond });
  return out;
}

/** The entry as plain rule blocks (every one must be true): what scanners, alerts and ideas check. */
export const entryConditions = (s: Spec) => checksOf(s.entry).flatMap((k) => ("cond" in k ? [k.cond] : []));

/** "RSI(14) is below 30 and Price is above its 200-day average". */
export const entryText = (s: Spec) => [...s.entry.criteria.filter((x) => x.on).map(criterionText), ...s.entry.custom.map(conditionText)].join(" and ");

export const usesNewsSpec = (s: Spec) =>
  [...checksOf(s.entry), ...checksOf(s.exit), ...checksOf(s.stop)].some((k) => "cond" in k && [k.cond.left.kind, k.cond.right.kind].some((x) => x === "newsCount" || x === "newsTone"));

// ---- From version 1 -------------------------------------------------------------------------------------------------

export function fromRules(r: Rules): Spec {
  const exit: Criterion[] = [];
  const stop: Criterion[] = [];
  if (r.targetPct) exit.push({ id: "x-stockGain", on: true, p: { x: r.targetPct } });
  if (r.maxDays) exit.push({ id: "x-days", on: true, p: { x: r.maxDays } });
  if (r.stopPct) stop.push({ id: "s-stockLoss", on: true, p: { x: r.stopPct } });
  return {
    version: 2,
    direction: r.direction,
    entry: { criteria: fullList("entry"), custom: r.entry },
    contract: r.option ? { ...DEFAULT_CONTRACT, dte: r.option.dte, strike: { pct: pctFromDelta(r.option.delta) } } : { ...DEFAULT_CONTRACT, kind: "shares", size: { by: "dollars", value: 1000 } },
    exit: { mode: "any", criteria: fullList("exit", exit), custom: r.exit },
    stop: { mode: "any", criteria: fullList("stop", stop), custom: [] },
  };
}

// ---- Checking what comes from a form ----------------------------------------------------------------------------------

const clamp = (x: unknown, lo: number, hi: number, d: number) => {
  const n = Number(x);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};

function cleanCriteria(g: Group, raw: unknown): Criterion[] {
  const list = Array.isArray(raw) ? (raw as Criterion[]) : [];
  const given = list.filter((x) => x && typeof x.id === "string" && byId.get(x.id)?.group === g);
  return fullList(g, given).map((cr) => {
    const d = byId.get(cr.id)!;
    const p: Record<string, number> = {};
    for (const q of d.params) p[q.key] = clamp(cr.p[q.key], q.min, q.max, q.def);
    return { ...cr, p };
  });
}

function cleanCustom(raw: unknown): Condition[] {
  // The rule blocks are checked by cleanRules; borrow it with a stand-in entry.
  const list = Array.isArray(raw) ? raw.slice(0, 8) : [];
  if (!list.length) return [];
  const r = cleanRules({ direction: "long", entry: list, exit: [] });
  return r ? r.entry : [];
}

/** A strategy that can be trusted from a form or the database (version 1 is converted). Null when it can't enter. */
export function cleanSpec(raw: unknown): Spec | null {
  if (!raw || typeof raw !== "object") return null;
  const x = raw as Partial<Spec> & { version?: number };
  if (x.version !== 2) {
    const r = cleanRules(raw);
    return r ? fromRules(r) : null;
  }
  const ct = (x.contract ?? {}) as Partial<Contract>;
  // The strike as a percent; older ones by delta or "at the money" are turned into one.
  const old = (ct.strike ?? {}) as { pct?: number; by?: string; value?: number };
  const pct = old.pct != null ? Number(old.pct) : old.by === "otmPct" ? Number(old.value) : old.by === "atm" ? 0 : old.by === "delta" ? pctFromDelta(Number(old.value)) : 2;
  const zb = ct.size?.by === "dollars" || ct.size?.by === "accountPct" ? ct.size.by : "contracts";
  const contract: Contract = {
    kind: ct.kind === "spread" || ct.kind === "shares" ? ct.kind : "single",
    dte: Math.round(clamp(ct.dte, 1, 400, 30)),
    expiryRule: ct.expiryRule === "atLeast" ? "atLeast" : "nearest",
    strike: { pct: Math.round(clamp(pct, -STRIKE_RANGE, STRIKE_RANGE, 2) * 2) / 2 },
    width: Math.round(clamp(ct.width, 1, 10, 2)),
    size: { by: zb, value: zb === "contracts" ? Math.round(clamp(ct.size?.value, 1, 10000, 1)) : zb === "dollars" ? clamp(ct.size?.value, 50, 1_000_000, 1000) : clamp(ct.size?.value, 0.5, 100, 4) },
  };
  const ex = (e: unknown, g: "exit" | "stop"): Exits => {
    const o = (e ?? {}) as Partial<Exits>;
    return { mode: o.mode === "all" ? "all" : "any", criteria: cleanCriteria(g, o.criteria), custom: cleanCustom(o.custom) };
  };
  const spec: Spec = {
    version: 2,
    direction: x.direction === "short" ? "short" : "long",
    entry: { criteria: cleanCriteria("entry", x.entry?.criteria), custom: cleanCustom(x.entry?.custom) },
    contract,
    exit: ex(x.exit, "exit"),
    stop: ex(x.stop, "stop"),
  };
  return checksOf(spec.entry).length ? spec : null;
}

export { OPERANDS, OPS };
