import type { Candle } from "./types";
import { barStart, hhmm, minuteOf } from "./sessions";

// Live candles (Ben, 2026-11-18: "a live moving chart, candles reacting to prices"): the live prices seen since the
// chart opened (from /api/live every few seconds), folded into the bars of the timeframe on screen. The bar a price
// falls in grows with it (its high and low stretch, its close follows); a price in a new period starts a new bar.
// Intraday periods line up with the server's bars: 4:00 AM to 8:00 PM, counted from each session's start.

export type Tick = { price: number; at: number; open: number | null; high: number | null; low: number | null };

const NY = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
/** A moment as New York wall time, "2026-11-18T10:37". */
export function nyStamp(ms: number) {
  const p = Object.fromEntries(NY.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour === "24" ? "00" : p.hour}:${p.minute}`;
}

/** The start of the bar a moment falls in: its day for daily, the Monday's date for weekly, else "YYYY-MM-DDTHH:MM". */
function periodOf(ms: number, minutes: number | null, weekly: boolean): string | null {
  const s = nyStamp(ms);
  const date = s.slice(0, 10);
  if (weekly) {
    const d = new Date(`${date}T12:00:00Z`);
    const dow = (d.getUTCDay() + 6) % 7;
    return new Date(d.getTime() - dow * 86_400_000).toISOString().slice(0, 10);
  }
  if (!minutes) return date;
  // 4:00 AM to 8:00 PM, counted from each session's start like the server's bars (src/lib/chart/sessions.ts).
  const start = barStart(minuteOf(s), minutes);
  return start == null ? null : `${date}T${hhmm(start)}`;
}

/** The bars with the live prices folded in. */
export function withLive(bars: Candle[], ticks: Tick[], minutes: number | null, weekly: boolean): Candle[] {
  if (!ticks.length || !bars.length) return bars;
  const out = bars.slice();
  // Weekly bars are stamped with their first trading day, which can be after the Monday: compare by week.
  const weekOf = (t: string) => periodOf(Date.parse(`${t.slice(0, 10)}T17:00:00Z`), null, true);
  for (const tk of ticks) {
    // Daily and weekly bars are the regular session: prices before the open or after the close don't move them.
    if (!minutes) {
      const hm = nyStamp(tk.at).slice(11, 16);
      if (hm < "09:30" || hm >= "16:00") continue;
    }
    const period = periodOf(tk.at, minutes, weekly);
    if (!period) continue;
    const last = out[out.length - 1];
    const lastKey = weekly ? weekOf(last.t) : last.t;
    if (lastKey === period) {
      // On a daily or weekly bar the quote's own day high and low are the truth; intraday, the prices seen.
      const hi = !minutes && tk.high ? tk.high : tk.price;
      const lo = !minutes && tk.low ? tk.low : tk.price;
      out[out.length - 1] = { ...last, h: Math.max(last.h, hi, tk.price), l: Math.min(last.l, lo, tk.price), c: tk.price, live: true };
    } else if (period > lastKey!) {
      const o = !minutes && tk.open ? tk.open : tk.price;
      out.push({
        t: period,
        o,
        h: Math.max(o, tk.price, !minutes && tk.high ? tk.high : tk.price),
        l: Math.min(o, tk.price, !minutes && tk.low ? tk.low : tk.price),
        c: tk.price,
        v: 0,
        live: true,
      });
    }
  }
  return out;
}
