import { supabaseService } from "@/lib/stripe";
import { marketOpen, newYorkDate } from "@/lib/marketCalendar";
import { bs, volatility } from "@/lib/options/pricing";
import { getCandles } from "@/lib/candles";
import { contractQuote, parseContract } from "@/lib/optionQuotes";
import { indicativeChain, optionLive, type IndicativeQuote } from "@/lib/alpaca";

// The paper trading engine (Ben, 2026-11-18: Home becomes "the paper trading charts and execution hub"; $25,000 to
// start). Every order is priced and filled here, on the server, from real prices:
// - Stocks fill at the live price (Finnhub, fetched fresh), with a cent of slippage against you.
// - Options fill at the delayed ask (buying) or bid (selling) when the Massive plan has option quotes. On the free plan
//   they fill at an estimate: Black-Scholes at the live stock price and the contract's own implied volatility (solved
//   from its last close), plus half a spread against you (3% of the price, at least 5 cents). Marked est.
// - Market orders fill only while the market's open; outside it they wait for the open. Limit orders fill when the
//   price reaches them (checked every minute in market hours by /api/cron/check-alerts, and on each order).
// - No shorting and no selling options to open in this first version: you can sell only what you hold. Buying needs
//   the cash. An option still held after its expiry settles at what it's worth then (in the money, else zero).
// Members read their rows through RLS; only this file writes them (service role).

export const START_BALANCE = 25_000;
const MAX_QTY = 10_000;

export type Kind = "stock" | "option";
export type OrderInput = { symbol: string; side: "buy" | "sell"; qty: number; type: "market" | "limit"; limit?: number | null };
export type Fill = { price: number; source: "live" | "quote" | "indicative" | "est" | "expiry" };

let testDb: ReturnType<typeof supabaseService> | null = null;
/** Tests only: run the engine against a stand-in database. */
export const __useTestDb = (fake: unknown) => {
  testDb = fake as ReturnType<typeof supabaseService>;
};
const db = () => testDb ?? supabaseService();
const cents = (n: number) => Math.round(n * 100) / 100;
const TICKER = /^[A-Z][A-Z0-9.]{0,7}$/;

export const kindOf = (symbol: string): Kind => (symbol.startsWith("O:") ? "option" : "stock");
export const multiplier = (k: Kind) => (k === "option" ? 100 : 1);

