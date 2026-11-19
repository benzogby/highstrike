// Ready-made strategies to start from (docs/plans/strategies.md: "6–10 classics, each one click to backtest and copy"),
// in the switch-and-sensitivity form (spec.ts). Daily bars; each trades a call (a put when bearish) about a month out
// near 0.40 delta, one contract, unless it says otherwise.

import { DEFAULT_CONTRACT, on, type Spec } from "./spec";

export type Template = { key: string; name: string; blurb: string; spec: Spec };

const t = (s: Omit<Spec, "version" | "contract"> & { contract?: Partial<Spec["contract"]> }): Spec => ({ version: 2, ...s, contract: { ...DEFAULT_CONTRACT, ...s.contract } });
const none = { custom: [] };

export const TEMPLATES: Template[] = [
  {
    key: "rsi-bounce",
    name: "RSI oversold bounce",
    blurb: "Buys a dip in an uptrend: RSI under 30 while price holds above its 200-day average.",
    spec: t({
      direction: "long",
      entry: { criteria: on("entry", [["rsiDown", { n: 14, x: 30 }], ["aboveMA", { n: 200 }]]), ...none },
      exit: { mode: "any", criteria: on("exit", [["x-stockGain", { x: 6 }], ["x-rsiHigh", { n: 14, x: 55 }], ["x-days", { x: 15 }]]), ...none },
      stop: { mode: "any", criteria: on("stop", [["s-stockLoss", { x: 4 }]]), ...none },
    }),
  },
  {
    key: "breakout-20",
    name: "20-day breakout",
    blurb: "Price closes over its highest high of the last 20 days on above-average volume.",
    spec: t({
      direction: "long",
      entry: { criteria: on("entry", [["breakout", { n: 20 }], ["volume", { x: 1, n: 20 }]]), ...none },
      exit: { mode: "any", criteria: on("exit", [["x-stockGain", { x: 8 }], ["x-belowEMA", { n: 10 }], ["x-days", { x: 20 }]]), ...none },
      stop: { mode: "any", criteria: on("stop", [["s-stockLoss", { x: 4 }]]), ...none },
    }),
  },
  {
    key: "golden-cross",
    name: "Moving-average cross",
    blurb: "The 20-day average crosses above the 50-day: momentum turning up.",
    spec: t({
      direction: "long",
      entry: { criteria: on("entry", [["goldenCross", { a: 20, b: 50 }]]), ...none },
      contract: { dte: 45, strike: { by: "delta", value: 0.45 } },
      exit: { mode: "any", criteria: on("exit", [["x-stockGain", { x: 10 }], ["x-days", { x: 30 }]]), ...none },
      stop: { mode: "any", criteria: on("stop", [["s-stockLoss", { x: 5 }]]), custom: [{ left: { kind: "sma", n: 20 }, op: "crossesBelow", right: { kind: "sma", n: 50 } }] },
    }),
  },
  {
    key: "gap-and-go",
    name: "Gap and go",
    blurb: "Opens 2%+ higher and closes near the day's high on heavy volume.",
    spec: t({
      direction: "long",
      entry: { criteria: on("entry", [["gapUp", { x: 2 }], ["volume", { x: 1, n: 20 }]]), custom: [{ left: { kind: "close" }, op: "above", right: { kind: "open" } }] },
      contract: { dte: 14, strike: { by: "delta", value: 0.45 } },
      exit: { mode: "any", criteria: on("exit", [["x-stockGain", { x: 5 }], ["x-days", { x: 5 }]]), ...none },
      stop: { mode: "any", criteria: on("stop", [["s-stockLoss", { x: 3 }]]), ...none },
    }),
  },
  {
    key: "macd-turn",
    name: "MACD turn up",
    blurb: "The MACD line crosses over its signal while price is above the 50-day average.",
    spec: t({
      direction: "long",
      entry: { criteria: on("entry", [["macdUp"], ["aboveMA", { n: 50 }]]), ...none },
      exit: { mode: "any", criteria: on("exit", [["x-stockGain", { x: 7 }], ["x-macdDown"], ["x-days", { x: 20 }]]), ...none },
      stop: { mode: "any", criteria: on("stop", [["s-stockLoss", { x: 4 }]]), ...none },
    }),
  },
  {
    key: "band-squeeze-bounce",
    name: "Lower band bounce",
    blurb: "Price closes back above the lower Bollinger band after tagging it.",
    spec: t({
      direction: "long",
      entry: { criteria: on("entry", [["bbBounce", { n: 20 }]]), ...none },
      exit: { mode: "any", criteria: on("exit", [["x-stockGain", { x: 5 }], ["x-days", { x: 10 }]]), custom: [{ left: { kind: "close" }, op: "crossesAbove", right: { kind: "sma", n: 20 } }] },
      stop: { mode: "any", criteria: on("stop", [["s-stockLoss", { x: 4 }]]), ...none },
    }),
  },
  {
    key: "news-breakout",
    name: "Good-news breakout",
    blurb: "Price breaks its 10-day high on a day the headlines lean positive. News history starts Apr 29, 2026.",
    spec: t({
      direction: "long",
      entry: { criteria: on("entry", [["breakout", { n: 10 }], ["newsGood", { n: 2, x: 0 }]]), ...none },
      contract: { dte: 21, strike: { by: "delta", value: 0.45 } },
      exit: { mode: "any", criteria: on("exit", [["x-stockGain", { x: 6 }], ["x-newsBad", { n: 2, x: 0 }], ["x-days", { x: 10 }]]), ...none },
      stop: { mode: "any", criteria: on("stop", [["s-stockLoss", { x: 3 }]]), ...none },
    }),
  },
  {
    key: "breakdown-20",
    name: "20-day breakdown (short)",
    blurb: "Price closes under its lowest low of the last 20 days, below the 50-day: buys puts.",
    spec: t({
      direction: "short",
      entry: { criteria: on("entry", [["breakdown", { n: 20 }], ["belowMA", { n: 50 }]]), ...none },
      exit: { mode: "any", criteria: on("exit", [["x-stockGain", { x: 7 }], ["x-aboveEMA", { n: 10 }], ["x-days", { x: 15 }]]), ...none },
      stop: { mode: "any", criteria: on("stop", [["s-stockLoss", { x: 4 }]]), ...none },
    }),
  },
  {
    key: "overbought-fade",
    name: "Overbought fade (short)",
    blurb: "RSI over 75 after a 10%+ run in two weeks: buys puts for the pullback.",
    spec: t({
      direction: "short",
      entry: { criteria: on("entry", [["rsiUp", { n: 14, x: 75 }], ["runUp", { x: 10, n: 10 }]]), ...none },
      contract: { dte: 21 },
      exit: { mode: "any", criteria: on("exit", [["x-stockGain", { x: 6 }], ["x-rsiLow", { n: 14, x: 55 }], ["x-days", { x: 10 }]]), ...none },
      stop: { mode: "any", criteria: on("stop", [["s-stockLoss", { x: 4 }]]), ...none },
    }),
  },
];

export const templateByKey = (k: string) => TEMPLATES.find((x) => x.key === k) ?? null;
