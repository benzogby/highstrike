import { bs, nickel, probAbove, roundStrike, strikeStep } from "./pricing";

// The swipe deck's options engine (Ben, 2026-11-02: "a tinder style swiping app ... Each setup is an options setup with a
// contract, expiration date, underlying, take profit, stop loss. Each can be naked or a spread"; step 1 of the swipe
// app). From one stock's price, its volatility and which way it leans, these rules build option setups of five kinds
// (single calls and puts, debit spreads, credit spreads, iron condors), each priced with Black-Scholes (estimates) and
// carrying everything a card shows: cost and max loss, max profit and reward to risk, breakevens, the chance of
// profit, take-profit and stop levels on the stock, and one plain line on why. Pure.

export type Structure = "long_call" | "long_put" | "bull_call_spread" | "bear_put_spread" | "bull_put_spread" | "bear_call_spread" | "iron_condor";
export type Bias = "bull" | "bear" | "neutral";

export const STRUCTURES: Record<Structure, { label: string; kind: "single" | "debit" | "credit" | "condor"; bias: Bias }> = {
  long_call: { label: "Call", kind: "single", bias: "bull" },
  long_put: { label: "Put", kind: "single", bias: "bear" },
  bull_call_spread: { label: "Bull call spread", kind: "debit", bias: "bull" },
  bear_put_spread: { label: "Bear put spread", kind: "debit", bias: "bear" },
  bull_put_spread: { label: "Bull put spread", kind: "credit", bias: "bull" },
  bear_call_spread: { label: "Bear call spread", kind: "credit", bias: "bear" },
  iron_condor: { label: "Iron condor", kind: "condor", bias: "neutral" },
};

export type Leg = { side: "buy" | "sell"; type: "call" | "put"; strike: number; price: number };

export type Card = {
  ticker: string;
  structure: Structure;
  bias: Bias;
  expiry: string;
  dte: number;
  spot: number;
  vol: number;
  legs: Leg[];
  /** Per share: positive is paid (a debit), negative is received (a credit). */
  net: number;
  /** Per contract (100 shares), in dollars. Max profit null means unlimited (a call). */
  maxProfit: number | null;
  maxLoss: number;
  rewardRisk: number | null;
  breakevens: number[];
  /** The chance it's profitable at expiry (0-1), on the same model. */
  pop: number;
  /** Stock prices: where to take profit, and where the idea is wrong. */
  takeProfit: number[];
  stopLoss: number[];
  why: string;
};

export type Underlying = { ticker: string; spot: number; vol: number; changePct: number; rangePos: number | null; mom5: number | null };

/** Which way the stock leans today, from the same signals the scanner reads: today's move, its place in the range, five sessions. */
export function biasOf(u: Underlying): Bias {
  const s = u.changePct * 6 + (u.rangePos != null ? (u.rangePos - 0.5) * 30 : 0) + (u.mom5 != null ? u.mom5 * 2 : 0);
  return s > 8 ? "bull" : s < -8 ? "bear" : "neutral";
}

/** The Friday at least `days` after `from` (US listed options expire on Fridays), and the days to it. */
export function expiryAfter(from: Date, days: number) {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate() + days, 12));
  d.setUTCDate(d.getUTCDate() + ((5 - d.getUTCDay() + 7) % 7));
  const dte = Math.max(1, Math.round((d.getTime() - from.getTime()) / 86_400_000));
  return { expiry: d.toISOString().slice(0, 10), dte };
}

