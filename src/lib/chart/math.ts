import type { Candle } from "./types";

// HighStrike Chart's arithmetic: weekly bars, moving averages, RSI and the time axis. Pure; shared by the chart and
// anything that wants the same numbers (the planner, the backtester).

/** Daily bars rolled into weeks (Monday to Friday), each stamped with its first trading day. */
export const toWeekly = (daily: Candle[]) => rollup(daily, weekKey);
/** Daily bars rolled into calendar months, each stamped with its first trading day. */
export const toMonthly = (daily: Candle[]) => rollup(daily, (t) => t.slice(0, 7));
/** Daily bars rolled into calendar years, each stamped with its first trading day. */
export const toYearly = (daily: Candle[]) => rollup(daily, (t) => t.slice(0, 4));

function rollup(daily: Candle[], keyOf: (t: string) => string): Candle[] {
  const out: Candle[] = [];
  let key = "";
  for (const d of daily) {
    const k = keyOf(d.t);
    const last = out[out.length - 1];
    if (k !== key || !last) {
      out.push({ ...d });
      key = k;
    } else {
      last.h = Math.max(last.h, d.h);
      last.l = Math.min(last.l, d.l);
      last.c = d.c;
      last.v += d.v;
      if (d.live) last.live = true;
    }
  }
  return out;
}

/** The Monday of a date's week, as a date string. */
function weekKey(t: string) {
  const d = new Date(`${t}T12:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // Monday 0
  return new Date(d.getTime() - dow * 86_400_000).toISOString().slice(0, 10);
}

/** Simple moving average of the closes; null until there are `n` bars. */
export function sma(bars: Candle[], n: number): (number | null)[] {
  const out: (number | null)[] = [];
  let sum = 0;
  bars.forEach((b, i) => {
    sum += b.c;
    if (i >= n) sum -= bars[i - n].c;
    out.push(i >= n - 1 ? sum / n : null);
  });
  return out;
}

/** Wilder's RSI over `n` bars (14 by default); null until there's enough history. */
export function rsi(bars: Candle[], n = 14): (number | null)[] {
  const out: (number | null)[] = bars.map(() => null);
  if (bars.length <= n) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= n; i++) {
    const ch = bars[i].c - bars[i - 1].c;
    if (ch > 0) gain += ch;
    else loss -= ch;
  }
  gain /= n;
  loss /= n;
  out[n] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  for (let i = n + 1; i < bars.length; i++) {
    const ch = bars[i].c - bars[i - 1].c;
    gain = (gain * (n - 1) + Math.max(ch, 0)) / n;
    loss = (loss * (n - 1) + Math.max(-ch, 0)) / n;
    out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  }
  return out;
}

/** A bar's time in minutes: "2026-11-18" (a daily bar, at noon) or "2026-11-18T09:35" (New York wall time). */
const minuteNum = (t: string) => Math.round(Date.parse(t.length > 10 ? `${t}:00Z` : `${t}T12:00:00Z`) / 60_000);
const fromMinuteNum = (n: number, intraday: boolean) => {
  const iso = new Date(n * 60_000).toISOString();
  return intraday ? iso.slice(0, 16) : iso.slice(0, 10);
};

/**
 * Times ↔ bar positions. A time inside the series lands on its bar (or between the bars around it); one past the last
 * bar is placed by the series' pace (7/5 days a bar for daily, 7 for weekly, the bar's minutes for intraday), so
 * drawings can reach into the future and stay put when new bars arrive. Daily and intraday anchors work on either
 * kind of chart: a date alone means noon that day. `pace` is `true` for weekly, `false` for daily, or minutes a bar.
 */
export function timeScale(bars: Candle[], pace: boolean | number) {
  // Minutes a bar under a day is intraday (times); a day or more (monthly, yearly) is dated.
  const intraday = typeof pace === "number" && pace < 1440;
  const step = typeof pace === "number" ? pace : pace ? 7 * 1440 : (7 / 5) * 1440;
  const nums = bars.map((b) => minuteNum(b.t));
  const first = nums[0] ?? 0;
  const last = nums[nums.length - 1] ?? 0;
  return {
    /** A time's position in bars (fractional between bars, beyond the ends by the pace). */
    index(t: string): number {
      const n = minuteNum(t);
      if (nums.length === 0) return 0;
      if (n >= last) return nums.length - 1 + (n - last) / step;
      if (n <= first) return (n - first) / step;
      let lo = 0;
      let hi = nums.length - 1;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (nums[mid] <= n) lo = mid;
        else hi = mid;
      }
      return lo + (n - nums[lo]) / Math.max(1, nums[hi] - nums[lo]);
    },
    /** The time at a bar position: a date for daily and weekly charts, a date and time for intraday ones. */
    date(i: number): string {
      if (nums.length === 0) return fromMinuteNum(0, intraday);
      if (i >= nums.length - 1) return fromMinuteNum(Math.round(last + (i - (nums.length - 1)) * step), intraday);
      if (i <= 0) return fromMinuteNum(Math.round(first + i * step), intraday);
      const lo = Math.floor(i);
      return fromMinuteNum(Math.round(nums[lo] + (i - lo) * (nums[lo + 1] - nums[lo])), intraday);
    },
  };
}

/** Round, readable price ticks covering lo..hi, about `count` of them. */
export function niceTicks(lo: number, hi: number, count = 6): number[] {
  const span = hi - lo;
  if (!(span > 0)) return [lo];
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) out.push(Number(v.toFixed(6)));
  return out;
}

/** A price as the axis shows it: cents under $1,000, whole dollars above. */
export const priceLabel = (p: number) => (Math.abs(p) >= 1000 ? p.toLocaleString("en-US", { maximumFractionDigits: 0 }) : p.toFixed(2));

/** Volume as "12.3M". */
export function volumeLabel(v: number) {
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return String(Math.round(v));
}

/** Fibonacci retracement levels, from the swing's start (0) to its end (1). */
export const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
