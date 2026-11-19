"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/membership";
import { getCandles } from "@/lib/candles";
import { cleanSpec, usesNewsSpec } from "@/lib/strategies/spec";
import { NEWS_START, stockNews } from "@/lib/alpaca";
import { backtest, type Result } from "@/lib/strategies/backtest";

// The Strategies page's server side (docs/plans/strategies.md): run a backtest on a stock's daily history, save and
// delete a member's strategies. A strategy is checked (src/lib/strategies/spec.ts) before it's run or stored.

const TICKER = /^[A-Z][A-Z0-9.]{0,7}$/;

export async function runBacktest(input: { rules: unknown; ticker: string }): Promise<{ result: Result; newsFrom: string | null } | { error: string }> {
  await requireMember("/strategies");
  const spec = cleanSpec(input.rules);
  if (!spec) return { error: "Turn on at least one entry criterion (or add a custom rule)." };
  const ticker = input.ticker.trim().toUpperCase().replace(/^\$/, "");
  if (!TICKER.test(ticker)) return { error: "Enter a ticker, like SPY or AAPL." };
  const set = await getCandles(ticker);
  if (set.busy && !set.candles.length) return { error: "The data source is busy. Try again in a few seconds." };
  if (set.candles.length < 60) return { error: `Not enough price history for ${ticker}.` };
  // News blocks need the stock's headlines (Alpaca's free feed starts at NEWS_START).
  const news = usesNewsSpec(spec) ? await stockNews(ticker) : undefined;
  return { result: backtest(set.candles, spec, news ? { news, newsFrom: NEWS_START } : {}), newsFrom: news ? NEWS_START : null };
}

export type LiveSettings = { watch: string[]; live: boolean; alerts: boolean; autoTrade: boolean };

export async function saveStrategy(input: { id?: string | null; name: string; rules: unknown; ticker: string; template?: string | null; settings?: LiveSettings }): Promise<{ id: string } | { error: string }> {
  const { supabase, user } = await requireMember("/strategies");
  const rules = cleanSpec(input.rules);
  if (!rules) return { error: "Turn on at least one entry criterion (or add a custom rule)." };
  const name = input.name.trim().slice(0, 80) || "My strategy";
  const ticker = TICKER.test(input.ticker.trim().toUpperCase()) ? input.ticker.trim().toUpperCase() : "SPY";
  // Up to 25 stocks to watch live (src/lib/strategies/live.ts).
  const watch = [...new Set((input.settings?.watch ?? []).map((t) => t.trim().toUpperCase().replace(/^\$/, "")).filter((t) => TICKER.test(t)))].slice(0, 25);
  if (input.settings?.live && !watch.length) return { error: "Add at least one stock to watch before switching it on." };
  const row = {
    user_id: user.id,
    name,
    rules,
    ticker,
    template: input.template ?? null,
    updated_at: new Date().toISOString(),
    ...(input.settings ? { watch, live: input.settings.live, alerts: input.settings.alerts, auto_trade: input.settings.autoTrade } : {}),
  };
  const { data, error } = input.id
    ? await supabase.from("strategies").update(row).eq("id", input.id).eq("user_id", user.id).select("id").single()
    : await supabase.from("strategies").insert(row).select("id").single();
  if (error || !data) return { error: "It didn't save. Try again." };
  revalidatePath("/strategies");
  return { id: data.id as string };
}

export async function deleteStrategy(id: string): Promise<{ ok: true } | { error: string }> {
  const { supabase, user } = await requireMember("/strategies");
  const { error } = await supabase.from("strategies").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { error: "It didn't delete. Try again." };
  revalidatePath("/strategies");
  return { ok: true };
}