const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: n >= 100 ? 0 : 2, maximumFractionDigits: 2 })}`;
const shortDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const round2 = (n: number) => Math.round(n * 100) / 100;

/** One setup of a given kind on a stock, expiring around `days` out; null when its numbers don't make a sensible trade. */
export function buildCard(u: Underlying, structure: Structure, days: number, today: Date, why: string): Card | null {
  const { expiry, dte } = expiryAfter(today, days);
  const T = dte / 365;
  const S = u.spot;
  const v = u.vol;
  const step = strikeStep(S);
  const em = S * v * Math.sqrt(T); // one expected move to expiry
  const price = (type: "call" | "put", K: number) => nickel(bs(type, S, K, T, v));
  const atm = roundStrike(S, step);
  const away = (k: number) => Math.max(step, roundStrike(k * em, step));
  const later = (type: "call" | "put", K: number, at: number) => bs(type, at, K, T / 2, v);

  let legs: Leg[];
  let net: number;
  let maxProfit: number | null;
  let maxLoss: number;
  let breakevens: number[];
  let pop: number;
  let takeProfit: number[];
  let stopLoss: number[];
  let rr: number | null;

  switch (structure) {
    case "long_call":
    case "long_put": {
      const type = structure === "long_call" ? "call" : "put";
      const up = type === "call";
      const K = up ? (atm >= S ? atm : atm + step) : atm <= S ? atm : atm - step;
      const p = price(type, K);
      if (p < 0.1) return null;
      legs = [{ side: "buy", type, strike: K, price: p }];
      net = p;
      // A call's upside has no ceiling; a put's is the stock going to zero.
      maxProfit = up ? null : (K - p) * 100;
      maxLoss = p * 100;
      const be = up ? K + p : K - p;
      breakevens = [be];
      pop = up ? probAbove(S, be, T, v) : 1 - probAbove(S, be, T, v);
      const tp = up ? S + 0.8 * em : S - 0.8 * em;
      const sl = up ? S - 0.4 * em : S + 0.4 * em;
      takeProfit = [tp];
      stopLoss = [sl];
      // Reward to risk if the stock reaches either level halfway to expiry.
      const gain = later(type, K, tp) - p;
      const loss = p - later(type, K, sl);
      rr = loss > 0 ? gain / loss : null;
      break;
    }
    case "bull_call_spread":
    case "bear_put_spread": {
      const up = structure === "bull_call_spread";
      const type = up ? "call" : "put";
      const K1 = atm;
      const K2 = up ? K1 + away(1) : K1 - away(1);
      const d = nickel(price(type, K1) - price(type, K2));
      const width = Math.abs(K2 - K1);
      if (d < 0.1 || d >= width * 0.9) return null;
      legs = [
        { side: "buy", type, strike: K1, price: price(type, K1) },
        { side: "sell", type, strike: K2, price: price(type, K2) },
      ];
      net = d;
      maxProfit = (width - d) * 100;
      maxLoss = d * 100;
      const be = up ? K1 + d : K1 - d;
      breakevens = [be];
      pop = up ? probAbove(S, be, T, v) : 1 - probAbove(S, be, T, v);
      takeProfit = [K2];
      stopLoss = [up ? S - 0.4 * em : S + 0.4 * em];
      rr = maxProfit / maxLoss;
      break;
    }
    case "bull_put_spread":
    case "bear_call_spread": {
      const up = structure === "bull_put_spread";
      const type = up ? "put" : "call";
      const Ks = up ? atm - away(0.5) : atm + away(0.5);
      const width = Math.max(step, roundStrike(0.5 * em, step));
      const Kl = up ? Ks - width : Ks + width;
      const c = nickel(price(type, Ks) - price(type, Kl));
      if (c < 0.1 || c >= width * 0.8 || Kl <= 0) return null;
      legs = [
        { side: "sell", type, strike: Ks, price: price(type, Ks) },
        { side: "buy", type, strike: Kl, price: price(type, Kl) },
      ];
      net = -c;
      maxProfit = c * 100;
      maxLoss = (width - c) * 100;
      const be = up ? Ks - c : Ks + c;
      breakevens = [be];
      pop = up ? probAbove(S, be, T, v) : 1 - probAbove(S, be, T, v);
      // Take half the credit once the stock has moved a third of a move your way; wrong once it reaches the short strike.
      takeProfit = [up ? S + 0.3 * em : S - 0.3 * em];
      stopLoss = [Ks];
      rr = maxProfit / maxLoss;
      break;
    }
    case "iron_condor": {
      const width = Math.max(step, roundStrike(0.5 * em, step));
      const Kc = atm + away(1);
      const Kp = atm - away(1);
      const callCredit = price("call", Kc) - price("call", Kc + width);
      const putCredit = price("put", Kp) - price("put", Kp - width);
      const c = nickel(callCredit + putCredit);
      if (price("call", Kc) < 0.1 || price("put", Kp) < 0.1) return null;
      if (c < 0.15 || c >= width * 0.8 || Kp - width <= 0) return null;
      legs = [
        { side: "buy", type: "put", strike: Kp - width, price: price("put", Kp - width) },
        { side: "sell", type: "put", strike: Kp, price: price("put", Kp) },
        { side: "sell", type: "call", strike: Kc, price: price("call", Kc) },
        { side: "buy", type: "call", strike: Kc + width, price: price("call", Kc + width) },
      ];
      net = -c;
      maxProfit = c * 100;
      maxLoss = (width - c) * 100;
      breakevens = [Kp - c, Kc + c];
      pop = probAbove(S, Kp - c, T, v) - probAbove(S, Kc + c, T, v);
      // Profit while it stays between the short strikes; wrong once it reaches either.
      takeProfit = [];
      stopLoss = [Kp, Kc];
      rr = maxProfit / maxLoss;
      break;
    }
  }

  return {
    ticker: u.ticker,
    structure,
    bias: STRUCTURES[structure].bias,
    expiry,
    dte,
    spot: round2(S),
    vol: Math.round(v * 1000) / 1000,
    legs,
    net: round2(net),
    maxProfit: maxProfit != null ? Math.round(maxProfit) : null,
    maxLoss: Math.round(maxLoss),
    rewardRisk: rr != null && Number.isFinite(rr) ? Math.round(rr * 100) / 100 : null,
    breakevens: breakevens.map(round2),
    pop: Math.round(Math.max(0, Math.min(1, pop)) * 100) / 100,
    takeProfit: takeProfit.map(round2),
    stopLoss: stopLoss.map(round2),
    why,
  };
}

/** The plain line on a card: what the stock is doing, and what the setup is betting on. */
function whyOf(u: Underlying, b: Bias, structure: Structure, expiry: string) {
  const move = `${u.changePct >= 0 ? "up" : "down"} ${Math.abs(u.changePct).toFixed(1)}% today${u.mom5 != null ? ` and ${u.mom5 >= 0 ? "+" : ""}${u.mom5.toFixed(1)}% over 5 sessions` : ""}`;
  const bet =
    STRUCTURES[structure].kind === "condor"
      ? `betting it stays in a range through ${shortDate(expiry)}`
      : b === "bull"
        ? `betting it keeps rising into ${shortDate(expiry)}`
        : `betting it keeps falling into ${shortDate(expiry)}`;
  return `${u.ticker} is ${move}: ${bet}.`;
}

const PLANS: Record<Bias, Structure[]> = {
  bull: ["bull_call_spread", "long_call", "bull_put_spread", "iron_condor"],
  bear: ["bear_put_spread", "long_put", "bear_call_spread", "iron_condor"],
  neutral: ["iron_condor", "bull_put_spread", "bear_call_spread", "long_call"],
};
const HORIZONS = [14, 30, 7, 45];

/** A stock's cards for the deck: `count` of them (more for the most-traded names), varied in kind and expiry. */
export function cardsFor(u: Underlying, count: number, today = new Date()): Card[] {
  const b = biasOf(u);
  const out: Card[] = [];
  const plan = PLANS[b];
  for (let i = 0; out.length < count && i < plan.length * 2; i++) {
    const structure = plan[i % plan.length];
    const days = HORIZONS[(i + u.ticker.length) % HORIZONS.length];
    const { expiry } = expiryAfter(today, days);
    const card = buildCard(u, structure, days, today, whyOf(u, STRUCTURES[structure].bias, structure, expiry));
    if (card && !out.some((c) => c.structure === card.structure && c.expiry === card.expiry)) out.push(card);
  }
  return out;
}

/** Card numbers for display: "$1.85 debit" or "$0.62 credit". */
export const netLabel = (net: number) => `${usd(Math.abs(net))} ${net >= 0 ? "debit" : "credit"}`;
