import { supabaseService } from "@/lib/stripe";
import { massiveKey } from "@/lib/candles";
import { marketOpen, newYorkDate } from "@/lib/marketCalendar";
import { bs } from "@/lib/options/pricing";

// Real option prices (docs/plans/offer-overhaul.md item 5) from Massive, formerly Polygon. Two levels, picked by what
// the account allows:
// - Options Starter (paid): the contract's snapshot, 15 minutes delayed: bid/ask, Massive's implied volatility, delta,
//   open interest.
// - The free plan: the real listed contract (strikes and expiries as listed) and its last session's closing price;
//   the implied volatility is worked out from that price (Black-Scholes, solved for volatility against the stock's close).
// Every answer says which it is. Kept in public.market_cache so the free plan's 5 calls a minute serve every member.
// Never made up: no data comes back as null and the page keeps its estimate, marked est.

export type OptionQuote = {
  contract: string;
  type: "call" | "put";
  strike: number;
  expiry: string;
  /** Per share. */
  price: number;
  /** mid: halfway between a delayed bid and ask; close: the last session's closing trade. */
  priceKind: "mid" | "close";
  /** YYYY-MM-DD of a close, or an ISO time for a delayed quote. */
  asOf: string;
  bid: number | null;
  ask: number | null;
  /** Yearly, as a fraction; and where it came from. */
  iv: number | null;
  ivFrom: "massive" | "price" | null;
  delta: number | null;
  volume: number | null;
  openInterest: number | null;
};

const HOSTS = ["https://api.massive.com", "https://api.polygon.io"];
const DAY = 86_400_000;
const PRO_RECHECK_MS = 6 * 3_600_000;
let proMemo: { ok: boolean; at: number } | null = null;

class Busy extends Error {}

async function get<T>(path: string, key: string): Promise<{ status: number; body: T | null }> {
  let last: { status: number; body: T | null } = { status: 0, body: null };
  for (const host of HOSTS) {
    try {
      const res = await fetch(`${host}${path}`, { headers: { Authorization: `Bearer ${key}` }, cache: "no-store", signal: AbortSignal.timeout(6000) });
      if (res.status === 429) throw new Busy();
      const body = res.ok ? ((await res.json()) as T) : null;
      last = { status: res.status, body };
      if (res.ok || res.status === 401 || res.status === 403 || res.status === 404) return last;
    } catch (e) {
      if (e instanceof Busy) throw e;
    }
  }
  return last;
}

function db() {
  try {
    return supabaseService();
  } catch {
    return null;
  }
}

async function cached<T>(key: string, maxAgeMs: number, load: () => Promise<T | null>): Promise<T | null> {
  const store = db();
  const { data } = store ? await store.from("market_cache").select("body, fetched_at").eq("key", key).maybeSingle() : { data: null };
  if (data && Date.now() - Date.parse(data.fetched_at) < maxAgeMs) return data.body as T;
  try {
    const fresh = await load();
    if (fresh != null && store) await store.from("market_cache").upsert({ key, body: fresh, fetched_at: new Date().toISOString() });
    return fresh ?? (data?.body as T) ?? null;
  } catch (e) {
    if (e instanceof Busy && data) return data.body as T;
    throw e;
  }
}

/** How long a price stays good: 15 minutes in market hours, else until the next session (about 6 hours at a time). */
const priceAge = () => (marketOpen(Date.now()) ? 15 * 60_000 : 6 * 3_600_000);

type Listed = { ticker: string; strike: number; expiry: string };

/** The listed contracts of one kind expiring on or after `from` (the next ~200), strikes within 25% of `near`. */
async function listed(underlying: string, type: "call" | "put", from: string, near: number, key: string) {
  const lo = Math.floor(near * 0.75);
  const hi = Math.ceil(near * 1.25);
  return cached<Listed[]>(`contracts:${underlying}:${type}:${from}:${lo}-${hi}`, DAY, async () => {
    const q = new URLSearchParams({
      underlying_ticker: underlying,
      contract_type: type,
      "expiration_date.gte": from,
      "strike_price.gte": String(lo),
      "strike_price.lte": String(hi),
      order: "asc",
      sort: "expiration_date",
      limit: "250",
    });
    const { body } = await get<{ results?: { ticker: string; strike_price: number; expiration_date: string }[] }>(`/v3/reference/options/contracts?${q}`, key);
    if (!body) return null;
    return (body.results ?? []).map((r) => ({ ticker: r.ticker, strike: r.strike_price, expiry: r.expiration_date }));
  });
}

/** The listed contract for a plan: the first expiry on or after `from`, at the strike nearest `strike` (a call's at or under it, a put's at or over). */
export function chooseContract(rows: Listed[], type: "call" | "put", strike: number): Listed | null {
  if (!rows.length) return null;
  const expiry = rows.reduce((d, r) => (r.expiry < d ? r.expiry : d), rows[0].expiry);
  const same = rows.filter((r) => r.expiry === expiry);
  const side = same.filter((r) => (type === "call" ? r.strike <= strike + 1e-9 : r.strike >= strike - 1e-9));
  const pool = side.length ? side : same;
  return pool.reduce((best, r) => (Math.abs(r.strike - strike) < Math.abs(best.strike - strike) ? r : best), pool[0]);
}

