// Strategies, live (Ben, 2026-11-19: "Alerts when it fires, Auto paper-trade, Show on the chart, Scanner of matches").
// Every five minutes in market hours (api/cron/check-alerts) each strategy that's switched on is checked on the stocks it
// watches, against daily bars that include today's bar so far:
// - When every entry criterion and rule is true, it fires once that day for that stock: a bell notice and an email
//   (when alerts are on), and, when auto paper-trade is on, a market order on the member's paper account by its
//   contract rule (spec.ts): the listed expiry and strike it picks, or shares, sized by contracts, dollars or a percent
//   of the account. Paper trading can't hold spreads or short shares yet, so those alert only.
// - A trade it opened is checked against its Stop group, then its Exit group (each "any" or "all", spec.ts), and
//   closed by itself; an option is closed the day before it expires if nothing came first.
// Each firing is a row in public.strategy_signals.

import { supabaseService } from "@/lib/stripe";
import { getCandles } from "@/lib/candles";
import { marketOpen, newYorkDate } from "@/lib/marketCalendar";
import { notify } from "@/lib/notify";
import { SITE_URL, sendMail } from "@/lib/mail";
import { chainView } from "@/lib/paperChain";
import { optionMarket, placeOrder } from "@/lib/paper";
import { parseContract } from "@/lib/optionQuotes";
import { NEWS_START, stockNews } from "@/lib/alpaca";
import type { Candle } from "@/lib/chart/types";
import { Calc, type Context } from "./rules";
import { ACCOUNT, checksOf, cleanSpec, entryConditions, entryText, usesNewsSpec, type Spec } from "./spec";
import { groupFires } from "./backtest";

const db = () => supabaseService();
const FROM = process.env.ALERTS_FROM || "HighStrike Alerts <alerts@mail.highstrike.com>";

type Strategy = { id: string; user_id: string; name: string; spec: Spec; watch: string[]; alerts: boolean; auto_trade: boolean };
type Signal = { id: string; strategy_id: string; user_id: string; ticker: string; day: string; price: number; symbol: string | null; qty: number | null; status: string };

/** Whether a strategy's entry is true on the last bar, and that bar is today's. */
export function firesNow(bars: Candle[], spec: Spec, today: string, ctx: Context = {}) {
  if (bars.length < 30 || bars[bars.length - 1].t.slice(0, 10) !== today) return false;
  const conds = entryConditions(spec);
  const calc = new Calc(bars, ctx);
  return conds.length > 0 && conds.every((c) => calc.holds(c, bars.length - 1));
}

