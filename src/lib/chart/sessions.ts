// Where an intraday bar starts, the same on the server (building 1h and 4h from 30-minute bars) and in the browser
// (live candles). The day runs 4:00 AM to 8:00 PM New York time in three sessions: pre-market (4:00 to 9:30), the
// regular session (9:30 to 4:00) and after-hours (4:00 to 8:00). Bars are counted from each session's start and never
// cross into the next (Ben, 2026-11-18: 1h and 4h showed the off hours as one candle), so a 1h chart has 4:00 … 8:00,
// a half-hour 9:00, then 9:30 … 3:30 (the last a half hour), then 4:00 … 7:00 PM; a 4h chart has 4:00, 8:00, 9:30,
// 1:30, 4:00 PM. For 1m to 30m that's the plain clock grid.

const SESSIONS = [
  [240, 570],
  [570, 960],
  [960, 1200],
] as const;

/** The start (minutes after midnight) of the `size`-minute bar a minute of the day falls in, or null outside 4 AM–8 PM. */
export function barStart(minuteOfDay: number, size: number): number | null {
  for (const [from, to] of SESSIONS) {
    if (minuteOfDay >= from && minuteOfDay < to) return from + Math.floor((minuteOfDay - from) / size) * size;
  }
  return null;
}

/** "2026-11-18T09:30" → minutes after midnight (570). */
export const minuteOf = (t: string) => Number(t.slice(11, 13)) * 60 + Number(t.slice(14, 16));

/** Minutes after midnight → "HH:MM". */
export const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
