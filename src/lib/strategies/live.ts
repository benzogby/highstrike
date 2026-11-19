// Strategies, live (Ben, 2026-11-19: "Alerts when it fires, Auto paper-trade, Show on the chart, Scanner of matches").
// Every five minutes in market hours (api/cron/check-alerts) each strategy that's switched on is checked on the stocks it
// watches, against daily bars that include today's bar so far:
// - When every entry rule is true, it fires once that day for that stock: a bell notice and an email (when alerts are
//   on), and, when auto paper-trade is on, a market order on the member's paper account: the option its rule picks
//   (one contract; the listed expiry nearest its days out, the strike nearest its delta) or $1,000 of shares.
// - A trade it opened is closed by itself at the target, the stop, an exit rule, the time limit, or the day before the
//   option expires.
// Each firing is a row in public.strategy_signals.

import { supabaseService } from "@/lib/stripe";
import { getCandles } from "@/lib/candles";
import { marketOpen, newYorkDate } from "@/lib/marketCalendar";
import { notify } from "@/lib/notify";
import { SITE_URL, sendMail } from "@/lib/mail";
import { chainView } from "@/lib/paperChain";
import { placeOrder } from "@/lib/paper";
import { parseContract } from "@/lib/optionQuotes";
import type { Candle } from "@/lib/chart/types";
import { Calc, cleanRules, conditionText, usesNews, type Context, type Rules } from "./rules";
import { NEWS_START, stockNews } from "@/lib/alpaca";

const db = () => supabaseService();
const FROM = process.env.ALERTS_FROM || "HighStrike Alerts <alerts@mail.highstrike.com>";
const SHARES_DOLLARS = 1000;

type Strategy = { id: string; user_id: string; name: string; rules: Rules; watch: string[]; alerts: boolean; auto_trade: boolean };
type Signal = { id: string; strategy_id: string; user_id: string; ticker: string; day: string; price: number; symbol: string | null; qty: number | null; status: string };

/** Whether a strategy's entry is true on the last bar, and that bar is today's. */
export function firesNow(bars: Candle[], rules: Rules, today: string, ctx: Context = {}) {
  if (bars.length < 30 || bars[bars.length - 1].t.slice(0, 10) !== today) return false;
  return new Calc(bars, ctx).all(rules.entry, bars.length - 1);
}

/** The news a strategy's rules need for one stock, or nothing when they have no news blocks. */
async function contextFor(rules: Rules, ticker: string): Promise<Context> {
  return usesNews(rules) ? { news: await stockNews(ticker).catch(() => []), newsFrom: NEWS_START } : {};
}

async function emailUser(userId: string, subject: string, text: string) {
  try {
    const { data } = await db().auth.admin.getUserById(userId);
    const to = data.user?.email;
    if (!to) return;
    const sent = await sendMail({ to, subject, html: "", text: `${text}\n\nYour strategies: ${SITE_URL}/strategies\n\nPaper trading and market commentary, not investment advice.`, from: FROM, kind: "strategy_alert" });
    if (!sent.ok) console.error("strategy email failed:", sent.error);
  } catch (e) {
    console.error("strategy email failed:", e instanceof Error ? e.message : e);
  }
}

/** The contract a strategy's option rule picks today: the listed expiry nearest its days out, the strike nearest its delta. */
async function pickContract(ticker: string, rules: Rules): Promise<{ contract: string; ask: number | null } | null> {
  if (!rules.option) return null;
  const first = await chainView(ticker);
  if (!first.expiries.length) return null;
  const want = Date.now() + rules.option.dte * 86_400_000;
  const expiry = [...first.expiries].sort((a, b) => Math.abs(Date.parse(`${a}T21:00:00Z`) - want) - Math.abs(Date.parse(`${b}T21:00:00Z`) - want))[0];
  const chain = expiry === first.expiry ? first : await chainView(ticker, expiry);
  const side = rules.direction === "long" ? "call" : "put";
  let best: { contract: string; ask: number | null; gap: number } | null = null;
  for (const row of chain.rows) {
    const s = row[side];
    if (!s?.contract || s.delta == null) continue;
    const gap = Math.abs(Math.abs(s.delta) - rules.option.delta);
    if (!best || gap < best.gap) best = { contract: s.contract, ask: s.ask, gap };
  }
  return best ? { contract: best.contract, ask: best.ask } : null;
}

