import type { Metadata } from "next";
import Link from "next/link";
import { requireMember } from "@/lib/membership";
import { supabaseService } from "@/lib/stripe";
import { etToday } from "@/lib/setupEngine";
import { CARD, PageHeader } from "@/components/ui";
import { CONTEST_MIN, scoreboard, weekStandings, weekStart, type Standing } from "@/lib/options/stats";

export const metadata: Metadata = { title: "Scoreboard — HighStrike" };

const signed = (n: number) => `${n >= 0 ? "+" : "−"}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;
const DAY = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const MEDAL = ["🥇", "🥈", "🥉"];

/**
 * The scoreboard (steps 3 and 5 of the swipe app; Ben 2026-11-02: "Streaks + scoreboard", "Leaderboard contests"): this
 * week's contest by default (setups saved this week, scored so far), all time on the other tab, and last week's
 * winners, frozen when the week ended. Names, never emails.
 */
export default async function BoardPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { user } = await requireMember("/swipe/board");
  const view = (await searchParams).view === "all" ? "all" : "week";
  const db = supabaseService();
  const start = weekStart(etToday());
  const end = new Date(Date.parse(`${start}T12:00:00Z`) + 6 * 86_400_000);
  const last = new Date(Date.parse(`${start}T12:00:00Z`) - 7 * 86_400_000).toISOString().slice(0, 10);
  const [week, allTime, { data: frozen }] = await Promise.all([
    view === "week" ? weekStandings(db, start) : Promise.resolve([] as Standing[]),
    view === "all" ? scoreboard(db) : Promise.resolve([]),
    db.from("contest_weeks").select("standings").eq("week_start", last).maybeSingle(),
  ]);
  const winners = ((frozen?.standings ?? []) as Standing[]).slice(0, 3);
  const rows = view === "week" ? week.map((r) => ({ id: r.id, name: r.name, pnl: r.pnl, a: r.saved, b: r.closed ? `${Math.round((r.wins / r.closed) * 100)}%` : "—" })) : allTime.map((r) => ({ id: r.id, name: r.name, pnl: r.pnl, a: r.wins + r.losses, b: r.winRate != null ? `${r.winRate}%` : "—" }));
  const mine = rows.findIndex((r) => r.id === user.id);
  const tab = (v: "week" | "all", label: string) => (
    <Link href={v === "week" ? "/swipe/board" : "/swipe/board?view=all"} aria-current={view === v ? "page" : undefined} className={`rounded-md px-3 py-1.5 text-[13px] font-medium ${view === v ? "bg-panel-2 text-ink ring-1 ring-inset ring-line-strong" : "text-ink-3 hover:text-ink"}`}>
      {label}
    </Link>
  );

  return (
    <div className="flex flex-col gap-6">
      <Link href="/swipe" className="text-[13px] text-ink-3 hover:text-ink">
        ← Swipe
      </Link>
      <PageHeader
        title="Scoreboard"
        subtitle={
          view === "week"
            ? `This week's contest, ${DAY.format(new Date(`${start}T12:00:00Z`))} to ${DAY.format(end)}: every setup you save this week counts, one contract each, scored on estimated prices. Save at least ${CONTEST_MIN} to be ranked.`
            : "All time: the total result of each trader's saved setups once they close, one contract each, on estimated prices."
        }
        actions={<span className="text-[13px] text-ink-2">{mine >= 0 ? `You're #${mine + 1} of ${rows.length}` : view === "week" ? `Save ${CONTEST_MIN} setups this week to enter` : "You'll appear once a saved setup closes"}</span>}
      />

      {winners.length > 0 && (
        <section className={`${CARD} p-4`}>
          <h2 className="text-[15px] font-medium text-ink">Last week&apos;s winners</h2>
          <ol className="mt-3 grid gap-2 sm:grid-cols-3">
            {winners.map((w, i) => (
              <li key={w.id} className="flex items-center gap-2 rounded-lg bg-panel-2 px-3 py-2">
                <span className="text-xl">{MEDAL[i]}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-ink">{w.name}</span>
                <span className={`font-mono-nums text-sm ${w.pnl >= 0 ? "text-up" : "text-down"}`}>{signed(w.pnl)}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <nav className="flex gap-1" aria-label="Scoreboard">
        {tab("week", "This week")}
        {tab("all", "All time")}
      </nav>

      <section className={`${CARD} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs font-medium text-ink-3">
              <th className="px-4 py-2 font-medium">#</th>
              <th className="px-2 py-2 font-medium">Trader</th>
              <th className="px-2 py-2 text-right font-medium">Result</th>
              <th className="px-2 py-2 text-right font-medium">{view === "week" ? "Saved" : "Closed"}</th>
              <th className="px-4 py-2 text-right font-medium">Win rate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.slice(0, 100).map((r, i) => (
              <tr key={r.id} className={r.id === user.id ? "bg-accent-soft/40" : "hover:bg-panel-2"}>
                <td className="px-4 py-2 font-mono-nums text-ink-3">{i < 3 && view === "week" ? MEDAL[i] : i + 1}</td>
                <td className="px-2 py-2 text-ink">
                  {r.name}
                  {r.id === user.id && <span className="ml-2 text-xs text-accent-ink">You</span>}
                </td>
                <td className={`px-2 py-2 text-right font-mono-nums ${r.pnl >= 0 ? "text-up" : "text-down"}`}>{signed(r.pnl)}</td>
                <td className="px-2 py-2 text-right font-mono-nums text-ink-2">{r.a}</td>
                <td className="px-4 py-2 text-right font-mono-nums text-ink-2">{r.b}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-ink-3">
                  {view === "week" ? `Nobody has saved ${CONTEST_MIN} setups this week yet. Be the first.` : "No saved setups have closed yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
      <p className="text-xs leading-relaxed text-ink-3">Results use the same estimated option prices as the cards, not real fills. For fun and learning, not investment advice.</p>
    </div>
  );
}
