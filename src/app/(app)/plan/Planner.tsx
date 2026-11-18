"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useState, useTransition } from "react";
import HighStrikeChart from "@/components/chart/HighStrikeChart";
import { BUTTON_PRIMARY, CARD, HINT, INPUT, LABEL } from "@/components/ui";
import type { Candle } from "@/lib/chart/types";
import type { Style } from "@/lib/ideas";
import { gradePlan, type Check } from "@/lib/planGrade";
import { STYLE_PLAN, expectedMove, optionName, planEndOf, planOption, realPlanOption, type PlanOption } from "@/lib/planner";
import { addDays } from "@/lib/marketCalendar";
import { strikeGap } from "@/lib/optionIdea";
import { roundStrike } from "@/lib/options/pricing";
import type { OptionQuote } from "@/lib/optionQuotes";
import { riskBudget, type TradingProfile } from "@/lib/tradingProfile";
import { savePlan } from "./actions";

export type Start = { side: "long" | "short"; style: Style; entry: number | null; stop: number | null; target: number | null };

const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const whole = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const num = (s: string) => {
  const n = Number(s.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : NaN;
};
const fix = (n: number) => (n >= 1000 ? n.toFixed(0) : n.toFixed(2));

const LETTER_TONE: Record<string, string> = {
  A: "bg-up/15 text-up ring-up/40",
  B: "bg-up/10 text-up ring-up/30",
  C: "bg-warn/10 text-warn ring-warn/30",
  D: "bg-down/10 text-down ring-down/30",
  F: "bg-down/15 text-down ring-down/40",
};

const seg = (on: boolean) => `flex-1 rounded-md px-3 py-1.5 text-[13px] font-medium transition ${on ? "bg-panel-3 text-ink ring-1 ring-inset ring-line-strong" : "text-ink-3 hover:text-ink"}`;

/** The planner: the inputs, the chart with the plan's levels, the size and the live grade, and Save. */
export default function Planner({
  ticker,
  userId,
  candles,
  price,
  earnings,
  profile,
  today,
  start,
}: {
  ticker: string;
  userId: string;
  candles: Candle[];
  price: number;
  earnings: string | null | undefined;
  profile: TradingProfile | null;
  today: string;
  start: Start;
}) {
  const levelsFor = (side: "long" | "short", style: Style, entry: number) => {
    const k = side === "long" ? 1 : -1;
    const s = STYLE_PLAN[style];
    return { stop: fix(entry * (1 - (k * s.stop) / 100)), target: fix(entry * (1 + (k * s.target) / 100)) };
  };
  const first = levelsFor(start.side, start.style, start.entry ?? price);
  const [side, setSide] = useState(start.side);
  const [style, setStyle] = useState<Style>(start.style);
  const [entry, setEntry] = useState(fix(start.entry ?? price));
  const [stop, setStop] = useState(start.stop ? fix(start.stop) : first.stop);
  const [target, setTarget] = useState(start.target ? fix(start.target) : first.target);
  const [hold, setHold] = useState(String(STYLE_PLAN[start.style].hold));
  // An option when one contract fits the member's rule (or there's no rule yet), else shares.
  const [instrument, setInstrument] = useState<"option" | "shares">(() => {
    const e0 = start.entry ?? price;
    const o = planOption(ticker, start.side, e0, Number(start.stop ? fix(start.stop) : first.stop), Number(start.target ? fix(start.target) : first.target), today, STYLE_PLAN[start.style].hold, candles.map((c) => c.c));
    return !profile || (o && o.premium * 100 <= riskBudget(profile)) ? "option" : "shares";
  });
  const [qty, setQty] = useState<string | null>(null);
  const [alerts, setAlerts] = useState(true);
  const [error, setError] = useState("");
  const [pending, startSave] = useTransition();

  const e = num(entry);
  const s = num(stop);
  const t = num(target);
  const h = Math.max(1, Math.min(250, Math.round(num(hold) || 1)));
  const closes = useMemo(() => candles.map((c) => c.c), [candles]);
  const estimate = useMemo(() => (e > 0 && s > 0 && t > 0 ? planOption(ticker, side, e, s, t, today, h, closes) : null), [ticker, side, e, s, t, today, h, closes]);

  // The real listed contract and its price (src/lib/optionQuotes.ts via /api/options/contract): the first expiry at least a
  // week after the plan ends, struck nearest the entry. Asked half a second after the numbers stop changing; until it
  // answers (or when there's none), the estimate stands, marked est.
  const ask =
    instrument === "option" && estimate
      ? `u=${ticker}&type=${estimate.type}&from=${addDays(planEndOf(today, h), 7)}&strike=${roundStrike(e, strikeGap(e))}`
      : null;
  const [real, setReal] = useState<{ ask: string; quote: OptionQuote | null } | null>(null);
  useEffect(() => {
    if (!ask) return;
    const ctl = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/options/contract?${ask}`, { signal: ctl.signal })
        .then((r) => (r.ok ? r.json() : { quote: null }))
        .then((j: { quote: OptionQuote | null }) => setReal({ ask, quote: j.quote }))
        .catch(() => {});
    }, 500);
    return () => {
      clearTimeout(timer);
      ctl.abort();
    };
  }, [ask]);
  const quote = real && real.ask === ask ? real.quote : null;
  const loadingReal = Boolean(ask) && (!real || real.ask !== ask);
  const option: PlanOption | null = useMemo(
    () => (quote && e > 0 && s > 0 && t > 0 ? realPlanOption(quote, s, t, today, h, closes) : estimate),
    [quote, estimate, e, s, t, today, h, closes]
  );
  const useOption = instrument === "option" && option != null;
  const budget = profile ? riskBudget(profile) : null;
  const contractCost = option ? option.premium * 100 : null;
  const perShare = Math.abs(e - s);

  // The size: what the member typed, else as many as fit their rule (at least one contract, so there's a number to grade).
  const autoQty = useOption
    ? budget && contractCost
      ? Math.max(1, Math.floor(budget / contractCost))
      : 1
    : budget && perShare > 0
      ? Math.max(1, Math.floor(budget / perShare))
      : 10;
  const quantity = qty == null ? autoQty : Math.max(0, Math.floor(num(qty) || 0));
  const sizeRisk = useOption ? quantity * (contractCost ?? 0) : quantity * perShare;
  const planEnd = planEndOf(today, h);

  const grade = useMemo(
    () =>
      gradePlan(candles, {
        side,
        entry: e,
        stop: s,
        target: t,
        holdDays: h,
        instrument: useOption ? "option" : "shares",
        sizeRisk: quantity > 0 ? sizeRisk : null,
        budget,
        earnings,
        planEnd,
        expiry: option?.expiry ?? null,
        iv: quote?.iv ?? null,
      }),
    [candles, side, e, s, t, h, useOption, quantity, sizeRisk, budget, earnings, planEnd, option?.expiry, quote?.iv]
  );

  const levels = e > 0 && s > 0 && t > 0 && !("error" in grade) ? { entry: e, stop: s, target: t, direction: side, from: today } : null;

  const restyle = (next: Style, nextSide = side) => {
    setStyle(next);
    setHold(String(STYLE_PLAN[next].hold));
    if (e > 0) {
      const l = levelsFor(nextSide, next, e);
      setStop(l.stop);
      setTarget(l.target);
    }
  };

  function save() {
    if ("error" in grade || !(e > 0)) return;
    setError("");
    startSave(async () => {
      const r = await savePlan({
        ticker,
        side,
        style,
        entry: e,
        stop: s,
        target: t,
        holdDays: h,
        option: useOption && option ? { type: option.type, strike: option.strike, expiry: option.expiry } : null,
        quantity,
        letter: grade.letter,
        score: grade.score,
        reasons: grade.checks.filter((c) => c.score != null).map((c) => `${c.name}: ${c.text}`),
        alerts,
      });
      if (r?.error) setError(r.error);
    });
  }

  return (
    <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex min-w-0 flex-col gap-6">
        <div className={`${CARD} min-w-0 p-3`}>
          <HighStrikeChart ticker={ticker} userId={userId} levels={levels} />
        </div>
        <div className="hidden xl:block">
          <GradeCard grade={grade} />
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <section className={`${CARD} p-4`}>
          <h2 className="text-[15px] font-medium text-ink">The plan</h2>
          <div className="mt-3 flex gap-1 rounded-lg bg-bg p-1">
            {(["long", "short"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => {
                  setSide(d);
                  restyle(style, d);
                }}
                className={seg(side === d)}
              >
                {d === "long" ? "Long (up)" : "Short (down)"}
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-1 rounded-lg bg-bg p-1">
            {(Object.keys(STYLE_PLAN) as Style[]).map((k) => (
              <button key={k} type="button" onClick={() => restyle(k)} className={seg(style === k)}>
                {STYLE_PLAN[k].label}
              </button>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Field label="Entry" value={entry} set={setEntry} hint={`Now ${money(price)}`} />
            <Field label="Days to hold" value={hold} set={setHold} hint={`Ends ${new Date(`${planEnd}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`} />
            <Field label="Stop" value={stop} set={setStop} hint={e > 0 && s > 0 ? `${(((s - e) / e) * 100).toFixed(1)}%` : undefined} />
            <Field label="Target" value={target} set={setTarget} hint={e > 0 && t > 0 ? `${t >= e ? "+" : ""}${(((t - e) / e) * 100).toFixed(1)}%` : undefined} />
          </div>
        </section>

        <section className={`${CARD} p-4`}>
          <h2 className="text-[15px] font-medium text-ink">Trade it with</h2>
          <div className="mt-3 flex gap-1 rounded-lg bg-bg p-1">
            <button type="button" onClick={() => (setInstrument("option"), setQty(null))} className={seg(instrument === "option")}>
              An option
            </button>
            <button type="button" onClick={() => (setInstrument("shares"), setQty(null))} className={seg(instrument === "shares")}>
              Shares
            </button>
          </div>
          {instrument === "option" && !option && <p className={`${HINT} mt-3`}>No option for this plan. Sizing it in shares.</p>}
          {useOption && option && (
            <div className="mt-3 rounded-lg bg-bg/60 p-3 text-sm">
              <p className="flex items-center justify-between gap-2">
                <span className="font-mono-nums text-ink">
                  {ticker} {optionName(option)}
                </span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${option.source === "real" ? "bg-up-soft text-up" : "bg-panel-3 text-ink-3"}`}
                  title={option.source === "real" ? "A listed contract at its real price" : "Estimated from the stock's own moves"}
                >
                  {option.source === "real" ? "real" : loadingReal ? "est. · checking…" : "est."}
                </span>
              </p>
              <p className="mt-1 text-ink-2">
                {quote ? (quote.priceKind === "mid" ? "Bid/ask mid " : `Last close (${shortDay(quote.asOf)}) `) : "est. "}
                <span className="font-mono-nums text-ink">{money(option.premium)}</span> a share, {whole(option.premium * 100)} a contract
              </p>
              {quote && (
                <p className="mt-1 font-mono-nums text-xs text-ink-3">
                  {quote.bid != null && quote.ask != null ? `bid ${money(quote.bid)} · ask ${money(quote.ask)} · ` : ""}
                  {quote.iv != null ? `IV ${Math.round(quote.iv * 100)}%` : "IV n/a"}
                  {quote.volume != null ? ` · ${quote.volume.toLocaleString("en-US")} traded` : ""}
                  {quote.openInterest != null ? ` · ${quote.openInterest.toLocaleString("en-US")} open` : ""}
                </p>
              )}
              {quote?.iv != null && e > 0 && (
                <p className="mt-1 text-xs text-ink-2">
                  Options price a move of about <span className="font-mono-nums text-ink">±{money(expectedMove(e, quote.iv, today, option.expiry))}</span> by expiry.
                </p>
              )}
              <p className="mt-1 font-mono-nums text-xs text-ink-3">
                est. at target ≈ {money(option.atTarget)} · at stop ≈ {money(option.atStop)}
              </p>
              <Payoff option={option} side={side} entry={e} stop={s} target={t} contracts={Math.max(1, quantity)} />
              {quote?.priceKind === "close" && <p className="mt-2 text-[11px] leading-relaxed text-ink-3">The last session&apos;s closing trade, not a live quote: check the bid and ask in your broker.</p>}
            </div>
          )}
          <div className="mt-4 grid grid-cols-2 items-end gap-3">
            <label className="block">
              <span className={LABEL}>{useOption ? "Contracts" : "Shares"}</span>
              <input inputMode="numeric" value={qty ?? String(autoQty)} onChange={(ev) => setQty(ev.target.value)} className={`${INPUT} font-mono-nums`} />
            </label>
            <div className="pb-2 text-right text-sm">
              <p className="text-ink-3">Risks</p>
              <p className="font-mono-nums text-ink">{quantity > 0 ? whole(sizeRisk) : "—"}</p>
            </div>
          </div>
          <p className={`${HINT} mt-2 text-xs leading-relaxed`}>
            {budget != null ? (
              <>
                Your rule: {whole(budget)} a trade ({profile!.riskPct}% of {whole(profile!.account)}).{" "}
                {useOption ? "A bought option can lose its whole cost, so that's what it risks." : "Shares risk the distance to the stop."}{" "}
                <Link href="/start" className="text-ink-2 hover:text-ink">
                  Change
                </Link>
              </>
            ) : (
              <>
                <Link href="/start" className="text-accent hover:underline">
                  Answer 3 questions
                </Link>{" "}
                so the size and its grade fit your account.
              </>
            )}
          </p>
        </section>

        {/* On narrower screens the grade comes after the inputs, right above Save. */}
        <div className="xl:hidden">
          <GradeCard grade={grade} />
        </div>

        <section className={`${CARD} p-4`}>
          <label className="flex items-center gap-2 text-sm text-ink-2">
            <input type="checkbox" checked={alerts} onChange={(ev) => setAlerts(ev.target.checked)} className="size-4 accent-[var(--color-accent)]" />
            Alert me at the target and the stop
          </label>
          <button type="button" onClick={save} disabled={pending || "error" in grade} className={`${BUTTON_PRIMARY} mt-3 w-full`}>
            {pending ? "Saving…" : "Save this plan"}
          </button>
          {error && <p className="mt-2 text-xs text-down">{error}</p>}
          <p className={`${HINT} mt-2 text-xs leading-relaxed`}>Saved plans go in Ideas, only for you, and HighStrike follows each to its target, stop or end.</p>
        </section>
      </div>
    </div>
  );
}

function Field({ label, value, set, hint }: { label: string; value: string; set: (v: string) => void; hint?: string }) {
  return (
    <label className="block">
      <span className={LABEL}>{label}</span>
      <input inputMode="decimal" value={value} onChange={(e) => set(e.target.value)} className={`${INPUT} font-mono-nums`} />
      {hint && <span className="mt-1 block font-mono-nums text-xs text-ink-3">{hint}</span>}
    </label>
  );
}

function GradeCard({ grade }: { grade: ReturnType<typeof gradePlan> }) {
  // Shown in two places (wide and narrow screens), so each copy names its own heading.
  const titleId = useId();
  if ("error" in grade) {
    return <section className={`${CARD} px-4 py-5 text-sm text-ink-2`}>{grade.error}</section>;
  }
  return (
    <section className={`${CARD} p-4`} aria-labelledby={titleId}>
      <div className="flex items-center gap-4">
        <span className={`grid size-16 shrink-0 place-items-center rounded-xl font-display text-[34px] ring-1 ring-inset ${LETTER_TONE[grade.letter]}`}>{grade.letter}</span>
        <div>
          <h2 id={titleId} className="text-[15px] font-medium text-ink">
            Plan grade <span className="font-mono-nums text-ink-3">{grade.score}/100</span>
          </h2>
          <p className="mt-0.5 text-sm text-ink-2">{grade.capped ?? SUMMARY[grade.letter]}</p>
        </div>
      </div>
      <ul className="mt-4 divide-y divide-line">
        {grade.checks.map((c) => (
          <CheckRow key={c.key} c={c} />
        ))}
      </ul>
      <p className="mt-3 text-xs leading-relaxed text-ink-3">The grade checks the plan against the stock&apos;s own history and your own rule. Education, not investment advice. Option prices are estimates.</p>
    </section>
  );
}

const SUMMARY: Record<string, string> = {
  A: "A well-built plan by every rule here.",
  B: "A solid plan with a weak spot or two below.",
  C: "Workable, but several checks are against it.",
  D: "Most checks are against this plan as it stands.",
  F: "This plan breaks the basic rules. Rework it before trading it.",
};

function CheckRow({ c }: { c: Check }) {
  const tone = c.score == null ? "bg-panel-3" : c.score >= 75 ? "bg-up" : c.score >= 45 ? "bg-warn" : "bg-down";
  return (
    <li className="flex gap-3 py-2.5">
      <span className={`mt-1.5 size-2 shrink-0 rounded-full ${tone}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline justify-between gap-2 text-sm">
          <span className="font-medium text-ink">{c.name}</span>
          <span className="font-mono-nums text-xs text-ink-3">{c.score == null ? "not scored" : `${c.score}`}</span>
        </p>
        <p className="mt-0.5 text-[13px] leading-relaxed text-ink-2">{c.text}</p>
      </div>
    </li>
  );
}

const shortDay = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** Profit or loss at expiry across stock prices, for the contracts in the plan, with the stop, entry and target marked. */
function Payoff({ option: o, side, entry, stop, target, contracts }: { option: PlanOption; side: "long" | "short"; entry: number; stop: number; target: number; contracts: number }) {
  if (!(entry > 0 && stop > 0 && target > 0)) return null;
  const W = 300;
  const H = 110;
  const pad = 6;
  const cost = o.premium * 100 * contracts;
  const breakeven = o.type === "call" ? o.strike + o.premium : o.strike - o.premium;
  const lo = Math.min(stop, target, breakeven, entry) * 0.97;
  const hi = Math.max(stop, target, breakeven, entry) * 1.03;
  const pnl = (p: number) => (Math.max(0, o.type === "call" ? p - o.strike : o.strike - p) * 100 - o.premium * 100) * contracts;
  const xs = Array.from({ length: 61 }, (_, i) => lo + ((hi - lo) * i) / 60);
  const ys = xs.map(pnl);
  const yMax = Math.max(...ys, cost * 0.25);
  const yMin = Math.min(...ys, -cost);
  const x = (p: number) => pad + ((p - lo) / (hi - lo)) * (W - pad * 2);
  const y = (v: number) => pad + ((yMax - v) / (yMax - yMin)) * (H - pad * 2);
  const line = xs.map((p, i) => `${i ? "L" : "M"}${x(p).toFixed(1)},${y(ys[i]).toFixed(1)}`).join(" ");
  const area = `${line} L${x(hi).toFixed(1)},${y(0).toFixed(1)} L${x(lo).toFixed(1)},${y(0).toFixed(1)} Z`;
  const mark = (p: number, label: string, cls: string) => (
    <g key={label}>
      <line x1={x(p)} x2={x(p)} y1={pad} y2={H - pad} className={cls} strokeDasharray="3 3" strokeWidth={1} />
      <text x={x(p)} y={H + 11} textAnchor="middle" className="fill-ink-3 text-[9px]">
        {label}
      </text>
    </g>
  );
  void side;
  return (
    <figure className="mt-3">
      <figcaption className="flex justify-between text-[11px] text-ink-3">
        <span>At expiry, {contracts} contract{contracts === 1 ? "" : "s"}</span>
        <span className="font-mono-nums">
          max loss <span className="text-down">−{whole(cost)}</span> · breakeven {money(breakeven)}
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H + 14}`} className="mt-1 w-full" role="img" aria-label={`Profit or loss at expiry: breakeven ${money(breakeven)}, most it can lose ${whole(cost)}`}>
        <defs>
          <clipPath id="payoff-up">
            <rect x={0} y={0} width={W} height={y(0)} />
          </clipPath>
          <clipPath id="payoff-down">
            <rect x={0} y={y(0)} width={W} height={H} />
          </clipPath>
        </defs>
        <path d={area} className="fill-up/15" clipPath="url(#payoff-up)" />
        <path d={area} className="fill-down/15" clipPath="url(#payoff-down)" />
        <line x1={pad} x2={W - pad} y1={y(0)} y2={y(0)} className="stroke-line-strong" strokeWidth={1} />
        {mark(stop, "stop", "stroke-down/60")}
        {mark(entry, "entry", "stroke-ink-3/60")}
        {mark(target, "target", "stroke-up/60")}
        <path d={line} fill="none" className="stroke-ink" strokeWidth={1.5} />
      </svg>
    </figure>
  );
}