/** The yearly volatility that makes Black-Scholes give `price`, or null when no volatility can (under intrinsic value). */
export function impliedVol(type: "call" | "put", price: number, spot: number, strike: number, years: number) {
  if (!(price > 0 && spot > 0 && years > 0)) return null;
  let lo = 0.01;
  let hi = 5;
  if (bs(type, spot, strike, years, lo) > price || bs(type, spot, strike, years, hi) < price) return null;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (bs(type, spot, strike, years, mid) < price) lo = mid;
    else hi = mid;
  }
  return Math.round(((lo + hi) / 2) * 10_000) / 10_000;
}

type Snapshot = {
  results?: {
    day?: { close?: number; volume?: number };
    last_quote?: { bid?: number; ask?: number; midpoint?: number; last_updated?: number };
    implied_volatility?: number;
    greeks?: { delta?: number };
    open_interest?: number;
  };
};

async function fromSnapshot(underlying: string, c: Listed, type: "call" | "put", key: string): Promise<OptionQuote | null> {
  if (proMemo && !proMemo.ok && Date.now() - proMemo.at < PRO_RECHECK_MS) return null;
  const { status, body } = await get<Snapshot>(`/v3/snapshot/options/${encodeURIComponent(underlying)}/${encodeURIComponent(c.ticker)}`, key);
  if (status === 401 || status === 403) {
    proMemo = { ok: false, at: Date.now() };
    return null;
  }
  proMemo = { ok: true, at: Date.now() };
  const r = body?.results;
  if (!r) return null;
  const bid = r.last_quote?.bid ?? null;
  const ask = r.last_quote?.ask ?? null;
  const mid = r.last_quote?.midpoint ?? (bid != null && ask != null && ask > 0 ? (bid + ask) / 2 : null);
  const price = mid && mid > 0 ? mid : (r.day?.close ?? null);
  if (!(price && price > 0)) return null;
  const at = r.last_quote?.last_updated;
  return {
    contract: c.ticker,
    type,
    strike: c.strike,
    expiry: c.expiry,
    price: Math.round(price * 100) / 100,
    priceKind: mid && mid > 0 ? "mid" : "close",
    asOf: at ? new Date(at / 1e6).toISOString() : newYorkDate(Date.now()),
    bid,
    ask,
    iv: r.implied_volatility ?? null,
    ivFrom: r.implied_volatility != null ? "massive" : null,
    delta: r.greeks?.delta ?? null,
    volume: r.day?.volume ?? null,
    openInterest: r.open_interest ?? null,
  };
}

async function fromClose(c: Listed, type: "call" | "put", spotOn: (day: string) => number | null, key: string): Promise<OptionQuote | null> {
  const { body } = await get<{ results?: { c: number; v?: number; t: number }[] }>(`/v2/aggs/ticker/${encodeURIComponent(c.ticker)}/prev?adjusted=true`, key);
  const bar = body?.results?.[0];
  if (!bar || !(bar.c > 0)) return null;
  // The session's date in New York (this endpoint stamps the bar at the close, others at midnight New York time).
  const day = newYorkDate(bar.t);
  const spot = spotOn(day);
  const years = Math.max(1, Math.round((Date.parse(`${c.expiry}T21:00:00Z`) - Date.parse(`${day}T21:00:00Z`)) / DAY)) / 365;
  const iv = spot ? impliedVol(type, bar.c, spot, c.strike, years) : null;
  return {
    contract: c.ticker,
    type,
    strike: c.strike,
    expiry: c.expiry,
    price: bar.c,
    priceKind: "close",
    asOf: day,
    bid: null,
    ask: null,
    iv,
    ivFrom: iv != null ? "price" : null,
    delta: null,
    volume: bar.v ?? null,
    openInterest: null,
  };
}

/**
 * The real contract and price for a plan's option: listed, expiring on or after `from`, struck near `strike`. `spotOn`
 * gives the stock's close on a day (from its candles) to work out the implied volatility. Null when there's no key, no
 * listed contract, or the feed is busy and nothing's cached.
 */
export async function realOption(
  underlying: string,
  type: "call" | "put",
  from: string,
  strike: number,
  spotOn: (day: string) => number | null
): Promise<OptionQuote | null> {
  const key = await massiveKey();
  if (!key) return null;
  try {
    const rows = await listed(underlying, type, from, strike, key);
    const c = chooseContract(rows ?? [], type, strike);
    if (!c) return null;
    return await cached<OptionQuote>(`quote:${c.ticker}`, priceAge(), async () => (await fromSnapshot(underlying, c, type, key)) ?? (await fromClose(c, type, spotOn, key)));
  } catch (e) {
    if (!(e instanceof Busy)) console.error("optionQuotes:", underlying, e instanceof Error ? e.message : e);
    return null;
  }
}
