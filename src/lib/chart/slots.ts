// Time to scale (Ben, 2026-11-18: "Make sure all days and nights are horizontally to scale (including into the future),
// regardless of how much price data are in them"). Every trading day gets the same row of bar slots, 4:00 AM to 8:00 PM
// New York time counted per session (src/lib/chart/sessions.ts), and every trading day, week, month or year gets its
// slot on dated charts, whether or not anything traded in it. A slot with no trades holds an `empty` bar: drawn as
// nothing, priced at the last close so nothing that reads it jumps. An option contract that trades a few times a day
// takes as much room per day as the stock does, and the future (an expiry) is laid out the same way.

import { addDays, isSession } from "@/lib/marketCalendar";
import { barStart, hhmm, minuteOf } from "@/lib/chart/sessions";
import type { Candle } from "@/lib/chart/types";
import type { Span } from "@/lib/chart/live";

const SESSIONS = [
  [240, 570],
  [570, 960],
  [960, 1200],
] as const;

/** The bar starts (minutes after midnight) of one trading day for a bar size: the same every day. */
export function daySlots(size: number): number[] {
  const out: number[] = [];
  for (const [from, to] of SESSIONS) for (let m = from; m < to; m += size) out.push(m);
  return out;
}

const placeholder = (t: string, close: number): Candle => ({ t, o: close, h: close, l: close, c: close, v: 0, empty: true });

/** Intraday bars laid on every slot of every trading day from the first bar to the last. */
export function fillIntraday(bars: Candle[], size: number): Candle[] {
  if (bars.length < 2) return bars;
  const slots = daySlots(size);
  const byKey = new Map<string, Candle>();
  for (const b of bars) {
    const s = barStart(minuteOf(b.t), size);
    if (s == null) continue;
    const k = `${b.t.slice(0, 10)}T${hhmm(s)}`;
    const had = byKey.get(k);
    byKey.set(k, had ? { ...had, h: Math.max(had.h, b.h), l: Math.min(had.l, b.l), c: b.c, v: had.v + b.v, live: had.live || b.live } : { ...b, t: k });
  }
  const dates = new Set(bars.map((b) => b.t.slice(0, 10)));
  const first = bars[0].t;
  const last = bars[bars.length - 1].t;
  const out: Candle[] = [];
  let close = bars[0].o;
  for (let d = first.slice(0, 10), guard = 0; d <= last.slice(0, 10) && guard < 4000; d = addDays(d, 1), guard++) {
    if (!isSession(d) && !dates.has(d)) continue;
    for (const s of slots) {
      const t = `${d}T${hhmm(s)}`;
      if (t < first.slice(0, 16) && !byKey.has(t)) continue;
      if (t > last.slice(0, 16) && !byKey.has(t)) continue;
      const b = byKey.get(t);
      if (b) {
        out.push(b);
        close = b.c;
      } else out.push(placeholder(t, close));
    }
  }
  return out;
}

/** The period a dated bar belongs to, and the next one: days (trading days), weeks (Mondays), months, years. */
function periods(span: Span) {
  if (span === "W")
    return {
      key: (t: string) => {
        const d = new Date(`${t.slice(0, 10)}T12:00:00Z`);
        return addDays(t.slice(0, 10), -((d.getUTCDay() + 6) % 7));
      },
      next: (k: string) => addDays(k, 7),
    };
  if (span === "M") return { key: (t: string) => `${t.slice(0, 7)}-01`, next: (k: string) => `${new Date(Date.UTC(Number(k.slice(0, 4)), Number(k.slice(5, 7)), 1)).toISOString().slice(0, 7)}-01` };
  if (span === "Y") return { key: (t: string) => `${t.slice(0, 4)}-01-01`, next: (k: string) => `${Number(k.slice(0, 4)) + 1}-01-01` };
  return {
    key: (t: string) => t.slice(0, 10),
    next: (k: string) => {
      let d = addDays(k, 1);
      for (let g = 0; !isSession(d) && g < 10; g++) d = addDays(d, 1);
      return d;
    },
  };
}

/** Dated bars with a slot for every trading day (week, month, year) between the first and the last. */
export function fillDated(bars: Candle[], span: Span): Candle[] {
  if (bars.length < 2) return bars;
  const { key, next } = periods(span);
  const out: Candle[] = [bars[0]];
  for (let i = 1; i < bars.length; i++) {
    const want = key(bars[i].t);
    for (let k = next(key(out[out.length - 1].t)), g = 0; k < want && g < 4000; k = next(k), g++) out.push(placeholder(k, out[out.length - 1].c));
    out.push(bars[i]);
  }
  return out;
}

/** A study (moving average, RSI) worked out on the real bars only, laid back on the slots (null on empty ones). */
export function onReal(bars: Candle[], study: (real: Candle[]) => (number | null)[]): (number | null)[] {
  const idx: number[] = [];
  const real: Candle[] = [];
  bars.forEach((b, i) => {
    if (!b.empty) {
      idx.push(i);
      real.push(b);
    }
  });
  if (real.length === bars.length) return study(bars);
  const vals = study(real);
  const out: (number | null)[] = bars.map(() => null);
  idx.forEach((i, j) => (out[i] = vals[j]));
  return out;
}
