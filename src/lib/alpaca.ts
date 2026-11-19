import { supabaseService } from "@/lib/stripe";
import type { Candle } from "@/lib/chart/types";

// Alpaca's free market data (Ben, 2026-11-18: "set this up"): stock bars from the whole market (SIP) up to 15 minutes
// ago, today included, at about 200 requests a minute (Massive's free plan allows 5); and its free "indicative" option
// quotes. The last 15 minutes come from the always-on worker (worker/), which records Alpaca's free real-time IEX
// minute bars into public.live_bars. Keys: ALPACA_KEY_ID / ALPACA_SECRET in the environment or public.app_secrets
// (saved by `npm run alpaca:key`). Without them, everything falls back to Massive.

const DATA = "https://data.alpaca.markets";
/** The free plan can't ask for whole-market (SIP) data from the last 15 minutes. */
export const SIP_DELAY_MS = 16 * 60_000;

let keyMemo: { id: string; secret: string; at: number } | null = null;

export async function alpacaKeys(): Promise<{ id: string; secret: string } | null> {
  const id = process.env.ALPACA_KEY_ID?.trim();
  const secret = process.env.ALPACA_SECRET?.trim();
  if (id && secret) return { id, secret };
  if (!keyMemo || Date.now() - keyMemo.at > 5 * 60_000) {
    try {
      const { data } = await supabaseService().from("app_secrets").select("name, value").in("name", ["ALPACA_KEY_ID", "ALPACA_SECRET"]);
      const m = new Map((data ?? []).map((r) => [r.name as string, (r.value as string).trim()]));
      keyMemo = { id: m.get("ALPACA_KEY_ID") ?? "", secret: m.get("ALPACA_SECRET") ?? "", at: Date.now() };
    } catch {
      keyMemo = { id: "", secret: "", at: Date.now() };
    }
  }
  return keyMemo.id && keyMemo.secret ? { id: keyMemo.id, secret: keyMemo.secret } : null;
}

export class AlpacaBusy extends Error {}