/** The live stock price, fetched fresh (not the 60-second cached quote), or null when there's no live price. */
export async function liveStock(ticker: string): Promise<{ price: number; prevClose: number | null } | null> {
  const token = process.env.FINNHUB_API_KEY;
  if (!token) return null;
  try {
    const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(ticker)}&token=${token}`, { cache: "no-store", signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const q = (await res.json()) as { c?: number; pc?: number };
    return q.c && q.c > 0 ? { price: q.c, prevClose: q.pc || null } : null;
  } catch {
    return null;
  }
}

/** An option's fair price now (per share), from its quote or the model, and the bid and ask a fill would get. */
export async function optionMarket(contract: string, spot: number | null): Promise<{ bid: number; ask: number; mid: number; source: "quote" | "indicative" | "est" } | null> {
  const p = parseContract(contract);
  if (!p) return null;
  const { candles } = await getCandles(p.underlying);
  const closes = new Map(candles.map((c) => [c.t, c.c]));
  const q = await contractQuote(contract, (day) => closes.get(day) ?? candles.at(-1)?.c ?? null);
  if (q && q.priceKind === "mid" && q.bid != null && q.ask != null && q.ask > 0) {
    return { bid: q.bid, ask: q.ask, mid: cents((q.bid + q.ask) / 2), source: "quote" };
  }
  // Alpaca's free indicative quote for the contract, when its keys are in (kept 30 seconds per expiry).
  const ind = await indicativeFor(p.underlying, p.expiry);
  const iq = ind?.get(contract);
  if (iq && iq.bid != null && iq.ask != null && iq.ask > 0) return { bid: iq.bid, ask: iq.ask, mid: cents((iq.bid + iq.ask) / 2), source: "indicative" };
  const s = spot ?? candles.at(-1)?.c ?? null;
  if (!s) return null;
  const iv = q?.iv ?? volatility(candles.slice(-31).map((c) => c.c));
  const years = Math.max(0.5, (Date.parse(`${p.expiry}T21:00:00Z`) - Date.now()) / 86_400_000) / 365;
  const mid = Math.max(0.01, bs(p.type, s, p.strike, years, iv));
  const spread = Math.max(0.05, mid * 0.03);
  return { bid: cents(Math.max(0.01, mid - spread / 2)), ask: cents(mid + spread / 2), mid: cents(mid), source: "est" };
}

const indicativeMemo = new Map<string, { at: number; value: Promise<Map<string, IndicativeQuote> | null> }>();
function indicativeFor(underlying: string, expiry: string) {
  const k = `${underlying}:${expiry}`;
  const hit = indicativeMemo.get(k);
  if (hit && Date.now() - hit.at < 30_000) return hit.value;
  const value = indicativeChain(underlying, expiry);
  indicativeMemo.set(k, { at: Date.now(), value });
  return value;
}

/** What a fill would be now for this side, or null when it can't fill (closed market, no price). */
async function fillPrice(symbol: string, side: "buy" | "sell"): Promise<Fill | null> {
  if (!marketOpen(Date.now())) return null;
  if (kindOf(symbol) === "stock") {
    const q = await liveStock(symbol);
    return q ? { price: cents(q.price + (side === "buy" ? 0.01 : -0.01)), source: "live" } : null;
  }
  const p = parseContract(symbol);
  if (!p) return null;
  const spot = await liveStock(p.underlying);
  const m = await optionMarket(symbol, spot?.price ?? null);
  return m ? { price: side === "buy" ? m.ask : m.bid, source: m.source } : null;
}

export async function ensureAccount(userId: string) {
  const { data } = await db().from("paper_accounts").select("*").eq("user_id", userId).maybeSingle();
  if (data) return data as { user_id: string; cash: number; start_balance: number; realized: number; resets: number };
  const { data: made } = await db().from("paper_accounts").upsert({ user_id: userId, cash: START_BALANCE, start_balance: START_BALANCE }).select("*").single();
  return made as { user_id: string; cash: number; start_balance: number; realized: number; resets: number };
}

type OrderRow = {
  id: string;
  user_id: string;
  symbol: string;
  kind: Kind;
  underlying: string;
  side: "buy" | "sell";
  qty: number;
  order_type: "market" | "limit";
  limit_price: number | null;
  status: string;
  option_type: "call" | "put" | null;
  strike: number | null;
  expiry: string | null;
};

/** Applies a fill to the account and the position. Returns an error in words when it can't (cash, holdings). */
async function applyFill(o: OrderRow, f: Fill): Promise<string | null> {
  const acct = await ensureAccount(o.user_id);
  const mult = multiplier(o.kind);
  const value = cents(f.price * o.qty * mult);
  const { data: pos } = await db().from("paper_positions").select("qty, avg_price").eq("user_id", o.user_id).eq("symbol", o.symbol).maybeSingle();
  const held = Number(pos?.qty ?? 0);
  const dollars = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (o.side === "buy" && value > Number(acct.cash) + 0.005) return `Not enough cash: this costs ${dollars(value)} and you have ${dollars(Number(acct.cash))}.`;
  if (o.side === "sell" && o.qty > held) return held > 0 ? `You hold ${held}; you can sell up to that.` : "You can only sell what you hold (no shorting in paper trading yet).";

  let realized = 0;
  if (o.side === "buy") {
    const qty = held + o.qty;
    const avg = (held * Number(pos?.avg_price ?? 0) + o.qty * f.price) / qty;
    await db()
      .from("paper_positions")
      .upsert({
        user_id: o.user_id,
        symbol: o.symbol,
        kind: o.kind,
        underlying: o.underlying,
        qty,
        avg_price: Math.round(avg * 10_000) / 10_000,
        option_type: o.option_type,
        strike: o.strike,
        expiry: o.expiry,
        ...(held === 0 ? { opened_at: new Date().toISOString() } : {}),
      });
  } else {
    realized = cents((f.price - Number(pos!.avg_price)) * o.qty * mult);
    const left = held - o.qty;
    if (left <= 0) await db().from("paper_positions").delete().eq("user_id", o.user_id).eq("symbol", o.symbol);
    else await db().from("paper_positions").update({ qty: left }).eq("user_id", o.user_id).eq("symbol", o.symbol);
  }
  await db()
    .from("paper_accounts")
    .update({ cash: cents(Number(acct.cash) + (o.side === "buy" ? -value : value)), realized: cents(Number(acct.realized) + realized) })
    .eq("user_id", o.user_id);
  await db().from("paper_orders").update({ status: "filled", fill_price: f.price, price_source: f.source, filled_at: new Date().toISOString() }).eq("id", o.id);
  return null;
}

/** Whether a working order fills at this price. */
const crosses = (o: Pick<OrderRow, "order_type" | "side" | "limit_price">, f: Fill) =>
  o.order_type === "market" || (o.limit_price != null && (o.side === "buy" ? f.price <= Number(o.limit_price) : f.price >= Number(o.limit_price)));

/** Places an order: checks it, saves it, and fills it now when it can. */
export async function placeOrder(userId: string, input: OrderInput): Promise<{ ok: true; status: string; fill?: Fill; note?: string } | { error: string }> {
  const symbol = String(input.symbol ?? "").trim().toUpperCase().replace(/^\$/, "");
  const kind = kindOf(symbol);
  const parsed = kind === "option" ? parseContract(symbol) : null;
  if (kind === "stock" ? !TICKER.test(symbol) : !parsed) return { error: "That symbol isn't one HighStrike can trade." };
  if (parsed && parsed.expiry < newYorkDate(Date.now())) return { error: "That contract has expired." };
  const qty = Math.floor(Number(input.qty));
  if (!(qty >= 1 && qty <= MAX_QTY)) return { error: `Enter a quantity from 1 to ${MAX_QTY.toLocaleString("en-US")}.` };
  if (input.side !== "buy" && input.side !== "sell") return { error: "Pick buy or sell." };
  if (input.type !== "market" && input.type !== "limit") return { error: "Pick market or limit." };
  const limit = input.type === "limit" ? cents(Number(input.limit)) : null;
  if (input.type === "limit" && !(limit! > 0)) return { error: "Enter a limit price." };

  const acct = await ensureAccount(userId);
  if (input.side === "sell") {
    const { data: pos } = await db().from("paper_positions").select("qty").eq("user_id", userId).eq("symbol", symbol).maybeSingle();
    if (!pos || Number(pos.qty) < qty) return { error: pos ? `You hold ${Number(pos.qty)}; you can sell up to that.` : "You can only sell what you hold (no shorting in paper trading yet)." };
  }

  const { data: order, error } = await db()
    .from("paper_orders")
    .insert({
      user_id: userId,
      symbol,
      kind,
      underlying: parsed?.underlying ?? symbol,
      side: input.side,
      qty,
      order_type: input.type,
      limit_price: limit,
      option_type: parsed?.type ?? null,
      strike: parsed?.strike ?? null,
      expiry: parsed?.expiry ?? null,
    })
    .select("*")
    .single();
  if (error || !order) return { error: "The order couldn't be placed. Try again." };

  const f = await fillPrice(symbol, input.side);
  if (!f) {
    if (input.side === "buy" && limit != null && limit * qty * multiplier(kind) > Number(acct.cash)) {
      await db().from("paper_orders").update({ status: "rejected", note: "Not enough cash" }).eq("id", order.id);
      return { error: "Not enough cash for that order." };
    }
    return { ok: true, status: "working", note: marketOpen(Date.now()) ? "No price right now; it'll fill when there is one." : "The market's closed: it fills at the open." };
  }
  if (!crosses(order as OrderRow, f)) return { ok: true, status: "working", note: `Working: fills when the price reaches $${limit!.toFixed(2)}.` };
  const why = await applyFill(order as OrderRow, f);
  if (why) {
    await db().from("paper_orders").update({ status: "rejected", note: why }).eq("id", order.id);
    return { error: why };
  }
  return { ok: true, status: "filled", fill: f };
}

export async function cancelOrder(userId: string, id: string) {
  const { error } = await db().from("paper_orders").update({ status: "cancelled" }).eq("id", id).eq("user_id", userId).eq("status", "working");
  return error ? ({ error: "Couldn't cancel it." } as const) : ({ ok: true } as const);
}

export async function resetAccount(userId: string) {
  const acct = await ensureAccount(userId);
  await db().from("paper_orders").update({ status: "cancelled", note: "Account reset" }).eq("user_id", userId).eq("status", "working");
  await db().from("paper_positions").delete().eq("user_id", userId);
  await db()
    .from("paper_accounts")
    .update({ cash: START_BALANCE, start_balance: START_BALANCE, realized: 0, resets: Number(acct.resets) + 1, reset_at: new Date().toISOString() })
    .eq("user_id", userId);
  return { ok: true as const };
}

/**
 * Fills working orders whose price has come (market orders at the open; limits when reached) and settles options held
 * past their expiry. Run every minute in market hours (/api/cron/check-alerts) and after each order.
 */
export async function sweepPaper(): Promise<{ filled: number; settled: number }> {
  let filled = 0;
  let settled = 0;
  const today = newYorkDate(Date.now());

  // Expired options: worth what they're in the money by at the stock's last close, else nothing.
  const { data: expired } = await db().from("paper_positions").select("*").eq("kind", "option").lt("expiry", today).limit(500);
  for (const p of expired ?? []) {
    const close = (await liveStock(p.underlying))?.prevClose ?? (await getCandles(p.underlying)).candles.at(-1)?.c ?? null;
    if (close == null) continue;
    const worth = Math.max(0, p.option_type === "call" ? close - Number(p.strike) : Number(p.strike) - close);
    const order = await db()
      .from("paper_orders")
      .insert({ user_id: p.user_id, symbol: p.symbol, kind: "option", underlying: p.underlying, side: "sell", qty: Number(p.qty), order_type: "market", option_type: p.option_type, strike: p.strike, expiry: p.expiry, note: "Expired" })
      .select("*")
      .single();
    if (order.data && !(await applyFill(order.data as OrderRow, { price: cents(worth), source: "expiry" }))) settled++;
    if (order.data) await db().from("paper_orders").update({ status: "expired" }).eq("id", order.data.id);
  }

  if (!marketOpen(Date.now())) return { filled, settled };
  const { data: working } = await db().from("paper_orders").select("*").eq("status", "working").order("created_at").limit(500);
  const prices = new Map<string, Fill | null>();
  for (const o of (working ?? []) as OrderRow[]) {
    const k = `${o.symbol}:${o.side}`;
    if (!prices.has(k)) prices.set(k, await fillPrice(o.symbol, o.side));
    const f = prices.get(k);
    if (!f || !crosses(o, f)) continue;
    const why = await applyFill(o, f);
    if (why) await db().from("paper_orders").update({ status: "rejected", note: why }).eq("id", o.id);
    else filled++;
  }
  return { filled, settled };
}

export type PositionView = {
  symbol: string;
  kind: Kind;
  underlying: string;
  qty: number;
  avg: number;
  mark: number | null;
  markSource: "live" | "quote" | "indicative" | "est" | "close" | null;
  value: number | null;
  pnl: number | null;
  pnlPct: number | null;
  dayChangePct: number | null;
  /** When the position was opened (ISO). */
  openedAt: string;
  /** What it cost to open: the average price × quantity (× 100 for a contract). */
  cost: number;
  /** Today's profit or loss: from the previous close, or from the entry when it was opened today. */
  dayPnl: number | null;
  optionType: "call" | "put" | null;
  strike: number | null;
  expiry: string | null;
};

export type OrderView = {
  id: string;
  symbol: string;
  kind: Kind;
  side: "buy" | "sell";
  qty: number;
  type: "market" | "limit";
  limit: number | null;
  status: string;
  fill: number | null;
  source: string | null;
  note: string | null;
  at: string;
  filledAt: string | null;
};

export type PaperState = {
  cash: number;
  start: number;
  realized: number;
  equity: number;
  positionsValue: number;
  openPnl: number;
  totalPnl: number;
  positions: PositionView[];
  orders: OrderView[];
  open: boolean;
  optionPrices: "quote" | "indicative" | "est";
};

/** The account as the desk shows it: cash, positions marked to the market, the last 60 orders. */
export async function paperState(userId: string): Promise<PaperState> {
  const acct = await ensureAccount(userId);
  const [{ data: pos }, { data: ords }] = await Promise.all([
    db().from("paper_positions").select("*").eq("user_id", userId).order("opened_at"),
    db().from("paper_orders").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(60),
  ]);
  const underlyings = [...new Set((pos ?? []).map((p) => p.underlying as string))];
  const spots = new Map(await Promise.all(underlyings.map(async (u) => [u, await liveStock(u)] as const)));
  let optionPrices: "quote" | "indicative" | "est" = "est";
  const positions: PositionView[] = await Promise.all(
    (pos ?? []).map(async (p) => {
      const kind = p.kind as Kind;
      const s = spots.get(p.underlying);
      let mark: number | null = null;
      let markSource: PositionView["markSource"] = null;
      let day: number | null = null;
      let prevClose: number | null = null;
      if (kind === "stock") {
        mark = s?.price ?? null;
        markSource = s ? "live" : null;
        day = s?.prevClose ? ((s.price - s.prevClose) / s.prevClose) * 100 : null;
        prevClose = s?.prevClose ?? null;
      } else {
        const [m, live] = await Promise.all([optionMarket(p.symbol, s?.price ?? null), optionLive(p.symbol).catch(() => null)]);
        prevClose = live?.prevClose ?? null;
        if (prevClose && m?.mid) day = ((m.mid - prevClose) / prevClose) * 100;
        mark = m?.mid ?? null;
        markSource = m?.source ?? null;
        if (m?.source === "quote") optionPrices = "quote";
        else if (m?.source === "indicative" && optionPrices === "est") optionPrices = "indicative";
      }
      const qty = Number(p.qty);
      const avg = Number(p.avg_price);
      const mult = multiplier(kind);
      const value = mark != null ? cents(mark * qty * mult) : null;
      const pnl = mark != null ? cents((mark - avg) * qty * mult) : null;
      const openedAt = String(p.opened_at);
      // Opened today: today's P/L is all of it; otherwise it's from the previous close.
      const openedToday = newYorkDate(Date.parse(openedAt)) === newYorkDate(Date.now());
      const dayPnl = mark == null ? null : openedToday ? pnl : prevClose != null ? cents((mark - prevClose) * qty * mult) : null;
      return {
        symbol: p.symbol,
        kind,
        underlying: p.underlying,
        qty,
        avg,
        mark,
        markSource,
        value,
        pnl,
        pnlPct: mark != null && avg > 0 ? Math.round(((mark - avg) / avg) * 1000) / 10 : null,
        dayChangePct: day != null ? Math.round(day * 100) / 100 : null,
        openedAt,
        cost: cents(avg * Math.abs(qty) * mult),
        dayPnl,
        optionType: p.option_type,
        strike: p.strike != null ? Number(p.strike) : null,
        expiry: p.expiry,
      };
    })
  );
  const positionsValue = cents(positions.reduce((a, p) => a + (p.value ?? p.avg * p.qty * multiplier(p.kind)), 0));
  const openPnl = cents(positions.reduce((a, p) => a + (p.pnl ?? 0), 0));
  const cash = Number(acct.cash);
  const equity = cents(cash + positionsValue);
  return {
    cash,
    start: Number(acct.start_balance),
    realized: Number(acct.realized),
    equity,
    positionsValue,
    openPnl,
    totalPnl: cents(equity - Number(acct.start_balance)),
    positions,
    orders: (ords ?? []).map((o) => ({
      id: o.id,
      symbol: o.symbol,
      kind: o.kind,
      side: o.side,
      qty: Number(o.qty),
      type: o.order_type,
      limit: o.limit_price != null ? Number(o.limit_price) : null,
      status: o.status,
      fill: o.fill_price != null ? Number(o.fill_price) : null,
      source: o.price_source,
      note: o.note,
      at: o.created_at,
      filledAt: o.filled_at,
    })),
    open: marketOpen(Date.now()),
    optionPrices,
  };
}

// ---- Closed positions (Ben, 2026-11-19: "Positions tab should show closed positions as well") ------------------------

export type ClosedView = {
  symbol: string;
  kind: Kind;
  underlying: string;
  optionType: "call" | "put" | null;
  strike: number | null;
  expiry: string | null;
  /** The most held at once (shares or contracts). */
  qty: number;
  openedAt: string;
  closedAt: string;
  /** What the buys cost in all, and what the sells brought in. */
  cost: number;
  proceeds: number;
  pnl: number;
  pnlPct: number | null;
  /** True when it ended by expiring (settled at what it was worth). */
  expired: boolean;
};

/**
 * Every position the member opened and closed since the account's last reset, rebuilt from the filled orders: one
 * position runs from a buy out of nothing until the holding is back to nothing.
 */
export async function closedPositions(userId: string): Promise<ClosedView[]> {
  const acct = await ensureAccount(userId);
  const since = (acct as { reset_at?: string }).reset_at ?? "1970-01-01";
  const { data } = await db()
    .from("paper_orders")
    .select("symbol, kind, underlying, side, qty, fill_price, filled_at, status, option_type, strike, expiry")
    .eq("user_id", userId)
    .in("status", ["filled", "expired"])
    .not("fill_price", "is", null)
    .gte("filled_at", since)
    .order("filled_at", { ascending: true })
    .limit(5000);
  const open = new Map<string, { held: number; max: number; cost: number; proceeds: number; openedAt: string; expired: boolean; row: Record<string, unknown> }>();
  const out: ClosedView[] = [];
  for (const o of data ?? []) {
    const mult = multiplier(o.kind as Kind);
    const qty = Number(o.qty);
    const value = Number(o.fill_price) * qty * mult;
    let p = open.get(o.symbol);
    if (o.side === "buy") {
      if (!p) {
        p = { held: 0, max: 0, cost: 0, proceeds: 0, openedAt: o.filled_at as string, expired: false, row: o };
        open.set(o.symbol, p);
      }
      p.held += qty;
      p.max = Math.max(p.max, p.held);
      p.cost += value;
      continue;
    }
    if (!p) continue;
    p.held -= qty;
    p.proceeds += value;
    if (o.status === "expired") p.expired = true;
    if (p.held <= 1e-9) {
      const pnl = cents(p.proceeds - p.cost);
      out.push({
        symbol: o.symbol,
        kind: o.kind as Kind,
        underlying: o.underlying,
        optionType: (o.option_type as "call" | "put" | null) ?? null,
        strike: o.strike != null ? Number(o.strike) : null,
        expiry: (o.expiry as string | null) ?? null,
        qty: p.max,
        openedAt: p.openedAt,
        closedAt: o.filled_at as string,
        cost: cents(p.cost),
        proceeds: cents(p.proceeds),
        pnl,
        pnlPct: p.cost > 0 ? Math.round((pnl / p.cost) * 1000) / 10 : null,
        expired: p.expired,
      });
      open.delete(o.symbol);
    }
  }
  return out;
}
