import Link from "next/link";
import { CARD } from "@/components/ui";
import { supabaseService } from "@/lib/stripe";
import { getCandles } from "@/lib/candles";
import { Calc, cleanRules, conditionText, usesNews, type Rules } from "@/lib/strategies/rules";
import { NEWS_START, stockNews } from "@/lib/alpaca";
import { TEMPLATES } from "@/lib/strategies/templates";
import type { StockRow } from "@/lib/scan/types";
import type { Candle } from "@/lib/chart/types";
import { pct, tone } from "./fmt";

// The Scanner's Strategies tab (Ben, 2026-11-19: "Scanner of matches"): every one of the most traded names where a
// strategy's entry rules are all true on the latest daily bar (today's so far in market hours). Pick one of the
// member's own strategies or a classic. Results are kept 10 minutes per strategy (public.market_cache).

const UNIVERSE = 80;
const KEEP_MS = 10 * 60_000;

type Choice = { key: string; name: string; rules: Rules };
type Match = { t: string; price: number; asOf: string };

async function matchesFor(choice: Choice, tickers: string[]): Promise<{ rows: Match[]; at: string }> {
  const db = supabaseService();
  const cacheKey = `smatch:${JSON.stringify(choice.rules.entry)}`;
  const { data: hit } = await db.from("market_cache").select("body, fetched_at").eq("key", cacheKey).maybeSingle();
  if (hit && Date.now() - Date.parse(hit.fetched_at) < KEEP_MS) return { rows: hit.body as Match[], at: hit.fetched_at };
  const rows: Match[] = [];
  for (let k = 0; k < tickers.length; k += 10) {
    const sets = await Promise.all(tickers.slice(k, k + 10).map((t) => getCandles(t).then((s) => [t, s.candles] as const).catch(() => [t, [] as Candle[]] as const)));
    for (const [t, bars] of sets) {
      if (bars.length < 30) continue;
      const ctx = usesNews(choice.rules) ? { news: await stockNews(t).catch(() => []), newsFrom: NEWS_START } : {};
      if (new Calc(bars, ctx).all(choice.rules.entry, bars.length - 1)) rows.push({ t, price: bars[bars.length - 1].c, asOf: bars[bars.length - 1].t.slice(0, 10) });
    }
  }
  const at = new Date().toISOString();
  await db.from("market_cache").upsert({ key: cacheKey, body: rows, fetched_at: at });
  return { rows, at };
}

export default async function StrategyMatches({ stocks, chosen, userId }: { stocks: StockRow[]; chosen?: string; userId: string }) {
  const { data } = await supabaseService().from("strategies").select("id, name, rules").eq("user_id", userId).order("updated_at", { ascending: false }).limit(50);
  const mine: Choice[] = (data ?? []).flatMap((r) => {
    const rules = cleanRules(r.rules);
    return rules ? [{ key: r.id as string, name: r.name as string, rules }] : [];
  });
  const choices: Choice[] = [...mine, ...TEMPLATES.map((t) => ({ key: t.key, name: t.name, rules: t.rules }))];
  const choice = choices.find((c) => c.key === chosen) ?? choices[0];
  const byTicker = new Map(stocks.map((s) => [s.t, s]));
  const universe = [...stocks].sort((a, b) => (b.dollarVol ?? 0) - (a.dollarVol ?? 0)).slice(0, UNIVERSE).map((s) => s.t);
  const { rows } = await matchesFor(choice, universe);
  const isTemplate = TEMPLATES.some((t) => t.key === choice.key);

  return (
    <div className="flex flex-col gap-4">
      <div className={`${CARD} p-4`}>
        <div className="flex flex-wrap gap-1.5">
          {choices.map((c) => (
            <Link
              key={c.key}
              href={`/scanner?tab=strategies&s=${c.key}`}
              className={`rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition ${c.key === choice.key ? "bg-accent-soft text-accent-ink ring-1 ring-inset ring-accent/40" : "bg-panel-2 text-ink-2 hover:text-ink"}`}
            >
              {c.name}
            </Link>
          ))}
        </div>
        <p className="mt-3 font-mono text-[12px] leading-relaxed text-ink-3">
          {choice.rules.direction === "long" ? "Bullish" : "Bearish"} · if {choice.rules.entry.map(conditionText).join(" and ")}
        </p>
      </div>

      {rows.length === 0 ? (
        <p className={`${CARD} px-6 py-10 text-center text-sm text-ink-2`}>None of the {UNIVERSE} most traded names match this strategy right now.</p>
      ) : (
        <div className={`${CARD} overflow-x-auto`}>
          <table className="w-full min-w-[620px] text-sm">
            <thead className="border-b border-line text-[11px] text-ink-3">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Ticker</th>
                <th className="px-4 py-2.5 text-right font-medium">Price</th>
                <th className="px-4 py-2.5 text-right font-medium">Today</th>
                <th className="px-4 py-2.5 text-left font-medium">Sector</th>
                <th className="px-4 py-2.5 text-right font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((m) => {
                const s = byTicker.get(m.t);
                return (
                  <tr key={m.t} className="hover:bg-panel-2/50">
                    <td className="px-4 py-2.5">
                      <Link href={`/dashboard?t=${m.t}`} className="font-mono-nums font-medium text-ink hover:text-accent">
                        {m.t}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono-nums text-ink">{m.price.toFixed(2)}</td>
                    <td className={`px-4 py-2.5 text-right font-mono-nums ${tone(s?.chg ?? null)}`}>{pct(s?.chg ?? null)}</td>
                    <td className="px-4 py-2.5 text-ink-2">{s?.sector ?? ""}</td>
                    <td className="px-4 py-2.5 text-right">
                      <Link href={isTemplate ? `/strategies/new?template=${choice.key}&t=${m.t}` : `/strategies/${choice.key}?t=${m.t}`} className="text-[13px] font-medium text-accent hover:underline">
                        Backtest on {m.t}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-ink-3">
        Checked on the latest daily bar of the {UNIVERSE} most traded names, kept 10 minutes. Build your own on{" "}
        <Link href="/strategies" className="text-accent hover:underline">
          Strategies
        </Link>
        .
      </p>
    </div>
  );
}