async function enter(s: Strategy, ticker: string, price: number, today: string) {
  // One firing a day per strategy and stock: the unique key settles races between two runs.
  const { data: sig, error } = await db()
    .from("strategy_signals")
    .insert({ strategy_id: s.id, user_id: s.user_id, ticker, day: today, price, status: "alerted" })
    .select("id")
    .single();
  if (error || !sig) return false;

  let traded = "";
  if (s.auto_trade) {
    let symbol = ticker;
    let qty = Math.max(1, Math.floor(SHARES_DOLLARS / price));
    if (s.rules.option) {
      const pick = await pickContract(ticker, s.rules).catch(() => null);
      if (!pick) {
        await db().from("strategy_signals").update({ status: "failed", note: "No option chain to pick a contract from" }).eq("id", sig.id);
        traded = " It couldn't find an option to trade.";
      } else {
        symbol = pick.contract;
        qty = 1;
      }
    } else if (s.rules.direction === "short") {
      // Paper trading can't short shares yet.
      await db().from("strategy_signals").update({ status: "failed", note: "Shorting shares isn't available in paper trading" }).eq("id", sig.id);
      traded = " Paper trading can't short shares yet, so it didn't trade.";
      symbol = "";
    }
    if (symbol && !traded) {
      const r = await placeOrder(s.user_id, { symbol, side: "buy", qty, type: "market" });
      if ("error" in r) {
        await db().from("strategy_signals").update({ status: "failed", symbol, qty, note: r.error }).eq("id", sig.id);
        traded = ` The paper order didn't go through: ${r.error}`;
      } else {
        await db().from("strategy_signals").update({ status: "open", symbol, qty }).eq("id", sig.id);
        const what = symbol.startsWith("O:") ? parseContract(symbol) : null;
        traded = what
          ? ` Bought 1 ${ticker} ${what.expiry} $${what.strike} ${what.type} on your paper account${r.fill ? ` at ${r.fill.price.toFixed(2)}` : " (fills at the open)"}.`
          : ` Bought ${qty} ${ticker} shares on your paper account${r.fill ? ` at ${r.fill.price.toFixed(2)}` : ""}.`;
      }
    }
  }

  if (s.alerts || s.auto_trade) {
    const title = `${s.name} fired on ${ticker}`;
    const body = `${ticker} at ${price.toFixed(2)}: ${s.rules.entry.map(conditionText).join(", ")}.${traded}`;
    await notify(s.user_id, { kind: "strategy", title, body, href: `/dashboard?t=${ticker}` });
    if (s.alerts) await emailUser(s.user_id, title, body);
  }
  return true;
}

