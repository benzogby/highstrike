import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/membership";
import { CARD, INPUT, PageHeader, Badge } from "@/components/ui";
import { getCandles } from "@/lib/candles";
import { fetchQuotes } from "@/lib/quotes";
import { nextEarnings } from "@/lib/earnings";
import { etToday } from "@/lib/setupEngine";
import { profileOf } from "@/lib/tradingProfile";
import { IDEA_COLUMNS, STYLES, headlineOf, ideasSince, type Idea, type Style } from "@/lib/ideas";
import Planner, { type Start } from "./Planner";

export const metadata: Metadata = { title: "Trade Planner — HighStrike" };

type Query = { t?: string; side?: string; style?: string; e?: string; s?: string; tg?: string };

const TICKER = /^[A-Z][A-Z0-9.]{0,7}$/;
const num = (x?: string) => {
  const n = Number(x);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * The Trade Planner (docs/plans/offer-overhaul.md item 4): pick a stock, set the side, entry, stop and target on our chart,
 * choose an option or shares sized for the member's account, and get an A–F grade with the reason for every check
 * (src/lib/planGrade.ts). Saving makes it one of their own ideas, followed to its target, stop or end like every idea.
 * An idea's page opens it here with its numbers (?t=&side=&style=&e=&s=&tg=).
 */
export default async function PlanPage({ searchParams }: { searchParams: Promise<Query> }) {
  const { supabase, user, profile } = await requireMember("/plan");
  const q = await searchParams;
  const raw = (q.t ?? "").trim().toUpperCase().replace(/^\$/, "");
  if (raw && raw !== q.t) redirect(`/plan?t=${encodeURIComponent(raw)}`);
  const ticker = TICKER.test(raw) ? raw : null;

  if (!ticker) {
    const [{ data: mine }, { data: today }] = await Promise.all([
      supabase.from("setups").select(IDEA_COLUMNS).eq("owner_id", user.id).eq("source", "planner").order("created_at", { ascending: false }).limit(12),
      supabase.from("setups").select("ticker").is("owner_id", null).eq("status", "open").gte("report_date", ideasSince(3)).order("flow_score", { ascending: false }).limit(12),
    ]);
    const plans = (mine ?? []) as Idea[];
    const picks = [...new Set(((today ?? []) as { ticker: string }[]).map((r) => r.ticker))].slice(0, 8);
    return (
      <>
        <PageHeader title="Trade Planner" subtitle="Plan a trade on the chart, size it for your account, and get it graded A to F, with the reason for every check." />
        <form action="/plan" className="mt-8 flex max-w-md gap-2">
          <input name="t" autoFocus placeholder="Ticker, like AAPL" aria-label="Ticker" className={`${INPUT} font-mono-nums uppercase`} />
          <button type="submit" className="h-9 shrink-0 rounded-lg bg-accent px-4 text-sm font-medium text-on-accent transition hover:bg-accent-2">
            Plan it
          </button>
        </form>
        {raw && <p className="mt-2 text-sm text-down">&ldquo;{raw}&rdquo; isn&apos;t a ticker. Try letters only, like MSFT.</p>}
        {picks.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-[13px]">
            <span className="text-ink-3">In today&apos;s ideas:</span>
            {picks.map((t) => (
              <Link key={t} href={`/plan?t=${t}`} className="rounded-md border border-line bg-panel px-2 py-1 font-mono-nums text-ink-2 transition hover:border-line-strong hover:text-ink">
                {t}
              </Link>
            ))}
          </div>
        )}
        <section className="mt-10 max-w-3xl">
          <h2 className="font-display text-[15px] text-ink">Your plans</h2>
          {plans.length === 0 ? (
            <p className={`${CARD} mt-3 px-5 py-8 text-center text-sm text-ink-3`}>Plans you save show here, and HighStrike follows each one to its target, stop or end.</p>
          ) : (
            <ul className={`${CARD} mt-3 divide-y divide-line`}>
              {plans.map((i) => {
                const pct = i.status === "open" ? i.current_pct : i.result_pct;
                return (
                  <li key={i.id}>
                    <Link href={`/ideas/${i.id}`} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-panel-2">
                      <span className="w-14 font-mono-nums font-semibold text-ink">{i.ticker}</span>
                      <Badge tone={i.direction === "long" ? "up" : "down"}>{i.direction === "long" ? "Long" : "Short"}</Badge>
                      <span className="min-w-0 flex-1 truncate text-ink-2">{headlineOf(i)}</span>
                      {pct != null && <span className={`font-mono-nums text-xs ${pct >= 0 ? "text-up" : "text-down"}`}>{`${pct >= 0 ? "+" : ""}${Number(pct).toFixed(1)}%`}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <p className="mt-10 max-w-3xl text-xs leading-relaxed text-ink-3">The grade checks a plan against the stock&apos;s own history and your own risk rule. It&apos;s education, not investment advice: you make every decision.</p>
      </>
    );
  }

  const [set, [quote], earnings] = await Promise.all([getCandles(ticker), fetchQuotes([ticker]).catch(() => []), nextEarnings(ticker)]);
  const candles = set.candles;
  const price = quote?.live ? quote.price : (candles.at(-1)?.c ?? null);
  const style: Style = q.style && q.style in STYLES ? (q.style as Style) : (profileOf(profile)?.style ?? "swing");
  const start: Start = {
    side: q.side === "short" ? "short" : "long",
    style,
    entry: num(q.e),
    stop: num(q.s),
    target: num(q.tg),
  };

  return (
    <>
      <PageHeader
        title={`Plan ${ticker}`}
        subtitle="Set the side, entry, stop and target; size it; read the grade. Every check says why."
        actions={
          <form action="/plan" className="w-40">
            <input name="t" placeholder="Another ticker" aria-label="Another ticker" className={`${INPUT} font-mono-nums uppercase`} />
          </form>
        }
      />
      {candles.length < 30 || price == null ? (
        <p className={`${CARD} mt-8 px-5 py-10 text-center text-sm text-ink-3`}>
          {ticker} has no price history to plan with right now. Check the ticker, or try again in a minute.
        </p>
      ) : (
        <Planner
          key={`${ticker}-${start.side}-${start.style}-${start.entry}-${start.stop}-${start.target}`}
          ticker={ticker}
          userId={user.id}
          candles={candles}
          price={price}
          earnings={earnings}
          profile={profileOf(profile)}
          today={etToday()}
          start={start}
        />
      )}
    </>
  );
}
