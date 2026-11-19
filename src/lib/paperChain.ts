import { getCandles } from "@/lib/candles";
import { bs, volatility } from "@/lib/options/pricing";
import { alpacaListed, chainSnapshot, contractQuote, expiriesFor, strikesFor } from "@/lib/optionQuotes";
import { alpacaKeys, nyStamp } from "@/lib/alpaca";
import { liveStock } from "@/lib/paper";
import { indicativeChain } from "@/lib/alpaca";

// The desk's option chain (src/app/(app)/dashboard): one expiry's listed strikes around the price, calls on the left and
// puts on the right. With Options Starter, the delayed bid, ask, IV, delta, volume and open interest of every contract;
// on the free plan, estimated prices for every strike from the live stock price and the at-the-money contract's own
// implied volatility (solved from its last close), with the same spread the fills use. Marked est.

export type Side = { contract: string; bid: number | null; ask: number | null; mid: number | null; iv: number | null; delta: number | null; volume: number | null; oi: number | null };
export type ChainView = {
  underlying: string;
  spot: number | null;
  expiries: string[];
  expiry: string | null;
  rows: { strike: number; call: Side | null; put: Side | null }[];
  source: "quote" | "indicative" | "est" | "none";
  iv: number | null;
};

const cents = (n: number) => Math.round(n * 100) / 100;

export async function chainView(underlying: string, wanted?: string | null): Promise<ChainView> {
  const u = underlying.toUpperCase();
  const [live, { candles }] = await Promise.all([liveStock(u), getCandles(u)]);
  const spot = live?.price ?? candles.at(-1)?.c ?? null;
  const empty: ChainView = { underlying: u, spot, expiries: [], expiry: null, rows: [], source: "none", iv: null };
  if (!spot) return empty;
  // The listed expiries and strikes: Alpaca's contract list when its keys are in (no 5-a-minute limit), else Massive's.
  const listed = (await alpacaKeys()) ? await alpacaListed(u, spot) : [];
  const expiries = listed.length ? [...new Set(listed.map((r) => r.expiry))].sort() : await expiriesFor(u, spot);
  if (!expiries.length) return empty;
  // The soonest expiry that still trades (Ben, 2026-11-18: "default to the soonest expiration date"): today's until the
  // 4:00 PM close, New York time.
  const now = nyStamp(Date.now());
  const open = expiries.filter((e) => e > now.slice(0, 10) || (e === now.slice(0, 10) && now.slice(11, 16) < "16:00"));
  const expiry = wanted && expiries.includes(wanted) ? wanted : (open[0] ?? expiries[expiries.length - 1]);
  const strikes = listed.length
    ? (() => {
        const out = { call: new Map<number, string>(), put: new Map<number, string>() };
        for (const r of listed) if (r.expiry === expiry) out[r.type].set(r.strike, `O:${r.symbol}`);
        return out;
      })()
    : await strikesFor(u, expiry, spot);
  const all = [...new Set([...strikes.call.keys(), ...strikes.put.keys()])].sort((a, b) => a - b);
  // The 15 strikes either side of the price.
  const at = all.findIndex((k) => k >= spot);
  const mid = at < 0 ? all.length : at;
  const keep = all.slice(Math.max(0, mid - 15), mid + 15);

  const snap = await chainSnapshot(u, expiry, spot);
  if (snap && snap.length) {
    const byContract = new Map(snap.map((r) => [r.contract, r]));
    const side = (c: string | undefined): Side | null => {
      const r = c ? byContract.get(c) : undefined;
      return c ? { contract: c, bid: r?.bid ?? null, ask: r?.ask ?? null, mid: r?.mid ?? null, iv: r?.iv ?? null, delta: r?.delta ?? null, volume: r?.volume ?? null, oi: r?.oi ?? null } : null;
    };
    return { ...empty, expiries, expiry, rows: keep.map((k) => ({ strike: k, call: side(strikes.call.get(k)), put: side(strikes.put.get(k)) })), source: "quote", iv: null };
  }

  // Alpaca's free indicative quotes (src/lib/alpaca.ts), where it has them; the rest estimated as below.
  const ind = await indicativeChain(u, expiry);
  if (ind && ind.size) {
    // The estimate is only worked out when some contract has no indicative quote (it can cost a Massive request).
    const missing = keep.some((k) =>
      (["call", "put"] as const).some((t) => {
        const c = strikes[t].get(k);
        const q = c ? ind.get(c) : undefined;
        return c != null && (q?.ask == null || q?.bid == null);
      })
    );
    const fallback = missing ? await estimator(u, spot, expiry, keep, strikes, candles) : { est: () => null, iv: null };
    const pick = (type: "call" | "put", k: number, c: string | undefined): Side | null => {
      if (!c) return null;
      const q = ind.get(c);
      if (q && q.ask != null && q.bid != null) return { contract: c, bid: q.bid, ask: q.ask, mid: Math.round(((q.bid + q.ask) / 2) * 100) / 100, iv: q.iv, delta: q.delta, volume: null, oi: null };
      return fallback.est(type, k, c);
    };
    const rows = keep.map((k) => ({ strike: k, call: pick("call", k, strikes.call.get(k)), put: pick("put", k, strikes.put.get(k)) }));
    return { ...empty, expiries, expiry, rows, source: "indicative", iv: fallback.iv };
  }

  // The free plan: price every strike from the at-the-money call's own IV.
  const { est, iv } = await estimator(u, spot, expiry, keep, strikes, candles);
  return {
    ...empty,
    expiries,
    expiry,
    rows: keep.map((k) => ({ strike: k, call: est("call", k, strikes.call.get(k)), put: est("put", k, strikes.put.get(k)) })),
    source: "est",
    iv,
  };
}

/** Estimated quotes for a chain: Black-Scholes at the live price and the at-the-money contract's own IV, with the fills' spread. */
async function estimator(
  u: string,
  spot: number,
  expiry: string,
  keep: number[],
  strikes: { call: Map<number, string>; put: Map<number, string> },
  candles: { t: string; c: number }[]
) {
  const atm = keep.reduce((best, k) => (Math.abs(k - spot) < Math.abs(best - spot) ? k : best), keep[0]);
  const closes = new Map(candles.map((c) => [c.t, c.c]));
  const atmContract = strikes.call.get(atm) ?? strikes.put.get(atm);
  const q = atmContract ? await contractQuote(atmContract, (day) => closes.get(day) ?? candles.at(-1)?.c ?? null) : null;
  const iv = q?.iv ?? volatility(candles.slice(-31).map((c) => c.c));
  const years = Math.max(0.5, (Date.parse(`${expiry}T21:00:00Z`) - Date.now()) / 86_400_000) / 365;
  const est = (type: "call" | "put", k: number, c: string | undefined): Side | null => {
    if (!c) return null;
    const m = Math.max(0.01, bs(type, spot, k, years, iv));
    const spread = Math.max(0.05, m * 0.03);
    // Delta from the same model: the chance-like number traders read off a chain.
    const d1 = (Math.log(spot / k) + (0.045 + (iv * iv) / 2) * years) / (iv * Math.sqrt(years));
    const nd = 0.5 * (1 + erf(d1 / Math.SQRT2));
    return { contract: c, bid: cents(Math.max(0.01, m - spread / 2)), ask: cents(m + spread / 2), mid: cents(m), iv, delta: type === "call" ? nd : nd - 1, volume: null, oi: null };
  };
  void u;
  return { est, iv };
}

/** The error function (Abramowitz and Stegun 7.1.26), for the model's delta. */
function erf(x: number) {
  const s = Math.sign(x);
  const a = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * a);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a);
  return s * y;
}
