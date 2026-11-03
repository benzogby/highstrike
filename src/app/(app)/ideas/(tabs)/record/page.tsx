import type { Metadata } from "next";
import Link from "next/link";
import { requireMember } from "@/lib/membership";
import { Badge, CARD } from "@/components/ui";
import { STATUS, headlineOf, type Idea } from "@/lib/ideas";

export const metadata: Metadata = { title: "Track record — HighStrike" };

type Row = Pick<Idea, "id" | "report_date" | "ticker" | "direction" | "headline" | "justification" | "status" | "current_pct" | "result_pct">;
type Stats = { closed_count: number; open_count: number; win_rate: number | null; avg_gain: number | null; avg_loss: number | null };

const DAY = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric" });
const pctText = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;

/**
 * Ideas' Track record tab (Ben, 2026-11-03: Setups merged into Ideas; /setups redirects here): the scoreboard and every
 * idea HighStrike has published, by day, each opening its idea page. Only the house's ideas (owner_id null), the same
 * ones get_setup_stats() counts; a member's own pasted or built ideas aren't part of the record.
 */
export default async function TrackRecordPage() {
  const { supabase } = await requireMember("/ideas/record");

  const [{ data, error }, { data: statsRows }] = await Promise.all([
    supabase
      .from("setups")
      .select("id, report_date, ticker, direction, headline, justification, status, current_pct, result_pct")
      .is("owner_id", null)
      .order("report_date", { ascending: false })
      .order("flow_score", { ascending: false })
      .limit(120),
    supabase.rpc("get_setup_stats"),
  ]);
  const rows = (data ?? []) as Row[];
  const stats = (statsRows as Stats[] | null)?.[0];

  const byDay = new Map<string, Row[]>();
  for (const r of rows) byDay.set(r.report_date, [...(byDay.get(r.report_date) ?? []), r]);

  const tiles = [
    { label: "Open ideas", value: stats ? String(stats.open_count) : "—" },
    { label: "Closed ideas", value: stats ? String(stats.closed_count) : "—" },
    { label: "Win rate", value: stats?.win_rate != null ? `${stats.win_rate}%` : "—" },
    {
      label: "Avg gain / loss",
      value:
        stats?.avg_gain != null || stats?.avg_loss != null
          ? `${stats?.avg_gain != null ? `+${stats.avg_gain}%` : "—"} / ${stats?.avg_loss != null ? `${stats.avg_loss}%` : "—"}`
          : "—",
    },
  ];

  return (
    <>
      <p className="mt-5 text-sm text-ink-2">Every idea HighStrike has published, graded automatically: wins and losses together.</p>

      <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="bg-panel px-4 py-3.5">
            <p className="text-[13px] text-ink-3">{t.label}</p>
            <p className="mt-1 font-display text-2xl leading-none text-ink">{t.value}</p>
          </div>
        ))}
      </div>

      {error && <p className="mt-6 rounded-lg border border-down/30 bg-down-soft px-3 py-2 text-sm text-down">The track record couldn&apos;t load: {error.message}</p>}
      {!error && rows.length === 0 && (
        <p className={`${CARD} mt-8 px-5 py-10 text-center text-sm text-ink-3`}>No ideas published yet. The first batch lands before the next open.</p>
      )}

      {[...byDay.entries()].map(([day, list]) => (
        <section key={day} className="mt-8">
          <h2 className="text-sm font-medium text-ink">
            {DAY.format(new Date(`${day}T12:00:00Z`))} <span className="text-ink-3">· {list.length} {list.length === 1 ? "idea" : "ideas"}</span>
          </h2>
          <ul className={`${CARD} mt-3 divide-y divide-line`}>
            {list.map((r) => {
              const st = STATUS[r.status] ?? STATUS.open;
              const pct = r.status === "open" ? r.current_pct : r.result_pct;
              return (
                <li key={r.id}>
                  <Link
                    href={`/ideas/${r.id}`}
                    className="group flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 transition-colors hover:bg-panel-2 sm:flex-nowrap"
                  >
                    <span className="flex w-28 shrink-0 items-center gap-2">
                      <span className="font-mono-nums text-[15px] font-semibold text-ink">{r.ticker}</span>
                      <Badge tone={r.direction === "long" ? "up" : "down"}>{r.direction === "long" ? "Long" : "Short"}</Badge>
                    </span>
                    <span className="order-last min-w-0 basis-full text-sm text-ink-2 group-hover:text-ink sm:order-none sm:flex-1 sm:basis-auto sm:truncate">
                      {headlineOf(r)}
                    </span>
                    <span className="ml-auto flex shrink-0 items-center gap-2.5">
                      {pct != null && (
                        <span className={`font-mono-nums text-[13px] ${pct >= 0 ? "text-up" : "text-down"}`}>
                          {pctText(Number(pct))}
                          {r.status === "open" && <span className="text-ink-3"> so far</span>}
                        </span>
                      )}
                      <Badge tone={st.tone}>{st.label}</Badge>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-ink-3 transition group-hover:text-ink max-sm:hidden">
                        <path d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <p className="mt-10 text-xs leading-relaxed text-ink-3">
        Each idea is followed from its entry price to its target, a stop (an 8% move against it) or its expiry, using end-of-day prices. Market commentary, not investment advice.
      </p>
    </>
  );
}
