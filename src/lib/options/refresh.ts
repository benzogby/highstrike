import { supabaseService } from "@/lib/stripe";
import { fetchQuotes } from "@/lib/quotes";
import { etToday } from "@/lib/setupEngine";
import { volatility } from "./pricing";
import { cardsFor } from "./cards";
import { CARDS_PER_TIER, UNIVERSE } from "./universe";

// Keeps the swipe deck fresh (step 1 of the swipe app): quotes the stocks that were priced longest ago, at a pace the free
// quote service allows (about 60 a minute), records each day's close, re-estimates volatility, and rebuilds that stock's
// cards. One run handles what fits in its time; the route starts another run while stocks are still stale.

/** Quotes per burst, and the wait between bursts: 25 every 27 seconds stays under 60 a minute. */
const BURST = 25;
const GAP_MS = 27_000;
/** A stock counts as fresh for this long after it was priced. */
export const FRESH_HOURS = 6;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The list in the code, mirrored into option_underlyings (new names added, tiers kept current). */
async function syncUniverse() {
  const db = supabaseService();
  await db.from("option_underlyings").upsert(UNIVERSE.map((u) => ({ ticker: u.ticker, tier: u.tier })), { onConflict: "ticker", ignoreDuplicates: false });
}

export async function refreshBatch(budgetMs = 240_000) {
  const started = Date.now();
  const db = supabaseService();
  await syncUniverse();
  const staleBefore = new Date(Date.now() - FRESH_HOURS * 3_600_000).toISOString();
  const { data: stale } = await db
    .from("option_underlyings")
    .select("ticker, tier")
    .or(`quoted_at.is.null,quoted_at.lt.${staleBefore}`)
    .order("tier")
    .order("quoted_at", { ascending: true, nullsFirst: true })
    .limit(400);
  const queue = ((stale ?? []) as { ticker: string; tier: 1 | 2 | 3 }[]).filter((s) => UNIVERSE.some((u) => u.ticker === s.ticker));
  const day = etToday();
  const today = new Date();
  let priced = 0;
  let cards = 0;
  let missed = 0;

  for (let i = 0; i < queue.length; i += BURST) {
    if (Date.now() - started > budgetMs) break;
    if (i > 0) await wait(GAP_MS);
    const batch = queue.slice(i, i + BURST);
    const quotes = await fetchQuotes(batch.map((b) => b.ticker));
    for (const q of quotes) {
      const tier = batch.find((b) => b.ticker === q.symbol)?.tier ?? 3;
      if (!q.live || !(q.price > 0)) {
        missed++;
        // Try it again next time rather than first in line forever.
        await db.from("option_underlyings").update({ quoted_at: new Date().toISOString() }).eq("ticker", q.symbol);
        continue;
      }
      await db.from("underlying_closes").upsert({ ticker: q.symbol, day, close: q.price }, { onConflict: "ticker,day" });
      let { data: closes } = await db.from("underlying_closes").select("close").eq("ticker", q.symbol).order("day", { ascending: false }).limit(21);
      if ((closes?.length ?? 0) < 5) {
        // A name the scanner already followed: start from its price history.
        const { data: hist } = await db.from("price_history").select("price_date, close").eq("ticker", q.symbol).order("price_date", { ascending: false }).limit(21);
        if (hist?.length) {
          await db.from("underlying_closes").upsert(hist.map((h) => ({ ticker: q.symbol, day: h.price_date, close: h.close })), { onConflict: "ticker,day", ignoreDuplicates: true });
          ({ data: closes } = await db.from("underlying_closes").select("close").eq("ticker", q.symbol).order("day", { ascending: false }).limit(21));
        }
      }
      const series = ((closes ?? []) as { close: number }[]).map((c) => Number(c.close)).reverse();
      const vol = volatility(series, { high: q.high, low: q.low });
      const mom5 = series.length >= 6 ? ((series[series.length - 1] - series[series.length - 6]) / series[series.length - 6]) * 100 : null;
      const rangePos = q.high != null && q.low != null && q.high > q.low ? (q.price - q.low) / (q.high - q.low) : null;
      await db
        .from("option_underlyings")
        .update({ spot: q.price, change_pct: q.changePct, high: q.high ?? null, low: q.low ?? null, prev_close: q.prevClose ?? null, vol, quoted_at: new Date().toISOString() })
        .eq("ticker", q.symbol);

      const built = cardsFor({ ticker: q.symbol, spot: q.price, vol, changePct: q.changePct, rangePos, mom5 }, CARDS_PER_TIER[tier], today);
      await db.from("swipe_cards").delete().eq("ticker", q.symbol);
      if (built.length) {
        const { error } = await db.from("swipe_cards").insert(
          built.map((c) => ({
            ticker: c.ticker,
            structure: c.structure,
            bias: c.bias,
            expiry: c.expiry,
            dte: c.dte,
            spot: c.spot,
            vol: c.vol,
            legs: c.legs,
            net: c.net,
            max_profit: c.maxProfit,
            max_loss: c.maxLoss,
            reward_risk: c.rewardRisk,
            breakevens: c.breakevens,
            pop: c.pop,
            take_profit: c.takeProfit,
            stop_loss: c.stopLoss,
            why: c.why,
            tier,
          }))
        );
        if (error) console.error(`swipe cards for ${q.symbol}:`, error.message);
        else cards += built.length;
      }
      priced++;
    }
  }
  const { count: left } = await db.from("option_underlyings").select("ticker", { count: "exact", head: true }).or(`quoted_at.is.null,quoted_at.lt.${staleBefore}`);
  return { priced, cards, missed, left: left ?? 0, seconds: Math.round((Date.now() - started) / 1000) };
}
