"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/membership";
import { getCandles } from "@/lib/candles";
import { cleanRules } from "@/lib/strategies/rules";
import { backtest, type Result } from "@/lib/strategies/backtest";

// The Strategies page's server side (docs/plans/strategies.md): run a backtest on a stock's daily history, save and
// delete a member's strategies. Rules are checked (src/lib/strategies/rules.ts) before they're run or stored.

const TICKER = /^[A-Z][A-Z0-9.]{0,7}$/;

export async function runBacktest(input: { rules: unknown; ticker: string }): Promise<{ result: Result } | { error: string }> {
  await requireMember("/strategies");
  const rules = cleanRules(input.rules);
  if (!rules) return { error: "Add at least one entry rule, with numbers that make sense." };
  const ticker = input.ticker.trim().toUpperCase().replace(/^\$/, "");
  if (!TICKER.test(ticker)) return { error: "Enter a ticker, like SPY or AAPL." };
  const set = await getCandles(ticker);
  if (set.busy && !set.candles.length) return { error: "The data source is busy. Try again in a few seconds." };
  if (set.candles.length < 60) return { error: `Not enough price history for ${ticker}.` };
  return { result: backtest(set.candles, rules) };
}

export async function saveStrategy(input: { id?: string | null; name: string; rules: unknown; ticker: string; template?: string | null }): Promise<{ id: string } | { error: string }> {
  const { supabase, user } = await requireMember("/strategies");
  const rules = cleanRules(input.rules);
  if (!rules) return { error: "Add at least one entry rule, with numbers that make sense." };
  const name = input.name.trim().slice(0, 80) || "My strategy";
  const ticker = TICKER.test(input.ticker.trim().toUpperCase()) ? input.ticker.trim().toUpperCase() : "SPY";
  const row = { user_id: user.id, name, rules, ticker, template: input.template ?? null, updated_at: new Date().toISOString() };
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
