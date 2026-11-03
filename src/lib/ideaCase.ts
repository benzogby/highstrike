import type { Idea } from "@/lib/ideas";
import { asOption, contractShort, costOf, dayLabel, dollars } from "@/lib/optionIdea";

// The idea page's read on an idea, worked out from HighStrike's own data with plain rules, no AI service (Ben,
// 2026-11-02: "We're not adding an anthropic key, or any key for now. Do this all without AI APIs"): the bull case and
// the bear case, and quick answers to the questions traders ask most. Pure functions; the page loads the signals.

export type Signals = {
  /** The latest price and today's move, when a live quote came back. */
  price: number | null;
  changePct: number | null;
  /** Where today's price sits in the day's range, 0 (low) to 1 (high). */
  rangePos: number | null;
  /** Recent daily closes, oldest first. */
  closes: number[];
  /** Form 4 insider trades in this stock over the last 30 days. */
  insiders: { buys: number; buyValue: number; sells: number; sellValue: number };
  /** The crowd's latest lean (StockTwits), when enough messages were labeled. */
  crowd: { bullishPct: number | null; watchers: number | null } | null;
};

/** The stop the grading uses: an 8% move against the idea from its entry (src/lib/setupEngine.ts, STOP_PCT). */
export const STOP_PCT = 8;

const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const big = (n: number) => (n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${Math.round(n / 1e3)}K` : usd(n));
const signed = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;

/** The numbers every rule reads: entry, target, stop, the price now, and the distances between them. */
export function levels(i: Idea, s: Signals) {
  const long = i.direction === "long";
  const entry = i.entry_price ?? s.price;
  const target = i.target_price;
  const stop = i.stop_price != null ? Number(i.stop_price) : entry != null ? +(entry * (long ? 1 - STOP_PCT / 100 : 1 + STOP_PCT / 100)).toFixed(2) : null;
  const now = s.price ?? entry;
  const toTarget = now != null && target != null ? ((target - now) / now) * 100 * (long ? 1 : -1) : null;
  const toStop = now != null && stop != null ? ((now - stop) / now) * 100 * (long ? 1 : -1) : null;
  const reward = toTarget != null && toStop != null && toStop > 0 ? toTarget / toStop : null;
  const trend = s.closes.length >= 6 ? ((s.closes[s.closes.length - 1] - s.closes[s.closes.length - 6]) / s.closes[s.closes.length - 6]) * 100 : null;
  return { long, entry, target, stop, now, toTarget, toStop, reward, trend };
}

/** The bull case and the bear case: every rule that fires lands on one side or the other, then a one-line verdict. */
export function caseFor(i: Idea, s: Signals) {
  const L = levels(i, s);
  const bull: string[] = [];
  const bear: string[] = [];
  const side = (good: boolean, yes: string, no: string) => (good ? bull.push(yes) : bear.push(no));

  if (L.trend != null && Math.abs(L.trend) >= 1) {
    const withIt = L.long ? L.trend > 0 : L.trend < 0;
    side(withIt, `${signed(L.trend)} over the last 5 sessions: the trend is going your way.`, `${signed(L.trend)} over the last 5 sessions: you're trading against the trend.`);
  }
  if (s.changePct != null && Math.abs(s.changePct) >= 0.5) {
    const withIt = L.long ? s.changePct > 0 : s.changePct < 0;
    side(withIt, `${signed(s.changePct)} today, moving the right way.`, `${signed(s.changePct)} today, moving the wrong way.`);
  }
  if (s.rangePos != null) {
    if (L.long ? s.rangePos >= 0.7 : s.rangePos <= 0.3) bull.push(`Trading near the day's ${L.long ? "high: buyers" : "low: sellers"} are in control.`);
    else if (L.long ? s.rangePos <= 0.3 : s.rangePos >= 0.7) bear.push(`Trading near the day's ${L.long ? "low" : "high"}: the day's flow is against it.`);
  }
  if (L.reward != null) {
    if (L.reward >= 1.5) bull.push(`The target is ${L.reward.toFixed(1)}× as far as the stop: good reward for the risk.`);
    else if (L.reward < 1) bear.push(`The target is closer than the stop (${L.reward.toFixed(1)}×): you risk more than you stand to make.`);
  }
  if (L.toTarget != null && L.toTarget <= 0) bear.push("Price is already past the target: most of the move has happened.");
  if (L.toStop != null && L.toStop > 0 && L.toStop < 2) bear.push(`Only ${L.toStop.toFixed(1)}% from the stop: little room for error.`);
  if (i.status === "open" && i.current_pct != null && Math.abs(i.current_pct) >= 1) {
    side(i.current_pct > 0, `Already ${signed(i.current_pct)} since it was published.`, `${signed(i.current_pct)} since it was published: it hasn't worked yet.`);
  }
  const ins = s.insiders;
  if (ins.buys > 0 || ins.sells > 0) {
    if (ins.buys >= 2 || (ins.buys > 0 && ins.buyValue > ins.sellValue)) {
      side(L.long, `Insiders bought ${ins.buys} time${ins.buys === 1 ? "" : "s"} in 30 days (${big(ins.buyValue)}): the people who know the company are buying.`, `Insiders bought ${ins.buys} time${ins.buys === 1 ? "" : "s"} in 30 days (${big(ins.buyValue)}), against a short.`);
    } else if (ins.sellValue >= 1e6 || ins.sells >= 3) {
      side(!L.long, `Insiders sold ${big(ins.sellValue)} in 30 days, in the short's favor.`, `Insiders sold ${big(ins.sellValue)} in 30 days. Often routine, but it's not a vote of confidence.`);
    }
  }
  const lean = s.crowd?.bullishPct;
  if (lean != null) {
    if (lean >= 65) side(L.long, `The crowd leans ${lean}% bullish, so momentum buyers are on board.`, `The crowd is ${lean}% bullish: a crowded long can squeeze a short.`);
    else if (lean <= 35) side(!L.long, `The crowd is only ${lean}% bullish, which fits a short.`, `The crowd is only ${lean}% bullish: sentiment is against a long.`);
  }
  if (bull.length === 0) bull.push(`The scanner ranked ${i.ticker} for a ${i.direction} on its signals that morning: ${i.justification.split(/(?<=\.)\s/)[0]}`);
  if (bear.length === 0) bear.push(`Any setup can fail: a close ${L.long ? "below" : "above"} ${L.stop != null ? usd(L.stop) : "the stop"} ends it.`);

  const lead = bull.length - bear.length;
  const verdict =
    lead >= 2 ? "The evidence leans in this idea's favor." : lead <= -2 ? "The evidence leans against this idea right now." : "The evidence is mixed: let the entry rules decide, and size small.";
  return { bull: bull.slice(0, 4), bear: bear.slice(0, 4), verdict };
}

