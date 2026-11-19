// Ready-made strategies to start from (docs/plans/strategies.md: "6–10 classics, each one click to backtest and copy").
// Daily bars; each trades a call (or a put when short) about a month out near 0.40 delta.

import type { Rules } from "./rules";

export type Template = { key: string; name: string; blurb: string; rules: Rules };

const OPT = { dte: 30, delta: 0.4 };

export const TEMPLATES: Template[] = [
  {
    key: "rsi-bounce",
    name: "RSI oversold bounce",
    blurb: "Buys a dip in an uptrend: RSI under 30 while price holds above its 200-day average.",
    rules: {
      direction: "long",
      entry: [
        { left: { kind: "rsi", n: 14 }, op: "crossesBelow", right: { kind: "value", value: 30 } },
        { left: { kind: "close" }, op: "above", right: { kind: "sma", n: 200 } },
      ],
      exit: [{ left: { kind: "rsi", n: 14 }, op: "crossesAbove", right: { kind: "value", value: 55 } }],
      targetPct: 6,
      stopPct: 4,
      maxDays: 15,
      option: OPT,
    },
  },
  {
    key: "breakout-20",
    name: "20-day breakout",
    blurb: "Price closes over its highest high of the last 20 days on above-average volume.",
    rules: {
      direction: "long",
      entry: [
        { left: { kind: "close" }, op: "crossesAbove", right: { kind: "highest", n: 20 } },
        { left: { kind: "volume" }, op: "above", right: { kind: "volumeAvg", n: 20 } },
      ],
      exit: [{ left: { kind: "close" }, op: "crossesBelow", right: { kind: "ema", n: 10 } }],
      targetPct: 8,
      stopPct: 4,
      maxDays: 20,
      option: OPT,
    },
  },
  {
    key: "golden-cross",
    name: "Moving-average cross",
    blurb: "The 20-day average crosses above the 50-day: momentum turning up.",
    rules: {
      direction: "long",
      entry: [{ left: { kind: "sma", n: 20 }, op: "crossesAbove", right: { kind: "sma", n: 50 } }],
      exit: [{ left: { kind: "sma", n: 20 }, op: "crossesBelow", right: { kind: "sma", n: 50 } }],
      targetPct: 10,
      stopPct: 5,
      maxDays: 30,
      option: { dte: 45, delta: 0.45 },
    },
  },
  {
    key: "gap-and-go",
    name: "Gap and go",
    blurb: "Opens 2%+ higher and closes near the day's high on heavy volume.",
    rules: {
      direction: "long",
      entry: [
        { left: { kind: "gap" }, op: "above", right: { kind: "value", value: 2 } },
        { left: { kind: "close" }, op: "above", right: { kind: "open" } },
        { left: { kind: "volume" }, op: "above", right: { kind: "volumeAvg", n: 20 } },
      ],
      exit: [],
      targetPct: 5,
      stopPct: 3,
      maxDays: 5,
      option: { dte: 14, delta: 0.45 },
    },
  },
  {
    key: "macd-turn",
    name: "MACD turn up",
    blurb: "The MACD line crosses over its signal while price is above the 50-day average.",
    rules: {
      direction: "long",
      entry: [
        { left: { kind: "macd" }, op: "crossesAbove", right: { kind: "macdSignal" } },
        { left: { kind: "close" }, op: "above", right: { kind: "sma", n: 50 } },
      ],
      exit: [{ left: { kind: "macd" }, op: "crossesBelow", right: { kind: "macdSignal" } }],
      targetPct: 7,
      stopPct: 4,
      maxDays: 20,
      option: OPT,
    },
  },
  {
    key: "band-squeeze-bounce",
    name: "Lower band bounce",
    blurb: "Price closes back above the lower Bollinger band after tagging it.",
    rules: {
      direction: "long",
      entry: [{ left: { kind: "close" }, op: "crossesAbove", right: { kind: "bbLower", n: 20 } }],
      exit: [{ left: { kind: "close" }, op: "crossesAbove", right: { kind: "sma", n: 20 } }],
      targetPct: 5,
      stopPct: 4,
      maxDays: 10,
      option: OPT,
    },
  },
  {
    key: "news-breakout",
    name: "Good-news breakout",
    blurb: "Price breaks its 10-day high on a day the headlines lean positive. News history starts Apr 29, 2026.",
    rules: {
      direction: "long",
      entry: [
        { left: { kind: "close" }, op: "crossesAbove", right: { kind: "highest", n: 10 } },
        { left: { kind: "newsTone", n: 2 }, op: "above", right: { kind: "value", value: 0 } },
      ],
      exit: [{ left: { kind: "newsTone", n: 2 }, op: "below", right: { kind: "value", value: 0 } }],
      targetPct: 6,
      stopPct: 3,
      maxDays: 10,
      option: { dte: 21, delta: 0.45 },
    },
  },
  {
    key: "breakdown-20",
    name: "20-day breakdown (short)",
    blurb: "Price closes under its lowest low of the last 20 days, below the 50-day: buys puts.",
    rules: {
      direction: "short",
      entry: [
        { left: { kind: "close" }, op: "crossesBelow", right: { kind: "lowest", n: 20 } },
        { left: { kind: "close" }, op: "below", right: { kind: "sma", n: 50 } },
      ],
      exit: [{ left: { kind: "close" }, op: "crossesAbove", right: { kind: "ema", n: 10 } }],
      targetPct: 7,
      stopPct: 4,
      maxDays: 15,
      option: OPT,
    },
  },
  {
    key: "overbought-fade",
    name: "Overbought fade (short)",
    blurb: "RSI over 75 after a 10%+ run in two weeks: buys puts for the pullback.",
    rules: {
      direction: "short",
      entry: [
        { left: { kind: "rsi", n: 14 }, op: "crossesAbove", right: { kind: "value", value: 75 } },
        { left: { kind: "change", n: 10 }, op: "above", right: { kind: "value", value: 10 } },
      ],
      exit: [{ left: { kind: "rsi", n: 14 }, op: "crossesBelow", right: { kind: "value", value: 55 } }],
      targetPct: 6,
      stopPct: 4,
      maxDays: 10,
      option: { dte: 21, delta: 0.4 },
    },
  },
];

export const templateByKey = (k: string) => TEMPLATES.find((t) => t.key === k) ?? null;
