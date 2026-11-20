"use server";

import { allow } from "@/lib/security";
import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/membership";
import { getCandles } from "@/lib/candles";
import { cleanSpec, usesNewsSpec } from "@/lib/strategies/spec";
import { NEWS_START, stockNews } from "@/lib/alpaca";
import { PERIODS, backtest, expiryFor, periodStart, type Period, type Result } from "@/lib/strategies/backtest";
import { bs, roundStrike, strikeStep, volatility } from "@/lib/options/pricing";
import { newYorkDate } from "@/lib/marketCalendar";

// The Strategies page's server side (docs/plans/strategies.md): run a backtest on a stock's daily history, save and
// delete a member's strategies. A strategy is checked (src/lib/strategies/spec.ts) before it's run or stored.

const TICKER = /^[A-Z][A-Z0-9.]{0,7}$/;

/** A member's last backtest of one strategy, as kept (public.strategy_backtests, theirs alone). */
export type KeptBacktest = { ticker: string; period: Period; runKey: string; newsFrom: string | null; result: Result };

/** Which kept backtest a strategy uses: its id once saved, else the classic it came from, else "new". */
const REF = /^([0-9a-f-]{36}|template:[a-z0-9-]{1,40}|new)$/;

export async function runBacktest(input: { rules: unknown; ticker: string; period?: Period; ref?: string; runKey?: string }): Promise<{ result: Result; newsFrom: string | null } | { error: string }> {
  const { supabase, user } = await requireMember("/strategies");
  if (!(await allow(`backtest:${user.id}`, { max: 20, windowSec: 60 }))) return { error: "You're doing that too fast. Wait a moment and try again." };
  const spec = cleanSpec(input.rules);
  if (!spec) return { error: "Turn on at least one entry criterion (or add a custom rule)." };
  const ticker = input.ticker.trim().toUpperCase().replace(/^\$/, "");
  if (!TICKER.test(ticker)) return { error: "Enter a ticker, like SPY or AAPL." };
  const set = await getCandles(ticker);
  if (set.busy && !set.candles.length) return { error: "The data source is busy. Try again in a few seconds." };
  if (set.candles.length < 60) return { error: `Not enough price history for ${ticker}.` };
  // News blocks need the stock's headlines (Alpaca's free feed starts at NEWS_START).
  const news = usesNewsSpec(spec) ? await stockNews(ticker) : undefined;
  const period: Period = PERIODS.some(([k]) => k === input.period) ? input.period! : "all";
  const from = periodStart(period, newYorkDate(Date.now()));
  const result = backtest(set.candles, spec, news ? { news, newsFrom: NEWS_START } : {}, from);
  const newsFrom = news ? NEWS_START : null;
  // Kept for this member only (row-level security: their own rows), so it's there next time they open the strategy.
  if (input.ref && REF.test(input.ref)) {
    const { error } = await supabase.from("strategy_backtests").upsert({
      user_id: user.id,
      ref: input.ref,
      ticker,
      period,
      run_key: String(input.runKey ?? "").slice(0, 20_000),
      news_from: newsFrom,
      result,
      ran_at: new Date().toISOString(),
    });
    if (error) console.error("strategy backtest not kept:", error.message);
  }
  return { result, newsFrom };
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
  // A first save carries over the backtest run before it (on the classic, or the blank new one).
  if (!input.id) {
    const from = input.template ? `template:${input.template}` : "new";
    const { data: kept } = await supabase.from("strategy_backtests").select("*").eq("user_id", user.id).eq("ref", from).maybeSingle();
    if (kept) await supabase.from("strategy_backtests").upsert({ ...kept, ref: data.id });
  }
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

/** The strikes around a stock's price for the Contract tab's preview, the chosen one (and a spread's other leg) marked. */
export type StrikePreview = {
  ticker: string;
  spot: number;
  expiry: string;
  type: "call" | "put";
  rows: { strike: number; price: number; chosen: boolean; short: boolean; itm: boolean }[];
};

export async function strikePreview(input: {
  ticker: string;
  direction: "long" | "short";
  dte: number;
  expiryRule: "nearest" | "atLeast";
  pct: number;
  spreadWidth: number | null;
}): Promise<StrikePreview | { error: string }> {
  const { user } = await requireMember("/strategies");
  if (!(await allow(`strike-preview:${user.id}`, { max: 90, windowSec: 60 }))) return { error: "You're doing that too fast. Wait a moment and try again." };
  const ticker = input.ticker.trim().toUpperCase().replace(/^\$/, "");
  if (!TICKER.test(ticker)) return { error: "Enter a ticker on the Backtest tab to preview strikes." };
  const { candles } = await getCandles(ticker);
  const spot = candles.at(-1)?.c;
  if (!spot) return { error: `No price for ${ticker} right now.` };
  const type = input.direction === "long" ? "call" : "put";
  const sign = type === "call" ? 1 : -1;
  const today = newYorkDate(Date.now());
  const expiry = expiryFor(today, Math.max(1, Math.min(400, Math.round(input.dte))), input.expiryRule === "atLeast" ? "atLeast" : "nearest");
  const T = Math.max(1, (Date.parse(`${expiry}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000) / 365;
  const vol = volatility(candles.slice(-21).map((c) => c.c)) * 1.1;
  const step = strikeStep(spot);
  const pct = Math.max(-20, Math.min(20, Number(input.pct) || 0));
  const chosen = roundStrike(spot * (1 + (sign * pct) / 100), step);
  const short = input.spreadWidth ? chosen + sign * input.spreadWidth * step : null;
  // The chosen strike in the middle, a few either side (and the spread's other leg), highest on top like the chain.
  const lo = Math.min(chosen, short ?? chosen, roundStrike(spot, step)) - 3 * step;
  const hi = Math.max(chosen, short ?? chosen, roundStrike(spot, step)) + 3 * step;
  const rows: StrikePreview["rows"] = [];
  for (let k = hi; k >= lo - 1e-9; k -= step) {
    const strike = Math.round(k * 100) / 100;
    rows.push({
      strike,
      price: Math.round(bs(type, spot, strike, T, vol) * 100) / 100,
      chosen: Math.abs(strike - chosen) < 1e-6,
      short: short != null && Math.abs(strike - short) < 1e-6,
      itm: type === "call" ? strike < spot : strike > spot,
    });
  }
  return { ticker, spot, expiry, type, rows };
}
