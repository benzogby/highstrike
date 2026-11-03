import type { SupabaseClient } from "@supabase/supabase-js";
import type { Bias, Leg, Structure } from "./cards";
import { favorites, learnTaste, tasteWeight } from "./taste";

// The swipe screen's deck (step 2 of the swipe app): active cards the member hasn't swiped yet, the most-traded names
// coming up more often (tier 1 three times as likely as tier 3) and, after ten swipes, the kinds the member saves more
// often still (src/lib/options/taste.ts, step 4), each with its stock's recent closes for the mini chart and the crowd's
// verdict on that kind of setup.

export type DeckCard = {
  id: string;
  ticker: string;
  structure: Structure;
  bias: Bias;
  expiry: string;
  dte: number;
  spot: number;
  vol: number;
  legs: Leg[];
  net: number;
  max_profit: number | null;
  max_loss: number;
  reward_risk: number | null;
  breakevens: number[];
  pop: number;
  take_profit: number[];
  stop_loss: number[];
  why: string;
  tier: number;
  /** Recent closes, oldest first, for the mini chart (may be short while history builds up). */
  closes: number[];
  /** How everyone swiped on this kind of setup on this stock over the last two weeks (null under five swipes). */
  crowd: { right: number; total: number } | null;
};

const COLUMNS = "id, ticker, structure, bias, expiry, dte, spot, vol, legs, net, max_profit, max_loss, reward_risk, breakevens, pop, take_profit, stop_loss, why, tier";
const num = (v: unknown) => Number(v);

/** What the member's taste favors, for the deck's "Showing you more …" line. */
export async function tasteFor(db: SupabaseClient, userId: string) {
  const { data } = await db.from("swipes").select("action, card").eq("user_id", userId).order("created_at", { ascending: false }).limit(300);
  return favorites(learnTaste((data ?? []) as { action: string; card: never }[]));
}

/** Up to `n` cards for this member, not including any they've swiped or `skip` (cards already on their screen). */
export async function deckFor(db: SupabaseClient, userId: string, n = 15, skip: string[] = []): Promise<DeckCard[]> {
  const [{ data: cards }, { data: swiped }, { data: recent }] = await Promise.all([
    db.from("swipe_cards").select(COLUMNS).eq("active", true).order("created_at", { ascending: false }).limit(600),
    db.from("swipes").select("card_id").eq("user_id", userId).order("created_at", { ascending: false }).limit(1000),
    db.from("swipes").select("action, card").eq("user_id", userId).order("created_at", { ascending: false }).limit(300),
  ]);
  const taste = learnTaste((recent ?? []) as { action: string; card: never }[]);
  const seen = new Set([...skip, ...((swiped ?? []) as { card_id: string | null }[]).map((s) => s.card_id ?? "")]);
  const pool = ((cards ?? []) as Record<string, unknown>[]).filter((c) => !seen.has(String(c.id)));
  // Weighted shuffle: each card's key is random^(1/weight), highest first (Efraimidis-Spirakis).
  const weight = (tier: number) => (tier === 1 ? 3 : tier === 2 ? 2 : 1);
  const shuffled = pool
    .map((c) => ({ c, k: Math.pow(Math.random(), 1 / (weight(Number(c.tier)) * tasteWeight(taste, c as never))) }))
    .sort((a, b) => b.k - a.k)
    .map(({ c }) => c);
  // Not two cards on the same stock back to back: a repeat waits for the next card on another stock.
  const picked: Record<string, unknown>[] = [];
  const held: Record<string, unknown>[] = [];
  for (const c of shuffled) {
    if (picked.length >= n) break;
    if (picked.length && picked[picked.length - 1].ticker === c.ticker) held.push(c);
    else {
      picked.push(c);
      const i = held.findIndex((h) => h.ticker !== c.ticker);
      if (i >= 0 && picked.length < n) picked.push(...held.splice(i, 1));
    }
  }
  const tickers = [...new Set(picked.map((c) => String(c.ticker)))];
  const { data: closes } = tickers.length
    ? await db.from("underlying_closes").select("ticker, day, close").in("ticker", tickers).order("day", { ascending: false }).limit(tickers.length * 30)
    : { data: [] };
  // The crowd's verdict: every member's swipes on the same kind of setup on the same stock, the last two weeks.
  const since = new Date(Date.now() - 14 * 86_400_000).toISOString();
  const { data: votes } = tickers.length ? await db.from("swipes").select("ticker, structure, action").in("ticker", tickers).gte("created_at", since).limit(20000) : { data: [] };
  const crowd = new Map<string, { right: number; total: number }>();
  for (const v of (votes ?? []) as { ticker: string; structure: string; action: string }[]) {
    const k = `${v.ticker}|${v.structure}`;
    const r = crowd.get(k) ?? { right: 0, total: 0 };
    r.total++;
    if (v.action === "right") r.right++;
    crowd.set(k, r);
  }
  const series = new Map<string, number[]>();
  for (const r of (closes ?? []) as { ticker: string; close: number }[]) {
    const s = series.get(r.ticker) ?? [];
    if (s.length < 30) s.push(Number(r.close));
    series.set(r.ticker, s);
  }
  return picked.map((c) => ({
    id: String(c.id),
    ticker: String(c.ticker),
    structure: c.structure as Structure,
    bias: c.bias as Bias,
    expiry: String(c.expiry),
    dte: num(c.dte),
    spot: num(c.spot),
    vol: num(c.vol),
    legs: c.legs as Leg[],
    net: num(c.net),
    max_profit: c.max_profit == null ? null : num(c.max_profit),
    max_loss: num(c.max_loss),
    reward_risk: c.reward_risk == null ? null : num(c.reward_risk),
    breakevens: ((c.breakevens as number[]) ?? []).map(num),
    pop: num(c.pop),
    take_profit: ((c.take_profit as number[]) ?? []).map(num),
    stop_loss: ((c.stop_loss as number[]) ?? []).map(num),
    why: String(c.why),
    tier: num(c.tier),
    closes: (series.get(String(c.ticker)) ?? []).reverse(),
    crowd: (() => {
      const r = crowd.get(`${c.ticker}|${c.structure}`);
      return r && r.total >= 5 ? r : null;
    })(),
  }));
}
