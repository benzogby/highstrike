import type { SupabaseClient } from "@supabase/supabase-js";
import { bs, nickel, strikeStep, volatility } from "./options/pricing";
import { TIERS } from "./options/universe";
import { addDays, isSession, sessionBefore } from "./marketCalendar";

// Each idea's option (Ben, 2026-11-03: "each idea gets a suggested option contract, estimated from the stock's own
// volatility, marked est."). Every idea is a stock setup: a direction, an entry, a target and a time window. These rules
// turn it into one option contract with an estimated price, from HighStrike's own daily closes (price_history). No
// options data, no paid service, nothing outside: every price here is an estimate and is shown with "est.".
//
// The rules:
// 1. Kind. A long idea gets a call, a short idea a put. When that option would cost more than 5% of the stock's price,
//    it becomes a debit spread instead (if the idea has a target): buy the same option and sell the one at the target,
//    the listed strike at or just inside it and at least one strike away. That caps the gain at the target and costs
//    less.
// 2. Strike. Strikes are listed $0.50 apart under $5, $1 under $25, $2.50 under $100, $5 under $250 and $10 above
//    (src/lib/options/pricing.ts strikeStep, capped at $10). A call takes the strike at or just under the entry, a put
//    the strike at or just over it: at the money or a little in the money.
// 3. Expiry. The idea's window ends at the end of its time frame: "Today" is the day it's published, "3-5 days" five
//    trading days later, "2-4 weeks" four weeks, "1-3 months" three months, "Until Nov 15" that day (else the idea's
//    own last day). The option expires on the first Friday at least 7 days after that: any Friday for the names with
//    weekly options (tiers 1 and 2 of src/lib/options/universe.ts, the most-traded options names), else the month's
//    third Friday (the monthly, listed for every optionable stock). On a Friday the market is closed, the session
//    before, as the exchanges do.
// 4. Price. Black-Scholes (src/lib/options/pricing.ts) at the idea's entry price on the day it's published, with the
//    stock's own volatility over its last 30 trading days of closes (kept between 15% and 150% a year) and a 4.5%
//    rate. Prices are per share, rounded to $0.05; a contract is 100 shares, so it costs the price times 100, and that
//    cost is the most it can lose. Breakeven is at expiry: the strike plus (call) or minus (put) the cost. The value at
//    the target is the same formula with the stock at the target on the window's last day, with the time left then.
// 5. No option at all, rather than a bad number, when the stock has fewer than 21 daily closes in a row up to the last
//    week, when the entry is more than 20% from the latest close, or when the option would cost under $0.10.
// A pasted idea that names its own contract (strike, call or put, expiry) gets that contract priced the same way
// instead, when it matches the idea's direction, hasn't expired and its strike is within 50% of the entry.

export type OptionKind = "call" | "put" | "call_spread" | "put_spread";

export type OptionIdea = {
  /** The rules' version. */
  v: 1;
  /** "rules": picked by the rules above; "yours": the contract a pasted idea named, priced the same way. */
  pick: "rules" | "yours";
  kind: OptionKind;
  /** The strike bought; for a spread, also the strike sold. */
  strike: number;
  short: number | null;
  /** The day it expires, YYYY-MM-DD. */
  expiry: string;
  /** Est. price per share: the option's, or the spread's net cost. A contract is 100 shares. */
  premium: number;
  /** For a spread, the single option's est. price per share: the price that made it a spread. */
  single: number | null;
  /** The stock price where it breaks even at expiry. */
  breakeven: number;
  /** The idea's target, the last day of its window, and the est. price per share if the stock is at the target then. */
  target: number | null;
  windowEnd: string;
  atTarget: number | null;
  /** What it was estimated from: the stock price, its yearly volatility, the daily closes used and the day. */
  spot: number;
  vol: number;
  closes: number;
  asOf: string;
};

const MIN_CLOSES = 21;
const MAX_CLOSES = 31;
const VOL_FLOOR = 0.15;
const VOL_CAP = 1.5;
/** A single option costing more than this share of the stock's price becomes a spread. */
const SPREAD_ABOVE = 0.05;
/** The option runs at least this many days past the idea's window. */
const BUFFER_DAYS = 7;
const MIN_PREMIUM = 0.1;
const MAX_ENTRY_GAP = 0.2;

const DAY_MS = 86_400_000;
const at = (iso: string) => Date.parse(`${iso}T12:00:00Z`);
const daysBetween = (a: string, b: string) => Math.round((at(b) - at(a)) / DAY_MS);
const cents = (n: number) => Math.round(n * 100) / 100;
const isoOf = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d, 12)).toISOString().slice(0, 10);

