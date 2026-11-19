import type { Metadata } from "next";
import MemberGate, { type Gate } from "@/components/join/MemberGate";
import { lessonHref, librarySummary, moduleLabel, myProgress, outline } from "@/lib/education";
import { IDEA_COLUMNS, headlineOf, type Idea } from "@/lib/ideas";
import { asOption, optionLine } from "@/lib/optionIdea";
import { memberWatchlists, STARTERS } from "@/lib/watchlists";
import { paperState } from "@/lib/paper";
import { profileOf, riskBudget } from "@/lib/tradingProfile";
import Desk from "./desk/Desk";
import { TIMEFRAMES, type Timeframe } from "@/lib/chart/timeframes";
import { billingReady, billingState, healMembership, publishableKey, weekUsedFor } from "@/lib/billing";
import { memberContext } from "@/lib/membership";

export const metadata: Metadata = {
  title: "Trading desk — HighStrike",
};


type Query = { t?: string; tf?: string; panel?: string; trade?: string };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Query> }) {
  const { supabase, user, profile, member } = await memberContext("/dashboard");
  const q = await searchParams;

  // Not a member: the paywall, over a shell with nothing in it, and nothing read for it. A first payment that went
  // through without its browser coming back to /welcome turns access on here first. The paywall offers the $14 week,
  // $99/month for someone whose week was used or whose membership ended, or the failed $99 to pay (Ben, 2026-11-03).
  const unlocked = member || (billingReady() && (await healMembership(user).catch(() => false)));
  if (!unlocked) {
    const [state, library] = await Promise.all([billingReady() ? billingState(user, profile).catch(() => null) : null, librarySummary(supabase)]);
    const gate: Gate =
      state?.kind === "owed" ? "owed" : (state?.kind === "none" && state.ended) || (await weekUsedFor(user)) ? "full" : "new";
    return <MemberGate email={user.email ?? ""} gate={gate} publishableKey={publishableKey()} library={library} />;
  }

  // Home is the paper trading desk (Ben, 2026-11-18: "the /dashboard page become the paper trading charts and execution
  // hub"): the paper account (src/lib/paper.ts), the member's watchlist, today's ideas and the next lesson.
  const [paper, watchlists, { data: weather }, course, progress] = await Promise.all([
    paperState(user.id),
    memberWatchlists(supabase, user.id).catch(() => ({ lists: [], names: {}, trends: {} })),
    supabase.from("weather_reports").select("report_date").order("report_date", { ascending: false }).limit(1).maybeSingle(),
    outline(supabase),
    myProgress(supabase, user.id),
  ]);
  const { data: todays } = weather
    ? await supabase.from("setups").select(IDEA_COLUMNS).eq("report_date", weather.report_date).is("owner_id", null).order("flow_score", { ascending: false }).limit(6)
    : { data: [] };
  const ideas = ((todays ?? []) as Idea[]).map((i) => {
    const o = asOption(i.option);
    return { id: i.id, ticker: i.ticker, direction: i.direction, headline: headlineOf(i), option: o ? optionLine(o) : null };
  });
  const watch = [...new Set([...watchlists.lists.flatMap((l) => l.tickers), ...STARTERS])];

  // The lesson to pick up: one started and not finished, else the first not done, in library order.
  const done = course.lessons.filter((l) => progress.get(l.id)?.completedAt).length;
  const next =
    course.lessons.find((l) => (progress.get(l.id)?.positionSec ?? 0) > 0 && !progress.get(l.id)?.completedAt) ??
    course.lessons.find((l) => !progress.get(l.id)?.completedAt) ??
    null;
  const nextModule = next ? course.modules.find((m) => m.id === next.moduleId) : null;
  const lesson = next ? { href: lessonHref(next.id), title: next.title, label: nextModule ? moduleLabel(nextModule.title).eyebrow : "Trading School", done, total: course.lessons.length } : null;
  const p = profileOf(profile);

  // The view the URL asks for: ?t=NVDA&tf=4h&panel=watchlist|positions|ideas&trade=options.
  const t = (q.t ?? "").trim().toUpperCase().replace(/^\$/, "");
  const start = {
    ticker: /^[A-Z][A-Z0-9.]{0,7}$/.test(t) ? t : null,
    tf: (TIMEFRAMES as readonly string[]).includes(q.tf ?? "") ? (q.tf as Timeframe) : null,
    panel: q.panel === "watchlist" ? ("watch" as const) : q.panel === "positions" ? ("account" as const) : q.panel === "ideas" ? ("ideas" as const) : null,
    trade: q.trade === "options" ? ("options" as const) : null,
  };

  return <Desk userId={user.id} initial={paper} watch={watch} ideas={ideas} lesson={lesson} budget={p ? riskBudget(p) : null} start={start} />;
}
