import type { Style } from "@/lib/ideas";

// Paste any idea (piece 3 of the trade-ideas plan, Ben 2026-11-02, built without AI: "Do this all without AI APIs"):
// reads a trade alert pasted from anywhere (a tweet, a Discord call, a text) with plain rules and pulls out what makes it
// an idea: the ticker, long or short, an option contract, the entry, target and stop, and how long it's meant to run.
// What it can't find is left blank for the member to fill in before saving. Pure; no I/O.

export type Parsed = {
  ticker: string | null;
  direction: "long" | "short" | null;
  style: Style;
  timeFrame: string;
  /** Stock prices. */
  entry: number | null;
  target: number | null;
  stop: number | null;
  /** The option contract, when one is named. */
  option: { strike: number; type: "call" | "put"; expiry: string | null; premium: number | null } | null;
  /** What the reader recognized, in plain words, for the member to check. */
  found: string[];
};

// Uppercase words that look like tickers but aren't.
const NOT_TICKERS = new Set(
  "A ALERT ALERTS I AM AN AND ARE AS AT ATH ATM BE BUY BY CALL CALLS CEO CPI DD DM DTE EOD EOW EPS ETF FED FOMC FOR FROM GDP HOD IF IMO IN IPO IS IT ITM IV LOD LONG MY NEW NFA NO NOT NOW OF OK ON OR OTM PM PT PUT PUTS RSI SEC SELL SHORT SL SO SPAC TA THE TO TP UP US USA USD VWAP WE YOLO".split(" ")
);

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const NUM = String.raw`\$?(\d{1,6}(?:\.\d{1,4})?)`;

function firstNumber(text: string, words: string): number | null {
  const m = new RegExp(String.raw`(?:${words})s?\b\s*(?:is|at|of|:|=|-|around|near|~)?\s*${NUM}`, "i").exec(text);
  return m ? Number(m[1]) : null;
}