/** Listed strike spacing at a price: $0.50 under $5, $1 under $25, $2.50 under $100, $5 under $250, $10 above. */
export const strikeGap = (price: number) => Math.min(10, strikeStep(price));
const strikeAtOrBelow = (x: number, step: number) => cents(Math.floor(x / step + 1e-9) * step);
const strikeAtOrAbove = (x: number, step: number) => cents(Math.ceil(x / step - 1e-9) * step);

const WEEKLIES = new Set([...TIERS[1], ...TIERS[2]]);
/** Names with options expiring every Friday; the rest get the monthly. */
export const listsWeeklies = (ticker: string) => WEEKLIES.has(ticker.toUpperCase());

/** `n` trading sessions after a day. */
export function addSessions(iso: string, n: number) {
  let d = iso;
  for (let k = 0; k < n; ) {
    d = addDays(d, 1);
    if (isSession(d)) k++;
  }
  return d;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** The last day of an idea's window, from its time frame ("Today", "3-5 days", "2-4 weeks", "Until Nov 15"), at most a year out. */
export function windowEnd(timeFrame: string, from: string, fallback?: string | null): string {
  const f = timeFrame.toLowerCase();
  let end: string | null = null;
  const until = /\buntil\s+([a-z]{3})[a-z]*\.?\s+(\d{1,2})\b/.exec(f);
  if (/\b(today|intraday|0 ?dte|eod)\b/.test(f)) end = from;
  else if (until && MONTHS.includes(until[1])) {
    const y = Number(from.slice(0, 4));
    const m = MONTHS.indexOf(until[1]);
    const d = Number(until[2]);
    end = isoOf(y, m, d) >= from ? isoOf(y, m, d) : isoOf(y + 1, m, d);
  } else {
    const nums = (f.match(/\d+(?:\.\d+)?/g) ?? []).map(Number).filter((n) => n > 0);
    const top = nums.length ? Math.max(...nums) : 1;
    // A member types their own time frame: anything past a year is a year.
    const days = (n: number) => addDays(from, Math.min(366, Math.round(n)));
    if (/week/.test(f)) end = days(top * 7);
    else if (/month/.test(f)) end = days(top * 30);
    else if (/year/.test(f)) end = days(top * 365);
    else if (nums.length && /day|session/.test(f)) end = addSessions(from, Math.min(260, Math.round(top)));
  }
  if (!end) end = fallback && fallback >= from ? fallback : addSessions(from, 5);
  const cap = addDays(from, 365);
  return end > cap ? cap : end;
}

function thirdFriday(y: number, m: number) {
  const first = new Date(Date.UTC(y, m, 1, 12)).getUTCDay();
  return isoOf(y, m, 1 + ((5 - first + 7) % 7) + 14);
}

/** The expiry for a window ending on `end`: the first listed Friday at least a week later (rule 3). */
export function expiryFor(end: string, weekly: boolean): string {
  const earliest = addDays(end, BUFFER_DAYS);
  let friday: string;
  if (weekly) {
    friday = addDays(earliest, (5 - new Date(`${earliest}T12:00:00Z`).getUTCDay() + 7) % 7);
  } else {
    const y = Number(earliest.slice(0, 4));
    const m = Number(earliest.slice(5, 7)) - 1;
    friday = thirdFriday(y, m);
    if (friday < earliest) friday = thirdFriday(m === 11 ? y + 1 : y, (m + 1) % 12);
  }
  // A Friday the market is closed: that week's options expire the session before.
  while (!isSession(friday)) friday = addDays(friday, -1);
  return friday;
}

export type CloseRow = { day: string; close: number };

/**
 * One close per trading session, oldest first: the latest unbroken run before `asOf`, at most 31. From price_history,
 * where the morning job records the last session's close before the open every day, weekends too, so a row dated D
 * holds the close of the session before D. Empty when the latest close is more than a week old.
 */
export function sessionCloses(rows: CloseRow[], asOf: string, max = MAX_CLOSES): number[] {
  const bySession = new Map<string, number>();
  for (const r of [...rows].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0))) {
    const close = Number(r.close);
    if (r.day > asOf || !(close > 0)) continue;
    const s = sessionBefore(r.day);
    if (!bySession.has(s)) bySession.set(s, close);
  }
  let s = sessionBefore(asOf);
  for (let k = 0; k < 5 && !bySession.has(s); k++) s = sessionBefore(s);
  const out: number[] = [];
  while (bySession.has(s) && out.length < max) {
    out.push(bySession.get(s)!);
    s = sessionBefore(s);
  }
  return out.reverse();
}

