// HighStrike Chart's shapes, shared by the server (src/lib/candles.ts), the chart (src/components/chart) and the saved
// markup (public.chart_drawings). Prices are per share; times are New York trading dates, "2026-11-17".

/** `empty`: a time slot nothing traded in (src/lib/chart/slots.ts), kept so time stays to scale; drawn as nothing. */
export type Candle = { t: string; o: number; h: number; l: number; c: number; v: number; live?: boolean; empty?: boolean };

/** A point on the chart: a date (any date, even past the last bar, for drawings that reach into the future) and a price. */
export type Anchor = { t: string; p: number };

export type DrawingKind = "hline" | "trend" | "zone" | "note" | "arrow" | "measure" | "fib" | "plan";

export type Drawing = {
  id: string;
  kind: DrawingKind;
  /** hline: [a]; note: [a]; trend, zone, arrow, measure, fib: [a, b]; plan: [entry, stop, target] (dates span the plan). */
  pts: Anchor[];
  color: string;
  text?: string;
  /** plan: long or short. */
  side?: "long" | "short";
};

/** A level drawn by HighStrike itself (an idea's entry, stop and target), shown but not editable or saved. */
export type HouseLevels = { entry: number; target: number | null; stop: number | null; direction: "long" | "short"; from?: string };