/** Rounded calendar weeks from a time frame like "3-5 days", "2-4 weeks" or "Today". */
function horizonDays(frame: string) {
  const f = frame.toLowerCase();
  if (/today|intraday/.test(f)) return 1;
  const nums = (f.match(/\d+/g) ?? []).map(Number);
  const top = nums.length ? Math.max(...nums) : 5;
  return /week/.test(f) ? top * 7 : /month/.test(f) ? top * 30 : top;
}

/** The questions traders ask about an idea, answered from its numbers (in place of a chat, while there's no AI). */
export function quickAnswers(i: Idea, s: Signals, today = new Date()) {
  const L = levels(i, s);
  const days = horizonDays(i.time_frame);
  const expiry = new Date(today.getTime() + Math.max(14, days * 2) * 86_400_000);
  // Options listed on Fridays: the first Friday on or after the date.
  expiry.setUTCDate(expiry.getUTCDate() + ((5 - expiry.getUTCDay() + 7) % 7));
  const exp = expiry.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const kind = L.long ? "calls" : "puts";
  const strike = L.now != null ? usd(L.now) : "the current price";
  const o = asOption(i.option);
  const fits = o
    ? `${o.pick === "yours" ? "The contract you named" : "The suggested option above"}: the ${contractShort(o)} (est. ${usd(o.premium)} a share, ${dollars(costOf(o))} a contract). ${
        o.short != null
          ? `It's a spread because the ${L.long ? "call" : "put"} alone would cost over 5% of the stock's price; it gains up to the target for less. `
          : o.pick === "rules"
            ? "At or just in the money, it needs less of a move to pay than a cheaper out-of-the-money one. "
            : ""
      }${o.pick === "rules" ? `It expires ${dayLabel(o.expiry, o.asOf)}, a week or more after the idea's window, so time decay doesn't eat the trade while it works. ` : ""}Avoid cheap far-out-of-the-money ${kind}: they need a bigger move than the target.`
    : `${L.long ? "Calls" : "Puts"} at or one strike ${L.long ? "below" : "above"} ${strike} (at or slightly in the money), expiring around ${exp} or later. That's at least twice the idea's ${i.time_frame.toLowerCase()} window, so time decay doesn't eat the trade while it works. Avoid cheap far-out-of-the-money ${kind}: they need a bigger move than the target.`;
  return [
    {
      q: "What would make this idea wrong?",
      a: `A close ${L.long ? "below" : "above"} ${L.stop != null ? usd(L.stop) : "the stop"} (${i.stop_price != null ? "its stop" : `${STOP_PCT}% against the entry`}) ends it. So does the entry rule failing: "${i.entry_criteria[0] ?? "the trigger"}". If it hasn't reached ${L.target != null ? usd(L.target) : i.price_target} within ${i.time_frame.toLowerCase()}, the idea has run out of time.`,
    },
    {
      q: "Which strike and expiry fit this?",
      a: fits,
    },
    {
      q: "What if it gaps against me at the open?",
      a: `If it opens past ${L.stop != null ? usd(L.stop) : "the stop"}, the idea is off: take the loss at the open rather than hoping. Size so that a move all the way to the stop costs no more than you chose to risk (the sizer below does the math). Bought options cap the loss at what you paid.`,
    },
    {
      q: "How much room is left?",
      a:
        L.toTarget != null && L.toStop != null
          ? `From ${usd(L.now!)}, the target is ${L.toTarget.toFixed(1)}% away and the stop ${L.toStop.toFixed(1)}%${L.reward != null ? `, a ${L.reward.toFixed(1)} to 1 reward for the risk` : ""}.`
          : "There isn't a live price right now to measure from.",
    },
  ];
}
