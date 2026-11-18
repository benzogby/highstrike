// The Scanner's kept snapshot (src/lib/scan/build.ts). Short keys: it's one JSON row read on every Scanner visit.

export type StockRow = {
  t: string;
  sector: string;
  tier: 1 | 2 | 3;
  price: number;
  /** % today (live) or on the last session. */
  chg: number | null;
  /** The open against the previous close, %. */
  gap: number | null;
  /** 0 at the day's low, 1 at its high. */
  rangePos: number | null;
  vol: number | null;
  dollarVol: number | null;
  /** Volume over its 20-session average. */
  relVol: number | null;
  /** % over 5 sessions. */
  mom5: number | null;
  /** 20-day volatility, yearly, as a fraction. */
  hv20: number | null;
  live: boolean;
};

export type OptionRow = {
  /** Massive's contract ticker, like O:AAPL261218C00350000. */
  c: string;
  u: string;
  type: "call" | "put";
  strike: number;
  expiry: string;
  dte: number;
  vol: number;
  oi: number;
  volOi: number | null;
  iv: number | null;
  delta: number | null;
  mid: number | null;
  bid: number | null;
  ask: number | null;
  /** Dollars traded today: volume × mid × 100. */
  premium: number | null;
  /** How far out of the money, % of the price (negative: in the money). */
  otm: number;
  spot: number;
};

export type TickerOptions = {
  u: string;
  callVol: number;
  putVol: number;
  /** Put volume ÷ call volume. */
  pcr: number | null;
  /** At-the-money implied volatility about a month out. */
  atmIv: number | null;
  /** That IV ÷ the stock's own 20-day volatility. */
  ivHv: number | null;
  moveExpiry: string | null;
  /** The move options price in by that expiry, %. */
  movePct: number | null;
  premium: number;
};

export type EarningsRow = {
  t: string;
  date: string;
  hour: string | null;
  eps: number | null;
  /** The move priced in for the week of earnings (options) or a typical two-day move (history), %. */
  movePct: number | null;
  moveFrom: "options" | "history" | null;
};

export type ScanSnapshot = {
  v: 1;
  asOf: string;
  /** The last completed session. */
  session: string;
  stocksFrom: "snapshot" | "alpaca" | "close+live" | "close";
  optionsFrom: "snapshot" | "alpaca" | null;
  historyDays: number;
  breadth: { up: number; down: number };
  stocks: StockRow[];
  hot: OptionRow[];
  unusual: OptionRow[];
  byTicker: TickerOptions[];
  earnings: EarningsRow[];
  notes: string[];
};