/** "11/15", "11/15/26", "Nov 15", "15 Nov": the next such date on or after `today`, as YYYY-MM-DD. */
function expiryOf(text: string, today: Date): string | null {
  let month: number | null = null;
  let day: number | null = null;
  let year: number | null = null;
  const slash = /\b(1[0-2]|0?[1-9])\/(3[01]|[12]\d|0?[1-9])(?:\/(\d{2,4}))?\b/.exec(text);
  const named = /\b(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\.?\s+(3[01]|[12]\d|0?[1-9])\b/i.exec(text) ?? /\b(3[01]|[12]\d|0?[1-9])\s+(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\b/i.exec(text);
  if (slash) {
    month = Number(slash[1]);
    day = Number(slash[2]);
    if (slash[3]) year = slash[3].length === 2 ? 2000 + Number(slash[3]) : Number(slash[3]);
  } else if (named) {
    const [a, b] = [named[1], named[2]];
    month = MONTHS[(isNaN(Number(a)) ? a : b).toLowerCase().slice(0, 4).replace(/t$/, "")] ?? MONTHS[(isNaN(Number(a)) ? a : b).toLowerCase().slice(0, 3)];
    day = Number(isNaN(Number(a)) ? b : a);
  } else if (/\b0\s?dte\b/i.test(text)) {
    return today.toISOString().slice(0, 10);
  }
  if (!month || !day) return null;
  const y = year ?? today.getUTCFullYear();
  let d = new Date(Date.UTC(y, month - 1, day, 12));
  if (!year && d.getTime() < today.getTime() - 86_400_000) d = new Date(Date.UTC(y + 1, month - 1, day, 12));
  return d.toISOString().slice(0, 10);
}

export function parseIdea(raw: string, today = new Date()): Parsed {
  const text = raw.replace(/\s+/g, " ").trim();
  const found: string[] = [];

  // The ticker: a $cashtag first, else the first uppercase word that isn't trading slang.
  const cash = /\$([A-Za-z]{1,5}(?:\.[A-Za-z])?)\b(?!\d)/.exec(text);
  let ticker = cash ? cash[1].toUpperCase() : null;
  if (!ticker) {
    for (const m of text.matchAll(/\b([A-Z]{1,5})\b/g)) {
      if (!NOT_TICKERS.has(m[1])) {
        ticker = m[1];
        break;
      }
    }
  }
  if (ticker) found.push(`Ticker ${ticker}`);

  // An option contract: "190c", "190 calls", "190C 11/15", "11/15 190p".
  const opt = /\b(\d{1,5}(?:\.\d{1,2})?)\s?(c|p|calls?|puts?)\b/i.exec(text);
  const expiry = expiryOf(text, today);
  let option: Parsed["option"] = null;
  if (opt) {
    const type = /^c/i.test(opt[2]) ? "call" : "put";
    const strike = Number(opt[1]);
    // A small number after "@" or "at" with a contract named is what the contract cost, not the stock.
    const paid = /(?:@|\bat\b|\bfor\b|\bfilled\b|\bpaid\b)\s*\$?(\d{1,3}(?:\.\d{1,2})?)\b/i.exec(text);
    const premium = paid && Number(paid[1]) < strike * 0.25 ? Number(paid[1]) : null;
    option = { strike, type, expiry, premium };
    found.push(`${type === "call" ? "Call" : "Put"} at the $${strike} strike${expiry ? `, expiring ${expiry}` : ""}${premium != null ? `, paid $${premium}` : ""}`);
  }

  // Long or short: the contract decides; else the words.
  let direction: Parsed["direction"] = option ? (option.type === "call" ? "long" : "short") : null;
  if (!direction) {
    const longWords = /\b(long|buy(?:ing)?|bought|bull(?:ish)?|upside|breakout|calls?|adding|accumulat\w*|going up|rip)\b/i.test(text);
    const shortWords = /\b(short(?:ing)?|sell(?:ing)?|sold|bear(?:ish)?|downside|breakdown|puts?|fade|dump|going down)\b/i.test(text);
    direction = longWords && !shortWords ? "long" : shortWords && !longWords ? "short" : null;
  }
  if (direction) found.push(direction === "long" ? "Long (expects it to go up)" : "Short (expects it to go down)");

  // Prices. The entry is a stock price unless it's the option's premium.
  let entry = firstNumber(text, String.raw`entry|entered|enter|in at|bought at|buy at|buying at|avg|average|got in at|starter at`);
  if (entry == null && !option) {
    const at = /(?:@|\bat\b)\s*\$?(\d{1,6}(?:\.\d{1,4})?)/i.exec(text);
    if (at) entry = Number(at[1]);
  }
  if (option && entry != null && entry < option.strike * 0.25) entry = null;
  const target = firstNumber(text, String.raw`price target|target|tgt|pt|tp|take profit|exit at|sell at|looking for|aiming for`);
  const stop = firstNumber(text, String.raw`stop loss|stop|sl|stopped|invalidat(?:ion|ed)|cut (?:it )?(?:at|below|above)|risk to`);
  if (entry != null) found.push(`Entry $${entry}`);
  if (target != null) found.push(`Target $${target}`);
  if (stop != null) found.push(`Stop $${stop}`);

  // How long it runs: the words, else the contract's expiry.
  const until = (iso: string) => `Until ${new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`;
  let style: Style = "swing";
  let timeFrame = "1-2 weeks";
  const daysOut = option?.expiry ? Math.round((Date.parse(`${option.expiry}T12:00:00Z`) - today.getTime()) / 86_400_000) : null;
  if (/\b(scalp|day ?trade|intraday|0\s?dte|lotto|eod)\b/i.test(text) || (daysOut != null && daysOut <= 1)) {
    style = "day";
    timeFrame = "Today";
  } else if (/\b(long[ -]?term|leaps?|months?|invest(?:ment|ing)?|hold(?:ing)? for)\b/i.test(text) || (daysOut != null && daysOut > 35)) {
    style = "long";
    timeFrame = daysOut != null && daysOut > 35 ? until(option!.expiry!) : "1-3 months";
  } else if (daysOut != null) {
    timeFrame = until(option!.expiry!);
  } else if (/\b(this week|few days|next week)\b/i.test(text)) {
    timeFrame = "3-5 days";
  }
  found.push(style === "day" ? "Day trade" : style === "long" ? "Long-term" : "Swing");

  return { ticker, direction, style, timeFrame, entry, target, stop, option, found };
}

/** "190C 11/15 @ 2.40" for the idea's contract column. */
export const contractLabel = (o: NonNullable<Parsed["option"]>) =>
  `${o.strike}${o.type === "call" ? "C" : "P"}${o.expiry ? ` ${o.expiry.slice(5).replace("-", "/")}` : ""}${o.premium != null ? ` @ ${o.premium}` : ""}`;
