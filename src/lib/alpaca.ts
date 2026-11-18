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
  for (let page = 0; page < 6; page++) {
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
