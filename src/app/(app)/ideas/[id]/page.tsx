import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMember } from "@/lib/membership";
import { fetchQuotes } from "@/lib/quotes";
import { Badge, CARD } from "@/components/ui";
import { IDEA_COLUMNS, SOURCES, STATUS, STYLES, headlineOf, type Idea } from "@/lib/ideas";
import { caseFor, quickAnswers, type Signals } from "@/lib/ideaCase";
import { asOption } from "@/lib/optionIdea";
import PriceChart from "../../symbol/[ticker]/PriceChart";
import BullBear from "./BullBear";
import PositionSizer from "./PositionSizer";
import QuickAnswers from "./QuickAnswers";
import SuggestedOption from "./SuggestedOption";

export const metadata: Metadata = { title: "Idea — HighStrike" };

const DAY = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric" });
const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * One trade idea, to evaluate it (piece 2 of the trade-ideas plan, Ben 2026-11-02): what it is, its option (estimated by
 * rules from the stock's own closes, src/lib/optionIdea.ts), the chart, the bull and bear case and quick answers worked
 * out by rules from HighStrike's own data (no AI service: "Do this all without AI APIs"), and a position sizer.
 */
export default async function IdeaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireMember(`/ideas/${id}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data } = await supabase.from("setups").select(IDEA_COLUMNS).eq("id", id).maybeSingle();
  if (!data) notFound();
  const idea = data as Idea;
  const since = new Date(`${idea.report_date}T12:00:00Z`);
  since.setUTCDate(since.getUTCDate() - 30);
  const [[quote], { data: closes }, { data: trades }, { data: crowd }] = await Promise.all([
    fetchQuotes([idea.ticker]).catch(() => []),
    supabase.from("price_history").select("close").eq("ticker", idea.ticker).order("price_date", { ascending: false }).limit(15),
    supabase.from("insider_trades").select("transaction_code, value").eq("ticker", idea.ticker).gte("filed_at", since.toISOString().slice(0, 10)),
    supabase.from("chatter_stats").select("bullish, bearish, watchers").eq("ticker", idea.ticker).order("day", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const live = quote?.live ? quote : null;
  const range = live?.high != null && live?.low != null && live.high > live.low ? (live.price - live.low) / (live.high - live.low) : null;
  const tally = ((trades ?? []) as { transaction_code: "P" | "S"; value: number | null }[]).reduce(
    (t, r) => (r.transaction_code === "P" ? { ...t, buys: t.buys + 1, buyValue: t.buyValue + Number(r.value ?? 0) } : { ...t, sells: t.sells + 1, sellValue: t.sellValue + Number(r.value ?? 0) }),
    { buys: 0, buyValue: 0, sells: 0, sellValue: 0 }
  );
  const c = crowd as { bullish: number; bearish: number; watchers: number | null } | null;
  const signals: Signals = {
    price: live?.price ?? null,
    changePct: live?.changePct ?? null,
    rangePos: range,
    closes: ((closes ?? []) as { close: number }[]).map((r) => Number(r.close)).reverse(),
    insiders: tally,
    crowd: c ? { bullishPct: c.bullish + c.bearish >= 5 ? Math.round((c.bullish / (c.bullish + c.bearish)) * 100) : null, watchers: c.watchers } : null,
  };
  const read = caseFor(idea, signals);
  const option = asOption(idea.option);

  const st = STATUS[idea.status] ?? STATUS.open;
  const pct = idea.status === "open" ? idea.current_pct : idea.result_pct;
  const facts: [string, string][] = [
    ["Entry", idea.entry_price != null ? money(idea.entry_price) : "—"],
    ["Target", idea.target_price != null ? money(idea.target_price) : idea.price_target],
    ["Stop", idea.stop_price != null ? money(Number(idea.stop_price)) : idea.entry_price != null ? `${money(idea.entry_price * (idea.direction === "long" ? 0.92 : 1.08))} (8%)` : "8% against"],
    ["Time", idea.time_frame],
    ["Now", live ? `${money(live.price)} (${live.changePct >= 0 ? "+" : ""}${live.changePct.toFixed(2)}% today)` : "—"],
  ];

  return (
    <div className="flex flex-col gap-6">
      <Link href="/ideas" className="text-[13px] text-ink-3 hover:text-ink">
        ← Ideas
      </Link>

      <header className="anim-rise">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-mono-nums text-[28px] font-semibold leading-none text-ink">{idea.ticker}</h1>
          <Badge tone={idea.direction === "long" ? "up" : "down"}>{idea.direction === "long" ? "Long" : "Short"}</Badge>
          <Badge>{STYLES[idea.style] ?? idea.style}</Badge>
          <Badge tone="accent">{SOURCES[idea.source] ?? idea.source}</Badge>
          <Badge tone={st.tone}>{st.label}</Badge>
          {idea.contract && <Badge>{idea.contract}</Badge>}
          {pct != null && <span className={`font-mono-nums text-sm ${pct >= 0 ? "text-up" : "text-down"}`}>{`${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%${idea.status === "open" ? " so far" : ""}`}</span>}
        </div>
        <p className="mt-3 max-w-3xl font-display text-xl leading-snug text-ink">{headlineOf(idea)}</p>
        <p className="mt-1 text-[13px] text-ink-3">
          {idea.owner_id ? `${idea.source === "watchlist" ? "Found on your watchlist" : idea.source === "builder" ? "You built this" : "You pasted this"} on ${DAY.format(new Date(`${idea.report_date}T12:00:00Z`))}. Only you can see it.` : `Published ${DAY.format(new Date(`${idea.report_date}T12:00:00Z`))}, before the open`}
        </p>
      </header>

      <dl className={`${CARD} grid grid-cols-2 divide-line sm:grid-cols-5 sm:divide-x`}>
        {facts.map(([k, v]) => (
          <div key={k} className="px-4 py-3">
            <dt className="text-xs text-ink-3">{k}</dt>
            <dd className="mt-0.5 font-mono-nums text-[15px] text-ink">{v}</dd>
          </div>
        ))}
      </dl>

      {option && <SuggestedOption ticker={idea.ticker} option={option} />}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <section className={`${CARD} p-4`}>
            <PriceChart ticker={idea.ticker} />
          </section>
          <section className={`${CARD} grid gap-4 p-4 sm:grid-cols-2`}>
            <div>
              <h2 className="text-[15px] font-medium text-ink">Why</h2>
              <p className="mt-1 text-sm leading-relaxed text-ink-2">{idea.justification}</p>
            </div>
            <div>
              <h2 className="text-[15px] font-medium text-ink">When to get in</h2>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-ink-2">
                {idea.entry_criteria.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          </section>
          <BullBear bull={read.bull} bear={read.bear} verdict={read.verdict} />
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <QuickAnswers items={quickAnswers(idea, signals)} />
          <PositionSizer entry={live ? live.price : idea.entry_price} side={idea.direction} optionPrice={option?.premium ?? null} />
        </div>
      </div>

      <p className="text-xs leading-relaxed text-ink-3">
        Market commentary and education, not investment advice. You make every decision. The bull and bear case and the quick answers are worked out from the price, insider filings and the crowd.
        {option && " The option's prices are estimates from the stock's own past moves, not live quotes, and real prices can differ."}
      </p>
    </div>
  );
}
