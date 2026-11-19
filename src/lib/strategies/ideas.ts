// Ideas from strategies (Ben, 2026-11-19, docs/plans/strategies.md: "Ideas come from strategies… each shown with its
// backtest record"). Each morning, after the old picks, HighStrike's classic strategies (templates.ts) run over the
// most traded names on their daily bars through yesterday's close. Where one fired, it's backtested on that stock since
// 2016; the ones with at least MIN_TRADES past trades and a positive average become the day's ideas (source
// 'strategy'), best record first, one per stock, carrying the record. Followed to target, stop or end like every idea.

import { supabaseService } from "@/lib/stripe";
import { getCandles } from "@/lib/candles";
import { readScan } from "@/lib/scan/build";
import { NEWS_START, stockNews } from "@/lib/alpaca";
import { suggestOption } from "@/lib/optionIdea";
import type { Candle } from "@/lib/chart/types";
import { Calc, conditionText, usesNews } from "./rules";
import { backtest } from "./backtest";
import { TEMPLATES, type Template } from "./templates";

const UNIVERSE = 150;
const MIN_TRADES = 6;
const MAX_IDEAS = 8;

/** What an idea from a strategy carries: the strategy and how it did on this stock before. */
export type IdeaRecord = {
  strategy: string;
  name: string;
  trades: number;
  winRate: number;
  /** Average result per trade, percent (on the option when the strategy trades one). */
  avg: number;
  basis: "option" | "stock";
  since: string;
};

export type Fired = { ticker: string; template: Template; price: number; record: IdeaRecord; score: number };

/** The classics that fire on one stock's latest bar, each with its record there (positive ones only). */
export async function firedOn(ticker: string, bars: Candle[]): Promise<Fired[]> {
  if (bars.length < 250) return [];
  const out: Fired[] = [];
  for (const t of TEMPLATES) {
    const ctx = usesNews(t.rules) ? { news: await stockNews(ticker).catch(() => []), newsFrom: NEWS_START } : {};
    if (!new Calc(bars, ctx).all(t.rules.entry, bars.length - 1)) continue;
    const r = backtest(bars, t.rules, ctx);
    const s = r.stats;
    if (s.count < MIN_TRADES || s.expectancy == null || s.expectancy <= 0 || s.winRate == null) continue;
    out.push({
      ticker,
      template: t,
      price: bars[bars.length - 1].c,
      record: { strategy: t.key, name: t.name, trades: s.count, winRate: s.winRate, avg: Math.round(s.expectancy * 10) / 10, basis: r.basis, since: r.from.slice(0, 4) },
      // A steady record over many trades beats one lucky run.
      score: s.expectancy * Math.sqrt(s.count) * (s.winRate / 100 + 0.5),
    });
  }
  return out;
}

export async function generateStrategyIdeas(date: string): Promise<{ checked: number; fired: number; ideas: number }> {
  const db = supabaseService();
  const snap = await readScan().catch(() => null);
  const universe = (snap?.stocks ?? [])
    .filter((s) => s.sector !== "Indexes & ETFs" || ["SPY", "QQQ", "IWM"].includes(s.t))
    .sort((a, b) => (b.dollarVol ?? 0) - (a.dollarVol ?? 0))
    .slice(0, UNIVERSE)
    .map((s) => s.t);

  const fired: Fired[] = [];
  const closesOf = new Map<string, number[]>();
  for (let k = 0; k < universe.length; k += 10) {
    const sets = await Promise.all(universe.slice(k, k + 10).map((t) => getCandles(t).then((s) => [t, s.candles] as const).catch(() => [t, [] as Candle[]] as const)));
    for (const [t, all] of sets) {
      // Through yesterday's close: the morning run never uses a bar still forming.
      const bars = all.filter((b) => b.t.slice(0, 10) < date);
      closesOf.set(t, bars.map((b) => b.c));
      fired.push(...(await firedOn(t, bars)));
    }
  }

  // Best record first, one idea per stock.
  const seen = new Set<string>();
  const picks = fired
    .sort((a, b) => b.score - a.score)
    .filter((f) => (seen.has(f.ticker) ? false : (seen.add(f.ticker), true)))
    .slice(0, MAX_IDEAS);

  await db.from("setups").delete().eq("report_date", date).eq("source", "strategy");
  if (picks.length) {
    const rows = picks.map((f) => {
      const r = f.template.rules;
      const long = r.direction === "long";
      const target = r.targetPct ? f.price * (1 + ((long ? 1 : -1) * r.targetPct) / 100) : null;
      const stop = r.stopPct ? f.price * (1 - ((long ? 1 : -1) * r.stopPct) / 100) : null;
      const days = r.maxDays ?? 20;
      const expiresOn = new Date(Date.parse(`${date}T12:00:00Z`) + Math.ceil(days * 1.45) * 86_400_000).toISOString().slice(0, 10);
      const timeFrame = `Up to ${days} trading days`;
      const rec = f.record;
      return {
        report_date: date,
        ticker: f.ticker,
        direction: r.direction,
        source: "strategy",
        style: "swing",
        headline: `${f.template.name} fired on ${f.ticker}`,
        justification: `${f.template.blurb} On ${f.ticker} since ${rec.since}, this strategy took ${rec.trades} trades and won ${rec.winRate}% of them, averaging ${rec.avg > 0 ? "+" : ""}${rec.avg}% a trade on the ${rec.basis === "option" ? "option (estimated)" : "shares"}. Past results don't promise future ones.`,
        entry_criteria: r.entry.map(conditionText),
        price_target: target ? `$${target.toFixed(2)}` : "the exit rules",
        time_frame: timeFrame,
        entry_price: Math.round(f.price * 100) / 100,
        target_price: target ? Math.round(target * 100) / 100 : null,
        stop_price: stop ? Math.round(stop * 100) / 100 : null,
        expires_on: expiresOn,
        flow_score: Math.max(1, Math.min(100, Math.round(f.score))),
        model: "strategies",
        record: rec,
        option: suggestOption({ ticker: f.ticker, direction: r.direction, entry: f.price, target, timeFrame, asOf: date, expiresOn, closes: closesOf.get(f.ticker) ?? [] }),
      };
    });
    const { error } = await db.from("setups").insert(rows);
    if (error) throw new Error(`strategy ideas insert failed: ${error.message}`);
  }
  return { checked: universe.length, fired: fired.length, ideas: picks.length };
}
