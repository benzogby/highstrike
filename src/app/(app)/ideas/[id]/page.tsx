import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMember } from "@/lib/membership";
import { fetchQuotes } from "@/lib/quotes";
import { Badge, CARD } from "@/components/ui";
import { IDEA_COLUMNS, SOURCES, STATUS, STYLES, headlineOf, type Cases, type Idea } from "@/lib/ideas";
import PriceChart from "../../symbol/[ticker]/PriceChart";
import AskAI from "./AskAI";
import BullBear from "./BullBear";
import PositionSizer from "./PositionSizer";

export const metadata: Metadata = { title: "Idea — HighStrike" };

const DAY = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric" });
const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * One trade idea, to evaluate it (piece 2 of the trade-ideas plan, Ben 2026-11-02): what it is, the chart, the AI's bull
 * and bear case, a position sizer, and Ask the AI. The market's odds and the contract picker join when options data is in.
 */
export default async function IdeaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireMember(`/ideas/${id}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [{ data }, { data: chat }] = await Promise.all([
    supabase.from("setups").select(`${IDEA_COLUMNS}, cases`).eq("id", id).maybeSingle(),
    supabase.from("idea_chats").select("role, content").eq("setup_id", id).eq("user_id", user.id).order("id").limit(60),
  ]);
  if (!data) notFound();
  const idea = data as Idea & { cases: Cases | null };
  const [quote] = await fetchQuotes([idea.ticker]).catch(() => []);
  const st = STATUS[idea.status] ?? STATUS.open;
  const pct = idea.status === "open" ? idea.current_pct : idea.result_pct;
  const facts: [string, string][] = [
    ["Entry", idea.entry_price != null ? money(idea.entry_price) : "—"],
    ["Target", idea.target_price != null ? money(idea.target_price) : idea.price_target],
    ["Time", idea.time_frame],
    ["Now", quote?.live ? `${money(quote.price)} (${quote.changePct >= 0 ? "+" : ""}${quote.changePct.toFixed(2)}% today)` : "—"],
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
          {pct != null && <span className={`font-mono-nums text-sm ${pct >= 0 ? "text-up" : "text-down"}`}>{`${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%${idea.status === "open" ? " so far" : ""}`}</span>}
        </div>
        <p className="mt-3 max-w-3xl font-display text-xl leading-snug text-ink">{headlineOf(idea)}</p>
        <p className="mt-1 text-[13px] text-ink-3">Published {DAY.format(new Date(`${idea.report_date}T12:00:00Z`))}, before the open</p>
      </header>

      <dl className={`${CARD} grid grid-cols-2 divide-line sm:grid-cols-4 sm:divide-x`}>
        {facts.map(([k, v]) => (
          <div key={k} className="px-4 py-3">
            <dt className="text-xs text-ink-3">{k}</dt>
            <dd className="mt-0.5 font-mono-nums text-[15px] text-ink">{v}</dd>
          </div>
        ))}
      </dl>

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
          <BullBear id={idea.id} initial={idea.cases} />
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <AskAI id={idea.id} ticker={idea.ticker} initial={(chat ?? []) as { role: "user" | "assistant"; content: string }[]} />
          <PositionSizer entry={quote?.live ? quote.price : idea.entry_price} side={idea.direction} />
        </div>
      </div>

      <p className="text-xs leading-relaxed text-ink-3">
        Market commentary and education from HighStrike AI, not investment advice. You make every decision. The market&apos;s odds and a contract picker arrive with live options data.
      </p>
    </div>
  );
}