/** The news a strategy needs for one stock, or nothing when it has no news criteria. */
async function contextFor(spec: Spec, ticker: string): Promise<Context> {
  return usesNewsSpec(spec) ? { news: await stockNews(ticker).catch(() => []), newsFrom: NEWS_START } : {};
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

/** The contract the strategy's rule picks today from the listed chain. */
async function pickContract(ticker: string, spec: Spec, spot: number): Promise<{ contract: string; ask: number | null } | null> {
  const ct = spec.contract;
  const first = await chainView(ticker);
  if (!first.expiries.length) return null;
  const today = Date.parse(`${newYorkDate(Date.now())}T12:00:00Z`);
  const want = today + ct.dte * 86_400_000;
  const dated = first.expiries.map((e) => ({ e, ms: Date.parse(`${e}T12:00:00Z`) }));
  const expiry =
    ct.expiryRule === "atLeast"
      ? (dated.find((d) => d.ms >= want) ?? dated[dated.length - 1]).e
      : [...dated].sort((a, b) => Math.abs(a.ms - want) - Math.abs(b.ms - want))[0].e;
  const chain = expiry === first.expiry ? first : await chainView(ticker, expiry);
  const side = spec.direction === "long" ? "call" : "put";
  const target =
    ct.strike.by === "atm" ? spot : ct.strike.by === "otmPct" ? spot * (1 + ((side === "call" ? 1 : -1) * ct.strike.value) / 100) : null;
  let best: { contract: string; ask: number | null; gap: number } | null = null;
  for (const row of chain.rows) {
    const s = row[side];
    if (!s?.contract) continue;
    const gap = target != null ? Math.abs(row.strike - target) : s.delta != null ? Math.abs(Math.abs(s.delta) - ct.strike.value) : Infinity;
    if (!best || gap < best.gap) best = { contract: s.contract, ask: s.ask, gap };
  }
  return best && best.gap < Infinity ? { contract: best.contract, ask: best.ask } : null;
}

/** How many to buy, by the contract rule's size. */
function sizeFor(spec: Spec, unitCost: number) {
  const z = spec.contract.size;
  if (z.by === "contracts") return Math.max(1, Math.round(z.value));
  const budget = z.by === "dollars" ? z.value : (ACCOUNT * z.value) / 100;
  return Math.max(1, Math.floor(budget / Math.max(0.01, unitCost)));
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
  const fail = async (note: string, said: string) => {
    await db().from("strategy_signals").update({ status: "failed", note }).eq("id", sig.id);
    traded = ` ${said}`;
  };
  if (s.auto_trade) {
    const ct = s.spec.contract;
    let symbol = "";
    let qty = 0;
    if (ct.kind === "spread") await fail("Paper trading can't hold spreads yet", "Paper trading can't hold spreads yet, so it didn't trade.");
    else if (ct.kind === "shares" && s.spec.direction === "short") await fail("Shorting shares isn't available in paper trading", "Paper trading can't short shares yet, so it didn't trade.");
    else if (ct.kind === "shares") {
      symbol = ticker;
      qty = sizeFor(s.spec, price);
    } else {
      const pick = await pickContract(ticker, s.spec, price).catch(() => null);
      if (!pick) await fail("No option chain to pick a contract from", "It couldn't find an option to trade.");
      else {
        symbol = pick.contract;
        qty = sizeFor(s.spec, (pick.ask ?? 0) * 100 || price);
      }
    }
    if (symbol) {
      const r = await placeOrder(s.user_id, { symbol, side: "buy", qty, type: "market" });
      if ("error" in r) {
        await db().from("strategy_signals").update({ status: "failed", symbol, qty, note: r.error }).eq("id", sig.id);
        traded = ` The paper order didn't go through: ${r.error}`;
      } else {
        await db().from("strategy_signals").update({ status: "open", symbol, qty }).eq("id", sig.id);
        const what = symbol.startsWith("O:") ? parseContract(symbol) : null;
        traded = what
          ? ` Bought ${qty} ${ticker} ${what.expiry} $${what.strike} ${what.type}${qty === 1 ? "" : "s"} on your paper account${r.fill ? ` at ${r.fill.price.toFixed(2)}` : " (fills at the open)"}.`
          : ` Bought ${qty} ${ticker} shares on your paper account${r.fill ? ` at ${r.fill.price.toFixed(2)}` : ""}.`;
      }
    }
  }

  if (s.alerts || s.auto_trade) {
    const title = `${s.name} fired on ${ticker}`;
    const body = `${ticker} at ${price.toFixed(2)}: ${entryText(s.spec)}.${traded}`;
    await notify(s.user_id, { kind: "strategy", title, body, href: `/dashboard?t=${ticker}` });
    if (s.alerts) await emailUser(s.user_id, title, body);
  }
  return true;
}

async function exit(sig: Signal, s: Strategy, bars: Candle[]): Promise<boolean> {
  if (!sig.symbol || !sig.qty) return false;
  const spec = s.spec;
  const long = spec.direction === "long";
  const last = bars[bars.length - 1];
  const contract = sig.symbol.startsWith("O:") ? parseContract(sig.symbol) : null;
  const { data: pos } = await db().from("paper_positions").select("qty, avg_price").eq("user_id", sig.user_id).eq("symbol", sig.symbol).maybeSingle();
  const held = Number(pos?.qty ?? 0);
  const avg = Number(pos?.avg_price ?? 0);
  // The position's value now: the option's mark, or the stock's price.
  const mark = contract ? ((await optionMarket(sig.symbol, last.c).catch(() => null))?.mid ?? null) : last.c;
  const mult = contract ? 100 : 1;
  const optPct = contract && mark != null && avg > 0 ? ((mark - avg) / avg) * 100 : null;
  const today = newYorkDate(Date.now());
  const dte = contract ? (Date.parse(`${contract.expiry}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000 : null;
  const st = {
    long,
    entry: Number(sig.price),
    bar: last,
    optPct,
    dollars: mark != null ? (mark - avg) * held * mult : 0,
    days: bars.filter((b) => b.t.slice(0, 10) > sig.day).length,
    dte,
    positive: optPct == null ? true : optPct >= 0,
  };
  const calc = new Calc(bars, await contextFor(spec, sig.ticker));
  const j = bars.length - 1;
  const stop = groupFires(spec.stop, checksOf(spec.stop), calc, j, st);
  const ex = stop ? null : groupFires(spec.exit, checksOf(spec.exit), calc, j, st);
  const reason = stop ? `stop: ${stop.why}` : ex ? `exit: ${ex.why}` : dte != null && dte <= 1 ? "expiry" : null;
  if (!reason) return false;

  const qty = Math.min(held, Number(sig.qty));
  if (qty > 0) {
    const r = await placeOrder(sig.user_id, { symbol: sig.symbol, side: "sell", qty, type: "market" });
    if ("error" in r) return false;
  }
  const move = ((last.c - sig.price) / sig.price) * 100 * (long ? 1 : -1);
  await db().from("strategy_signals").update({ status: "closed", exit_reason: reason, exit_price: last.c, closed_at: new Date().toISOString() }).eq("id", sig.id);
  await notify(sig.user_id, {
    kind: "strategy",
    title: `${s.name} closed ${sig.ticker} (${reason.split(":")[0]})`,
    body: qty > 0 ? `Sold on your paper account. ${sig.ticker} moved ${move >= 0 ? "+" : ""}${move.toFixed(1)}% in the trade's favour.` : "You'd already closed it.",
    href: "/journal",
  });
  return true;
}

function toStrategy(r: Record<string, unknown>): Strategy | null {
  const spec = cleanSpec(r.rules);
  return spec ? { id: r.id as string, user_id: r.user_id as string, name: r.name as string, spec, watch: (r.watch as string[]) ?? [], alerts: Boolean(r.alerts), auto_trade: Boolean(r.auto_trade) } : null;
}

/** One pass over every live strategy. Market hours only; the cron calls it every five minutes. */
export async function checkStrategies(): Promise<{ strategies: number; fired: number; closed: number }> {
  const out = { strategies: 0, fired: 0, closed: 0 };
  if (!marketOpen(Date.now())) return out;
  const today = newYorkDate(Date.now());
  const cols = "id, user_id, name, rules, watch, alerts, auto_trade";
  const { data: rows } = await db().from("strategies").select(cols).eq("live", true).limit(1000);
  const strategies = (rows ?? []).map(toStrategy).filter((s): s is Strategy => Boolean(s && s.watch.length));
  out.strategies = strategies.length;
  const { data: openRows } = await db().from("strategy_signals").select("id, strategy_id, user_id, ticker, day, price, symbol, qty, status").eq("status", "open").limit(2000);
  const open = (openRows ?? []) as Signal[];
  const byId = new Map(strategies.map((s) => [s.id, s]));
  // Strategies switched off still close what they opened.
  const missing = [...new Set(open.map((o) => o.strategy_id).filter((id) => !byId.has(id)))];
  if (missing.length) {
    const { data: more } = await db().from("strategies").select(cols).in("id", missing);
    for (const r of more ?? []) {
      const s = toStrategy(r);
      if (s) byId.set(s.id, s);
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
      if (!b || !firesNow(b, s.spec, today, await contextFor(s.spec, t))) continue;
      if (open.some((o) => o.strategy_id === s.id && o.ticker === t)) continue; // already in a trade on it
      if (await enter(s, t, b[b.length - 1].c, today).catch(() => false)) out.fired++;
    }
  }
  return out;
}
