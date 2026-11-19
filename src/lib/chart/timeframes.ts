// The chart's timeframes (Ben, 2026-11-18: "More timeframes. Down to 1m"), shared by the chart (in the browser) and the
// pages that read a timeframe from their URL (on the server).
export const TIMEFRAMES = ["1m", "5m", "15m", "30m", "1h", "4h", "D", "W", "M", "Y"] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];