async function exit(sig: Signal, s: Strategy, bars: Candle[]): Promise<boolean> {
  const rules = s.rules;
  const long = rules.direction === "long";
  const last = bars[bars.length - 1];
  const price = last.c;
  const move = ((price - sig.price) / sig.price) * 100 * (long ? 1 : -1);
  const held = bars.filter((b) => b.t.slice(0, 10) > sig.day).length;
  const contract = sig.symbol?.startsWith("O:") ? parseContract(sig.symbol) : null;
  const today = newYorkDate(Date.now());
  let reason: string | null = null;
  if (rules.stopPct && move <= -rules.stopPct) reason = "stop";
  else if (rules.targetPct && move >= rules.targetPct) reason = "target";
  else if (new Calc(bars, await contextFor(rules, sig.ticker)).any(rules.exit, bars.length - 1)) reason = "exit rule";
  else if (rules.maxDays && held >= rules.maxDays) reason = "time limit";
  else if (contract && Date.parse(`${contract.expiry}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`) <= 86_400_000) reason = "expiry";
  if (!reason || !sig.symbol || !sig.qty) return false;

  const { data: pos } = await db().from("paper_positions").select("qty").eq("user_id", sig.user_id).eq("symbol", sig.symbol).maybeSingle();
  const qty = Math.min(Number(pos?.qty ?? 0), Number(sig.qty));
  if (qty > 0) {
    const r = await placeOrder(sig.user_id, { symbol: sig.symbol, side: "sell", qty, type: "market" });
    if ("error" in r) return false;
  }
  await db().from("strategy_signals").update({ status: "closed", exit_reason: reason, exit_price: price, closed_at: new Date().toISOString() }).eq("id", sig.id);
  await notify(sig.user_id, {
    kind: "strategy",
    title: `${s.name} closed ${sig.ticker} (${reason})`,
    body: qty > 0 ? `Sold on your paper account. ${sig.ticker} moved ${move >= 0 ? "+" : ""}${move.toFixed(1)}% in the trade's favour.` : "You'd already closed it.",
    href: "/journal",
  });
  return true;
}

/** One pass over every live strategy. Market hours only; the cron calls it every five minutes. */
export async function checkStrategies(): Promise<{ strategies: number; fired: number; closed: number }> {
  const out = { strategies: 0, fired: 0, closed: 0 };
  if (!marketOpen(Date.now())) return out;
  const today = newYorkDate(Date.now());
  const { data: rows } = await db().from("strategies").select("id, user_id, name, rules, watch, alerts, auto_trade").eq("live", true).limit(1000);
  const strategies: Strategy[] = [];
  for (const r of rows ?? []) {
    const rules = cleanRules(r.rules);
    if (rules && Array.isArray(r.watch) && r.watch.length) strategies.push({ ...(r as Omit<Strategy, "rules">), rules });
  }
  out.strategies = strategies.length;
  const { data: openRows } = await db().from("strategy_signals").select("id, strategy_id, user_id, ticker, day, price, symbol, qty, status").eq("status", "open").limit(2000);
  const open = (openRows ?? []) as Signal[];
  const byId = new Map(strategies.map((s) => [s.id, s]));
  // Strategies switched off still close what they opened.
  const missing = [...new Set(open.map((o) => o.strategy_id).filter((id) => !byId.has(id)))];
  if (missing.length) {
    const { data: more } = await db().from("strategies").select("id, user_id, name, rules, watch, alerts, auto_trade").in("id", missing);
    for (const r of more ?? []) {
      const rules = cleanRules(r.rules);
      if (rules) byId.set(r.id, { ...(r as Omit<Strategy, "rules">), rules });
    }
  }

  const tickers = [...new Set([...strategies.flatMap((s) => s.watch), ...open.map((o) => o.ticker)])].slice(0, 300);
  const bars = new Map<string, Candle[]>();
  for (const t of tickers) {
    const set = await getCandles(t).catch(() => null);
    if (set?.candles.length) bars.set(t, set.candles);
  }

  for (const sig of open) {
    const s = byId.get(sig.strategy_id);
    const b = bars.get(sig.ticker);
    if (s && b && (await exit(sig, s, b).catch(() => false))) out.closed++;
  }
  for (const s of strategies) {
    for (const t of s.watch) {
      const b = bars.get(t);
      if (!b || !firesNow(b, s.rules, today, await contextFor(s.rules, t))) continue;
      if (open.some((o) => o.strategy_id === s.id && o.ticker === t)) continue; // already in a trade on it
      if (await enter(s, t, b[b.length - 1].c, today).catch(() => false)) out.fired++;
    }
  }
  return out;
}
