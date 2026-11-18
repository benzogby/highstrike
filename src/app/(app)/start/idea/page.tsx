import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/membership";
import { Badge, BUTTON_SECONDARY, CARD } from "@/components/ui";
import { IDEA_COLUMNS, STYLES, headlineOf, ideasSince, type Idea } from "@/lib/ideas";
import { optionLine } from "@/lib/optionIdea";
import { pickFor, profileOf, usd, type Sizing, type TradingProfile } from "@/lib/tradingProfile";
import HighStrikeChart from "@/components/chart/HighStrikeChart";
import AlertMe from "./AlertMe";

export const metadata: Metadata = { title: "Your first idea — HighStrike" };

const DAY = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric" });
const price = (n: number | null) => (n == null ? "—" : `$${n.toFixed(2)}`);

/**
 * Today's best idea for the member's three answers (src/lib/tradingProfile.ts pickFor): on our chart with its levels,
 * sized by their rule, the reasons it was picked, and one tap for alerts at the target and the stop.
 */
export default async function FirstIdeaPage() {
  const { supabase, user } = await requireMember("/start/idea");
  const [{ data: prof }, { data: rows }] = await Promise.all([
    supabase.from("profiles").select("account_size, risk_pct, trade_style").eq("id", user.id).maybeSingle(),
    supabase.from("setups").select(`${IDEA_COLUMNS}, flow_score`).is("owner_id", null).eq("status", "open").gte("report_date", ideasSince(7)).limit(200),
  ]);
  const p = profileOf(prof);
  if (!p) redirect("/start");
  const ideas = (rows ?? []) as (Idea & { flow_score: number | null })[];
  const { pick, more, styleMatched } = pickFor(ideas, p);
  const pool = pick ? pick.pool : 0;

  if (!pick) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <h1 className="font-display text-[26px] text-ink">No open ideas right now</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-2">The next batch lands before the open (8:30 AM ET), sized for your {usd(p.account)} account the moment it does.</p>
        <Link href="/dashboard" className={`${BUTTON_SECONDARY} mt-6`}>
          Go to the dashboard
        </Link>
      </div>
    );
  }

  const { idea, sizing } = pick;
  const long = idea.direction === "long";
  const facts: [string, string][] = [
    ["Entry", price(idea.entry_price)],
    ["Target", idea.target_price != null ? price(Number(idea.target_price)) : idea.price_target],
    ["Stop", `${price(sizing.stop)}${idea.stop_price == null ? " (8%)" : ""}`],
    ["Time", idea.time_frame],
  ];
  const why = [
    styleMatched
      ? `It's a ${STYLES[idea.style].toLowerCase()} idea, the style you picked.`
      : `There's no ${STYLES[p.style].toLowerCase()} idea open today, so this is the best of the ${STYLES[idea.style].toLowerCase()} ideas.`,
    sizing.use === "option"
      ? "Its option fits inside your risk per trade."
      : sizing.option
        ? "Its option costs more than your risk per trade, so it's sized in shares."
        : "It's sized in shares, with its stop.",
    `Published ${DAY.format(new Date(`${idea.report_date}T12:00:00Z`))} and still open, it ranks first of ${pool} open ideas on those two checks, then the newest morning, then the scanner's score (${Math.round(Number(idea.flow_score ?? 0))} of 100).`,
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="anim-rise">
        <p className="text-[13px] text-ink-3">
          Your first idea · sized for {usd(p.account)} at {p.riskPct}% a trade ·{" "}
          <Link href="/start" className="text-ink-2 underline-offset-2 hover:text-ink hover:underline">
            change
          </Link>
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="font-mono-nums text-[28px] font-semibold leading-none text-ink">{idea.ticker}</h1>
          <Badge tone={long ? "up" : "down"}>{long ? "Long" : "Short"}</Badge>
          <Badge>{STYLES[idea.style] ?? idea.style}</Badge>
        </div>
        <p className="mt-3 max-w-3xl font-display text-xl leading-snug text-ink">{headlineOf(idea)}</p>
      </header>

      <dl className={`${CARD} grid grid-cols-2 divide-line sm:grid-cols-4 sm:divide-x`}>
        {facts.map(([k, v]) => (
          <div key={k} className="px-4 py-3">
            <dt className="text-xs text-ink-3">{k}</dt>
            <dd className="mt-0.5 font-mono-nums text-[15px] text-ink">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className={`${CARD} min-w-0 p-3`}>
          <HighStrikeChart
            ticker={idea.ticker}
            userId={user.id}
            levels={idea.entry_price != null && idea.target_price != null && sizing.stop != null ? { entry: idea.entry_price, target: Number(idea.target_price), stop: sizing.stop, direction: idea.direction, from: idea.report_date } : undefined}
          />
        </div>
        <div className="flex flex-col gap-6">
          <SizedCard sizing={sizing} p={p} entry={idea.entry_price} />
          <section className={`${CARD} p-4`}>
            <h2 className="text-[15px] font-medium text-ink">Why this one</h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-4 text-sm leading-relaxed text-ink-2">
              {why.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
            <div className="mt-4 flex flex-col gap-2">
              <AlertMe userId={user.id} ticker={idea.ticker} long={long} target={idea.target_price != null ? Number(idea.target_price) : null} stop={sizing.stop} />
              <Link href={`/ideas/${idea.id}`} className={BUTTON_SECONDARY}>
                Open the full idea
              </Link>
            </div>
          </section>
        </div>
      </div>

      {more.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-ink">Also today, sized for you</h2>
          <ul className={`${CARD} mt-3 divide-y divide-line`}>
            {more.map(({ idea: i, sizing: s }) => (
              <li key={i.id}>
                <Link href={`/ideas/${i.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm hover:bg-panel-2">
                  <span className="w-14 font-mono-nums font-semibold text-ink">{i.ticker}</span>
                  <Badge tone={i.direction === "long" ? "up" : "down"}>{i.direction === "long" ? "Long" : "Short"}</Badge>
                  <span className="min-w-0 flex-1 truncate text-ink-2">{headlineOf(i)}</span>
                  <span className="font-mono-nums text-xs text-ink-3">{sizeLine(s)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <Link href="/dashboard" className="font-medium text-accent hover:underline">
          Go to the dashboard →
        </Link>
        <Link href="/ideas" className="text-ink-2 hover:text-ink">
          All of today&apos;s ideas
        </Link>
      </div>

      <p className="text-xs leading-relaxed text-ink-3">
        Market commentary and education, not investment advice: the size is your own rule worked out, and you make every decision. Option prices are estimates from the stock&apos;s own past moves, not live quotes; use the real ask in your broker.
      </p>
    </div>
  );
}

const sizeLine = (s: Sizing) =>
  s.use === "option" ? `${s.contracts} contract${s.contracts === 1 ? "" : "s"} · risks ${usd(s.risk)}` : s.shares > 0 ? `${s.shares} share${s.shares === 1 ? "" : "s"} · risks ${usd(s.risk)}` : "doesn't fit your risk";

/** The size, worked out from the member's rule, and how. */
function SizedCard({ sizing: s, p, entry }: { sizing: Sizing; p: TradingProfile; entry: number | null }) {
  return (
    <section className={`${CARD} p-4`}>
      <h2 className="text-[15px] font-medium text-ink">Sized for you</h2>
      <p className="mt-1 text-sm text-ink-2">
        Your rule: {p.riskPct}% of {usd(p.account)} is <span className="font-mono-nums text-ink">{usd(s.budget)}</span> at most on one trade.
      </p>
      {s.use === "option" && s.option ? (
        <div className="mt-3 rounded-lg bg-bg/60 p-3">
          <p className="font-mono-nums text-[22px] font-semibold text-ink">
            {s.contracts} contract{s.contracts === 1 ? "" : "s"}
          </p>
          <p className="mt-0.5 font-mono-nums text-xs text-ink-2">{optionLine(s.option)}</p>
          <p className="mt-2 text-sm text-ink-2">
            About <span className="font-mono-nums text-ink">{usd(s.risk)}</span> in all. A bought option can lose its whole cost, so that&apos;s what it risks: {usd(s.contractCost ?? 0)} a contract, as many as fit in {usd(s.budget)}.
          </p>
          {s.option.atTarget != null && (
            <p className="mt-1 text-sm text-ink-2">
              At the target it&apos;s worth about <span className="font-mono-nums text-up">{usd(s.option.atTarget * 100 * s.contracts)}</span> (est.).
            </p>
          )}
        </div>
      ) : s.shares > 0 && entry != null ? (
        <div className="mt-3 rounded-lg bg-bg/60 p-3">
          <p className="font-mono-nums text-[22px] font-semibold text-ink">
            {s.shares} share{s.shares === 1 ? "" : "s"}
          </p>
          <p className="mt-0.5 font-mono-nums text-xs text-ink-2">
            {usd(s.shares * entry)} of stock, stop at ${s.stop?.toFixed(2)}
          </p>
          <p className="mt-2 text-sm text-ink-2">
            About <span className="font-mono-nums text-ink">{usd(s.risk)}</span> lost if the stop hits.
            {s.contractCost != null &&
              ` One option contract costs about ${usd(s.contractCost)}, more than your ${usd(s.budget)}, so it doesn't fit your rule: it would at ${p.riskPct}% of a ${usd(Math.ceil((s.contractCost * 100) / p.riskPct / 500) * 500)} account.`}
          </p>
        </div>
      ) : (
        <p className="mt-3 rounded-lg bg-bg/60 p-3 text-sm text-ink-2">Even the smallest size of this one risks more than {usd(s.budget)}. Your rule says pass, and wait for one that fits.</p>
      )}
    </section>
  );
}
