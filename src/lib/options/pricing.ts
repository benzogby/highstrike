// Option prices without a data feed (Ben, 2026-11-02: "Estimate now, feed soon"): the Black-Scholes formula for
// European options, with each stock's own volatility estimated from its recent closes (or, before there are enough, its
// day's range). Every price from here is an estimate and is shown as one. Pure.

export const RATE = 0.045;

/** The standard normal cumulative distribution (Abramowitz & Stegun 26.2.17, error under 7.5e-8). */
export function normCdf(x: number) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327 * Math.exp((-x * x) / 2);
  const p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x >= 0 ? 1 - p : p;
}

/** A call's or put's value: spot S, strike K, years T, volatility v (annual). At or past expiry, what it's worth. */
export function bs(type: "call" | "put", S: number, K: number, T: number, v: number, r = RATE) {
  if (T <= 0 || v <= 0) return Math.max(0, type === "call" ? S - K : K - S);
  const d1 = (Math.log(S / K) + (r + (v * v) / 2) * T) / (v * Math.sqrt(T));
  const d2 = d1 - v * Math.sqrt(T);
  return type === "call" ? S * normCdf(d1) - K * Math.exp(-r * T) * normCdf(d2) : K * Math.exp(-r * T) * normCdf(-d2) - S * normCdf(-d1);
}

/** The chance the stock is above `level` at expiry, on the same lognormal model. */
export function probAbove(S: number, level: number, T: number, v: number, r = RATE) {
  if (T <= 0 || v <= 0) return S > level ? 1 : 0;
  const d2 = (Math.log(S / level) + (r - (v * v) / 2) * T) / (v * Math.sqrt(T));
  return normCdf(d2);
}

/**
 * Annual volatility from daily closes (oldest first): the spread of the daily log returns, scaled to a year. With fewer
 * than ten closes, the day's high-low range (Parkinson) blended half and half with a typical 35%. Kept between 12% and 150%.
 */
export function volatility(closes: number[], day?: { high?: number; low?: number }) {
  const clamp = (v: number) => Math.min(1.5, Math.max(0.12, v));
  if (closes.length >= 10) {
    const r: number[] = [];
    for (let i = 1; i < closes.length; i++) if (closes[i - 1] > 0 && closes[i] > 0) r.push(Math.log(closes[i] / closes[i - 1]));
    const mean = r.reduce((a, b) => a + b, 0) / r.length;
    const sd = Math.sqrt(r.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, r.length - 1));
    return clamp(sd * Math.sqrt(252));
  }
  if (day?.high && day?.low && day.high > day.low) {
    const parkinson = (Math.log(day.high / day.low) / (2 * Math.sqrt(Math.log(2)))) * Math.sqrt(252);
    return clamp(0.5 * parkinson + 0.5 * 0.35);
  }
  return 0.35;
}

/** The gap between listed strikes at a price, as US exchanges list them for most stocks. */
export function strikeStep(S: number) {
  return S < 5 ? 0.5 : S < 25 ? 1 : S < 100 ? 2.5 : S < 250 ? 5 : S < 1000 ? 10 : 25;
}

export const roundStrike = (x: number, step: number) => Math.round(x / step) * step;
/** Option prices quote in nickels. */
export const nickel = (x: number) => Math.round(x * 20) / 20;