/** The stock's yearly volatility from its daily closes (src/lib/options/pricing.ts), kept between 15% and 150%. */
export const yearlyVol = (closes: number[]) => Math.min(VOL_CAP, Math.max(VOL_FLOOR, volatility(closes)));

export type Named = { type: "call" | "put"; strike: number; expiry: string };

/** A contract an idea names in words like "190C 11/15 @ 2.4" or "190 calls", with its expiry: its kind and strike. */
export function namedContract(text: string | null | undefined, expiry: string | null | undefined): Named | null {
  const m = /\b(\d{1,5}(?:\.\d{1,2})?)\s?(c|p|calls?|puts?)\b/i.exec(text ?? "");
  if (!m || !expiry || !/^\d{4}-\d{2}-\d{2}$/.test(expiry)) return null;
  return { type: /^c/i.test(m[2]) ? "call" : "put", strike: Number(m[1]), expiry };
}

export type OptionInput = {
  ticker: string;
  direction: "long" | "short";
  /** The idea's entry: the strike is picked from it, and the option priced at it. */
  entry: number | null;
  target: number | null;
  timeFrame: string;
  /** The day it's estimated: the day the idea is published. */
  asOf: string;
  /** The idea's own last day, for a time frame that doesn't say. */
  expiresOn?: string | null;
  /** Daily closes, oldest first (sessionCloses). */
  closes: number[];
  /** A contract the idea already names (a pasted one). */
  named?: Named | null;
};

/** The idea's option by the rules above, or null when there isn't enough to estimate it well. Pure; never throws. */
export function suggestOption(i: OptionInput): OptionIdea | null {
  try {
    return estimate(i);
  } catch {
    return null;
  }
}

function estimate(i: OptionInput): OptionIdea | null {
  const S = Number(i.entry);
  if (!(S > 0) || i.closes.length < MIN_CLOSES) return null;
  if (Math.abs(S / i.closes[i.closes.length - 1] - 1) > MAX_ENTRY_GAP) return null;
  const long = i.direction === "long";
  const type = long ? "call" : "put";
  const vol = yearlyVol(i.closes);
  const end = windowEnd(i.timeFrame, i.asOf, i.expiresOn);
  const target = i.target != null && (long ? Number(i.target) > S : Number(i.target) < S) ? Number(i.target) : null;
  const value = (K: number, stock: number, from: string, expiry: string) => bs(type, stock, K, Math.max(0, daysBetween(from, expiry)) / 365, vol);

  // A named contract counts when it's this idea's kind, hasn't expired, and its strike is near the stock (not a count of
  // contracts or a typo).
  const n = i.named;
  const named = n && n.type === type && n.expiry > i.asOf && n.strike > S * 0.5 && n.strike < S * 1.5 ? n : null;
  const step = strikeGap(S);
  const strike = named ? cents(named.strike) : long ? strikeAtOrBelow(S, step) : strikeAtOrAbove(S, step);
  const expiry = named ? named.expiry : expiryFor(end, listsWeeklies(i.ticker));

  const single = nickel(value(strike, S, i.asOf, expiry));
  if (single < MIN_PREMIUM) return named ? estimate({ ...i, named: null }) : null;

  let kind: OptionKind = type;
  let short: number | null = null;
  let premium = single;
  let atTarget = target != null ? value(strike, target, end, expiry) : null;
  if (!named && target != null && single > SPREAD_ABOVE * S) {
    let sold = long ? strikeAtOrBelow(target, step) : strikeAtOrAbove(target, step);
    if (long ? sold <= strike : sold >= strike) sold = cents(long ? strike + step : strike - step);
    const net = nickel(value(strike, S, i.asOf, expiry) - value(sold, S, i.asOf, expiry));
    if (sold > 0 && net >= MIN_PREMIUM && net < Math.abs(sold - strike)) {
      kind = long ? "call_spread" : "put_spread";
      short = sold;
      premium = net;
      atTarget = value(strike, target, end, expiry) - value(sold, target, end, expiry);
    }
  }

  return {
    v: 1,
    pick: named ? "yours" : "rules",
    kind,
    strike,
    short,
    expiry,
    premium,
    single: short != null ? single : null,
    breakeven: cents(long ? strike + premium : strike - premium),
    target,
    windowEnd: end,
    atTarget: atTarget != null ? nickel(atTarget) : null,
    spot: cents(S),
    vol: Math.round(vol * 1000) / 1000,
    closes: i.closes.length,
    asOf: i.asOf,
  };
}