async function get<T>(path: string, keys: { id: string; secret: string }): Promise<T> {
  const res = await fetch(`${DATA}${path}`, {
    headers: { "APCA-API-KEY-ID": keys.id, "APCA-API-SECRET-KEY": keys.secret },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (res.status === 429) throw new AlpacaBusy("alpaca 429");
  if (!res.ok) throw new Error(`alpaca ${res.status}: ${(await res.text()).slice(0, 160)}`);
  return (await res.json()) as T;
}

const NY = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
/** A moment as New York wall time, "2026-11-18T10:37". */
export function nyStamp(ms: number) {
  const p = Object.fromEntries(NY.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour === "24" ? "00" : p.hour}:${p.minute}`;
}

type Bar = { t: string; o: number; h: number; l: number; c: number; v: number };

/**
 * Whole-market bars for one stock, oldest first: `timeframe` is Alpaca's ("1Min", "5Min", "15Min", "30Min", "1Day"),
 * from `days` back to 16 minutes ago. Intraday bars are stamped with their New York wall time, daily with the date.
 */
export async function alpacaBars(ticker: string, timeframe: string, days: number): Promise<Candle[]> {
  const keys = await alpacaKeys();
  if (!keys) return [];
  const daily = timeframe === "1Day";
  const start = new Date(Date.now() - days * 86_400_000).toISOString();
  const end = new Date(Date.now() - SIP_DELAY_MS).toISOString();
  const out: Candle[] = [];
  let token: string | null = null;
  // Alpaca pages these by its own measure (a few hundred bars at times), so follow up to 30 pages.
  for (let page = 0; page < 30; page++) {
    const q = new URLSearchParams({ timeframe, start, end, limit: "10000", adjustment: "split", feed: "sip", sort: "asc" });
    if (token) q.set("page_token", token);
    const body: { bars?: Bar[] | null; next_page_token?: string | null } = await get(`/v2/stocks/${encodeURIComponent(ticker)}/bars?${q}`, keys);
    for (const b of body.bars ?? []) {
      const ms = Date.parse(b.t);
      const stamp = nyStamp(ms);
      out.push({ t: daily ? stamp.slice(0, 10) : stamp, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v ?? 0 });
    }
    token = body.next_page_token ?? null;
    if (!token) break;
  }
  return out;
}

/** The worker's recorded minute bars for one stock (the last 40 minutes), oldest first. */
export async function recentMinutes(ticker: string): Promise<Candle[]> {
  try {
    const { data } = await supabaseService().from("live_bars").select("t, o, h, l, c, v").eq("ticker", ticker).order("t", { ascending: true }).limit(60);
    return ((data ?? []) as { t: string; o: number; h: number; l: number; c: number; v: number }[]).map((r) => ({
      t: r.t,
      o: Number(r.o),
      h: Number(r.h),
      l: Number(r.l),
      c: Number(r.c),
      v: Number(r.v),
    }));
  } catch {
    return [];
  }
}

export type IndicativeQuote = { contract: string; bid: number | null; ask: number | null; last: number | null; iv: number | null; delta: number | null };

/** Free indicative option quotes for one stock and expiry (OCC symbols turned into Massive-style "O:…"), or null. */
export async function indicativeChain(underlying: string, expiry: string): Promise<Map<string, IndicativeQuote> | null> {
  const keys = await alpacaKeys();
  if (!keys) return null;
  const out = new Map<string, IndicativeQuote>();
  let token: string | null = null;
  try {
    for (let page = 0; page < 4; page++) {
      const q = new URLSearchParams({ feed: "indicative", expiration_date: expiry, limit: "1000" });
      if (token) q.set("page_token", token);
      const body: {
        snapshots?: Record<string, { latestQuote?: { bp?: number; ap?: number }; latestTrade?: { p?: number }; impliedVolatility?: number; greeks?: { delta?: number } }>;
        next_page_token?: string | null;
      } = await get(`/v1beta1/options/snapshots/${encodeURIComponent(underlying)}?${q}`, keys);
      for (const [sym, s] of Object.entries(body.snapshots ?? {})) {
        const bid = s.latestQuote?.bp ?? null;
        const ask = s.latestQuote?.ap ?? null;
        out.set(`O:${sym}`, {
          contract: `O:${sym}`,
          bid: bid && bid > 0 ? bid : bid === 0 ? 0 : null,
          ask: ask && ask > 0 ? ask : null,
          last: s.latestTrade?.p ?? null,
          iv: s.impliedVolatility ?? null,
          delta: s.greeks?.delta ?? null,
        });
      }
      token = body.next_page_token ?? null;
      if (!token) break;
    }
    return out;
  } catch (e) {
    if (!(e instanceof AlpacaBusy)) console.error("alpaca options:", underlying, expiry, e instanceof Error ? e.message : e);
    return out.size ? out : null;
  }
}

// ---- Paced requests ------------------------------------------------------------------------------------------------
// The free plan allows about 200 requests a minute per key; the Scanner's sweep paces itself to ~3 a second.

let nextSlot = 0;
async function paced<T>(fn: () => Promise<T>, perSecond = 3): Promise<T> {
  const now = Date.now();
  const at = Math.max(now, nextSlot);
  nextSlot = at + 1000 / perSecond;
  if (at > now) await new Promise((r) => setTimeout(r, at - now));
  try {
    return await fn();
  } catch (e) {
    if (!(e instanceof AlpacaBusy)) throw e;
    await new Promise((r) => setTimeout(r, 1500));
    return fn();
  }
}

// ---- Stocks: live prices and today's whole-market bar ----------------------------------------------------------------

export type LiveStock = { price: number; at: string };

/** Real-time last trades (IEX) for up to ~100 symbols per call. */
export async function latestTrades(symbols: string[], keys?: { id: string; secret: string } | null): Promise<Map<string, LiveStock>> {
  const k = keys ?? (await alpacaKeys());
  const out = new Map<string, LiveStock>();
  if (!k) return out;
  for (let i = 0; i < symbols.length; i += 100) {
    const chunk = symbols.slice(i, i + 100);
    const body = await paced(() => get<{ trades?: Record<string, { p: number; t: string }> }>(`/v2/stocks/trades/latest?symbols=${chunk.map(encodeURIComponent).join(",")}&feed=iex`, k));
    for (const [s, t] of Object.entries(body.trades ?? {})) if (t?.p > 0) out.set(s, { price: t.p, at: t.t });
  }
  return out;
}

export type DayBar = { o: number; h: number; l: number; c: number; v: number; date: string };

/** Each symbol's last two whole-market daily bars up to 16 minutes ago: today's so far (or the last session's) and the one before. */
export async function recentDailyBars(symbols: string[], keys?: { id: string; secret: string } | null): Promise<Map<string, DayBar[]>> {
  const k = keys ?? (await alpacaKeys());
  const out = new Map<string, DayBar[]>();
  if (!k) return out;
  const start = new Date(Date.now() - 8 * 86_400_000).toISOString();
  const end = new Date(Date.now() - SIP_DELAY_MS).toISOString();
  for (let i = 0; i < symbols.length; i += 100) {
    const chunk = symbols.slice(i, i + 100);
    let token: string | null = null;
    for (let page = 0; page < 10; page++) {
      const q = new URLSearchParams({ symbols: chunk.join(","), timeframe: "1Day", start, end, feed: "sip", limit: "10000", adjustment: "split" });
      if (token) q.set("page_token", token);
      const body: { bars?: Record<string, Bar[]>; next_page_token?: string | null } = await paced(() => get(`/v2/stocks/bars?${q}`, k));
      for (const [s, list] of Object.entries(body.bars ?? {})) {
        const bars = [...(out.get(s) ?? []), ...list.map((b) => ({ o: b.o, h: b.h, l: b.l, c: b.c, v: b.v, date: nyStamp(Date.parse(b.t)).slice(0, 10) }))];
        out.set(s, bars);
      }
      token = body.next_page_token ?? null;
      if (!token) break;
    }
  }
  for (const [s, list] of out) out.set(s, list.sort((a, b) => a.date.localeCompare(b.date)).slice(-2));
  return out;
}

// ---- Options: listed contracts (with open interest) and indicative snapshots -------------------------------------

const TRADING = process.env.ALPACA_TRADING_URL?.trim() || "https://paper-api.alpaca.markets";

export type ListedContract = { symbol: string; type: "call" | "put"; strike: number; expiry: string; oi: number | null };

/** Listed contracts from Alpaca's trading API (open interest included), filtered like Alpaca's own query. */
export async function listedContracts(
  underlying: string,
  f: { expiryFrom?: string; expiryTo?: string; expiry?: string; strikeFrom?: number; strikeTo?: number; type?: "call" | "put" }
): Promise<ListedContract[]> {
  const k = await alpacaKeys();
  if (!k) return [];
  const out: ListedContract[] = [];
  let token: string | null = null;
  for (let page = 0; page < 10; page++) {
    const q = new URLSearchParams({ underlying_symbols: underlying, limit: "10000", status: "active" });
    if (f.expiry) q.set("expiration_date", f.expiry);
    if (f.expiryFrom) q.set("expiration_date_gte", f.expiryFrom);
    if (f.expiryTo) q.set("expiration_date_lte", f.expiryTo);
    if (f.strikeFrom != null) q.set("strike_price_gte", String(f.strikeFrom));
    if (f.strikeTo != null) q.set("strike_price_lte", String(f.strikeTo));
    if (f.type) q.set("type", f.type);
    if (token) q.set("page_token", token);
    const res = await paced(() =>
      fetch(`${TRADING}/v2/options/contracts?${q}`, { headers: { "APCA-API-KEY-ID": k.id, "APCA-API-SECRET-KEY": k.secret }, cache: "no-store", signal: AbortSignal.timeout(10_000) })
    );
    if (res.status === 429) throw new AlpacaBusy("alpaca 429");
    if (!res.ok) throw new Error(`alpaca contracts ${res.status}`);
    const body = (await res.json()) as { option_contracts?: { symbol: string; type: "call" | "put"; strike_price: string; expiration_date: string; open_interest?: string | null }[]; next_page_token?: string | null };
    for (const c of body.option_contracts ?? []) {
      out.push({ symbol: c.symbol, type: c.type, strike: Number(c.strike_price), expiry: c.expiration_date, oi: c.open_interest != null ? Number(c.open_interest) : null });
    }
    token = body.next_page_token ?? null;
    if (!token) break;
  }
  return out;
}

export type OptionSnap = {
  symbol: string;
  bid: number | null;
  ask: number | null;
  last: number | null;
  iv: number | null;
  delta: number | null;
  /** Today's volume (0 when the latest daily bar isn't today's). */
  volume: number;
};

/** Indicative snapshots for one stock's options, filtered (expiry and strike ranges), every page. */
export async function optionSnapshots(underlying: string, f: { expiryFrom?: string; expiryTo?: string; strikeFrom?: number; strikeTo?: number }): Promise<OptionSnap[]> {
  const k = await alpacaKeys();
  if (!k) return [];
  const today = nyStamp(Date.now()).slice(0, 10);
  const out: OptionSnap[] = [];
  let token: string | null = null;
  for (let page = 0; page < 8; page++) {
    const q = new URLSearchParams({ feed: "indicative", limit: "1000" });
    if (f.expiryFrom) q.set("expiration_date_gte", f.expiryFrom);
    if (f.expiryTo) q.set("expiration_date_lte", f.expiryTo);
    if (f.strikeFrom != null) q.set("strike_price_gte", String(f.strikeFrom));
    if (f.strikeTo != null) q.set("strike_price_lte", String(f.strikeTo));
    if (token) q.set("page_token", token);
    const body: {
      snapshots?: Record<
        string,
        { latestQuote?: { bp?: number; ap?: number }; latestTrade?: { p?: number }; dailyBar?: { v?: number; t?: string }; impliedVolatility?: number; greeks?: { delta?: number } }
      >;
      next_page_token?: string | null;
    } = await paced(() => get(`/v1beta1/options/snapshots/${encodeURIComponent(underlying)}?${q}`, k));
    for (const [symbol, s] of Object.entries(body.snapshots ?? {})) {
      const day = s.dailyBar?.t ? nyStamp(Date.parse(s.dailyBar.t)).slice(0, 10) : null;
      out.push({
        symbol,
        bid: s.latestQuote?.bp ?? null,
        ask: s.latestQuote?.ap && s.latestQuote.ap > 0 ? s.latestQuote.ap : null,
        last: s.latestTrade?.p ?? null,
        iv: s.impliedVolatility ?? null,
        delta: s.greeks?.delta ?? null,
        volume: day === today ? (s.dailyBar?.v ?? 0) : 0,
      });
    }
    token = body.next_page_token ?? null;
    if (!token) break;
  }
  return out;
}

/** "AAPL261218C00350000" → its parts. */
export function parseOcc(sym: string): { underlying: string; type: "call" | "put"; strike: number; expiry: string } | null {
  const m = /^([A-Z.]{1,8})(\d{2})(\d{2})(\d{2})([CP])(\d{8})$/.exec(sym);
  return m ? { underlying: m[1], expiry: `20${m[2]}-${m[3]}-${m[4]}`, type: m[5] === "C" ? "call" : "put", strike: Number(m[6]) / 1000 } : null;
}

// ---- One option contract: its price history and its live price ----------------------------------------------------

/** "O:AAPL261218C00350000" → "AAPL261218C00350000", or null. */
export const occOf = (contract: string) => (/^O:[A-Z.]{1,8}\d{6}[CP]\d{8}$/.test(contract) ? contract.slice(2) : null);

/** A contract's bars (Alpaca's option bars, free up to 15 minutes back), oldest first, stamped like stock bars. */
export async function optionBars(contract: string, timeframe: string, days: number): Promise<Candle[]> {
  const keys = await alpacaKeys();
  const sym = occOf(contract);
  if (!keys || !sym) return [];
  const daily = timeframe === "1Day";
  const start = new Date(Date.now() - days * 86_400_000).toISOString();
  const end = new Date(Date.now() - SIP_DELAY_MS).toISOString();
  const out: Candle[] = [];
  let token: string | null = null;
  for (let page = 0; page < 20; page++) {
    const q = new URLSearchParams({ symbols: sym, timeframe, start, end, limit: "10000", sort: "asc" });
    if (token) q.set("page_token", token);
    const body: { bars?: Record<string, Bar[]>; next_page_token?: string | null } = await get(`/v1beta1/options/bars?${q}`, keys);
    for (const b of body.bars?.[sym] ?? []) {
      const stamp = nyStamp(Date.parse(b.t));
      out.push({ t: daily ? stamp.slice(0, 10) : stamp, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v ?? 0 });
    }
    token = body.next_page_token ?? null;
    if (!token) break;
  }
  return out;
}

/** A contract's live price (its indicative quote's mark, else its last trade) and today's bar so far. */
export async function optionLive(contract: string): Promise<{ price: number; open: number | null; high: number | null; low: number | null; prevClose: number | null } | null> {
  const keys = await alpacaKeys();
  const sym = occOf(contract);
  if (!keys || !sym) return null;
  const body = await get<{
    snapshots?: Record<string, { latestQuote?: { bp?: number; ap?: number }; latestTrade?: { p?: number }; dailyBar?: { o?: number; h?: number; l?: number; t?: string }; prevDailyBar?: { c?: number } }>;
  }>(`/v1beta1/options/snapshots?symbols=${sym}&feed=indicative`, keys);
  const s = body.snapshots?.[sym];
  if (!s) return null;
  const bid = s.latestQuote?.bp;
  const ask = s.latestQuote?.ap;
  const price = bid != null && ask != null && ask > 0 ? (bid + ask) / 2 : s.latestTrade?.p;
  if (!(price && price > 0)) return null;
  const today = nyStamp(Date.now()).slice(0, 10);
  const todays = s.dailyBar?.t && nyStamp(Date.parse(s.dailyBar.t)).slice(0, 10) === today ? s.dailyBar : null;
  return {
    price: Math.round(price * 100) / 100,
    open: todays?.o ?? null,
    high: todays?.h != null ? Math.max(todays.h, Math.round(price * 100) / 100) : null,
    low: todays?.l != null ? Math.min(todays.l, Math.round(price * 100) / 100) : null,
    prevClose: s.prevDailyBar?.c ?? null,
  };
}