/** Each ticker's daily closes for an estimate made on `asOf`, from HighStrike's own price_history (sessionCloses). */
export async function closesFor(db: SupabaseClient, tickers: string[], asOf: string): Promise<Map<string, number[]>> {
  const since = addDays(asOf, -55);
  const out = new Map<string, number[]>();
  await Promise.all(
    [...new Set(tickers)].map(async (t) => {
      const { data } = await db.from("price_history").select("price_date, close").eq("ticker", t).gte("price_date", since).lte("price_date", asOf).order("price_date").limit(200);
      const rows = ((data ?? []) as { price_date: string; close: number }[]).map((r) => ({ day: r.price_date, close: Number(r.close) }));
      out.set(t, sessionCloses(rows, asOf));
    })
  );
  return out;
}

/** An option read back from the database, checked; null for anything else. */
export function asOption(x: unknown): OptionIdea | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Partial<OptionIdea>;
  const num = (n: unknown) => typeof n === "number" && Number.isFinite(n);
  const day = (d: unknown) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);
  const kinds: OptionKind[] = ["call", "put", "call_spread", "put_spread"];
  if (o.v !== 1 || !kinds.includes(o.kind as OptionKind) || (o.pick !== "rules" && o.pick !== "yours")) return null;
  if (!num(o.strike) || !num(o.premium) || !num(o.breakeven) || !num(o.spot) || !num(o.vol) || !num(o.closes)) return null;
  if (!day(o.expiry) || !day(o.asOf) || !day(o.windowEnd)) return null;
  return o as OptionIdea;
}

// How an option reads, everywhere it shows.

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "Nov 20"; with the year when it isn't `sameYearAs`'s: "Jan 15, 2027". */
export function dayLabel(iso: string, sameYearAs?: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${MON[m - 1]} ${d}${sameYearAs && sameYearAs.slice(0, 4) !== iso.slice(0, 4) ? `, ${y}` : ""}`;
}
/** A price per share: "$8.40". */
export const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
/** Whole dollars, for a contract: "$840". */
export const dollars = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
export const strikeLabel = (k: number) => `$${Number.isInteger(k) ? k : k.toFixed(2)}`;
const strikesOf = (o: OptionIdea) => (o.short != null ? `${strikeLabel(o.strike)}/${strikeLabel(o.short)}` : strikeLabel(o.strike));
const KIND: Record<OptionKind, string> = { call: "call", put: "put", call_spread: "call spread", put_spread: "put spread" };
/** "Call", "Put spread". */
export const kindLabel = (o: OptionIdea) => KIND[o.kind].charAt(0).toUpperCase() + KIND[o.kind].slice(1);
/** "Nov 20 $340 call", "Nov 20 $390/$410 call spread". */
export const contractShort = (o: OptionIdea) => `${dayLabel(o.expiry, o.asOf)} ${strikesOf(o)} ${KIND[o.kind]}`;
/** "AAPL Nov 20 $340 call". */
export const contractName = (ticker: string, o: OptionIdea) => `${ticker} ${contractShort(o)}`;
/** The compact line on a card: "Call · Nov 20 $340 · est. $8.40". */
export const optionLine = (o: OptionIdea) => `${kindLabel(o)} · ${dayLabel(o.expiry, o.asOf)} ${strikesOf(o)} · est. ${usd(o.premium)}`;
/** What one contract costs, in dollars: the most it can lose. */
export const costOf = (o: OptionIdea) => Math.round(o.premium * 100);
/** The est. gain or loss at the target, in percent of the cost. */
export const gainAtTarget = (o: OptionIdea) => (o.atTarget != null && o.premium > 0 ? Math.round(((o.atTarget - o.premium) / o.premium) * 100) : null);

/** The plain line on what the option is and why it's this one. */
export function optionWhy(ticker: string, o: OptionIdea) {
  const call = o.kind === "call" || o.kind === "call_spread";
  const move = call ? "rises" : "falls";
  if (o.short != null) {
    const kind = call ? "call" : "put";
    return `Buy the ${strikeLabel(o.strike)} ${kind} and sell the ${strikeLabel(o.short)} ${kind}: it gains if ${ticker} ${move}, tops out at ${strikeLabel(o.short)}, and costs less than the ${kind} alone (est. ${usd(o.single ?? o.premium)}, over 5% of the stock's price).`;
  }
  if (o.pick === "yours") return `The contract you pasted, priced the same way. A ${call ? "call" : "put"} gains if ${ticker} ${move}, and the most it can lose is what you pay.`;
  return `A ${call ? "call" : "put"} gains if ${ticker} ${move}, and the most it can lose is what you pay. Its strike is at or just ${call ? "below" : "above"} the entry, and it expires a week or more after the idea's window.`;
}
