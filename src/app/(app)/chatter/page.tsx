import type { Metadata } from "next";
import Link from "next/link";
import { requireMember } from "@/lib/membership";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "Chatter — HighStrike",
};

export default async function ChatterPage() {
  const { supabase, user, profile } = await requireMember("/chatter");

  const { data: latestDay } = await supabase
    .from("chatter_stats")
    .select("day")
    .order("day", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: rows } = latestDay
    ? await supabase
        .from("chatter_stats")
        .select("ticker, msgs_per_hour, bullish, bearish, watchers")
        .eq("day", latestDay.day)
        .order("msgs_per_hour", { ascending: false, nullsFirst: false })
    : { data: null };

  const dayLabel = latestDay
    ? new Date(`${latestDay.day}T12:00:00Z`).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      })
    : null;

  return (
    <>
      <PageHeader
        className="anim-rise"
        title="Chatter"
        subtitle={`Where the crowd is loudest${dayLabel ? `, ${dayLabel}` : ""}: crowd metrics from public StockTwits streams, refreshed nightly.`}
      />

      <div className="anim-rise mt-6 overflow-x-auto rounded-xl border border-line bg-panel" style={{ "--rise-delay": "90ms" } as React.CSSProperties}>
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-ink-3 font-medium">
              <th className="px-4 py-2.5 font-medium">Ticker</th>
              <th className="px-4 py-2.5 text-right font-medium">Msgs / hour</th>
              <th className="px-4 py-2.5 font-medium">Crowd lean</th>
              <th className="px-4 py-2.5 text-right font-medium">Watchers</th>
              <th className="px-4 py-2.5 text-right font-medium" aria-label="Source" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {(rows ?? []).map((r) => {
              const labeled = r.bullish + r.bearish;
              const bullPct = labeled >= 5 ? Math.round((r.bullish / labeled) * 100) : null;
              return (
                <tr key={r.ticker} className="transition hover:bg-panel-2">
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/symbol/${r.ticker}`}
                      className="font-mono-nums font-medium text-ink transition hover:text-accent"
                    >
                      {r.ticker}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono-nums text-ink">
                    {r.msgs_per_hour != null ? Number(r.msgs_per_hour).toFixed(1) : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    {bullPct != null ? (
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="h-1.5 w-20 overflow-hidden rounded-full bg-down/60"
                          aria-hidden="true"
                        >
                          <span
                            className="block h-full rounded-full bg-accent"
                            style={{ width: `${bullPct}%` }}
                          />
                        </span>
                        <span className="font-mono-nums text-xs text-ink-2">
                          {bullPct}% bullish
                        </span>
                      </span>
                    ) : (
                      <span className="text-xs text-ink-3">too few labeled posts</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono-nums text-ink-2">
                    {r.watchers != null ? Number(r.watchers).toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <a
                      href={`https://stocktwits.com/symbol/${r.ticker}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-ink-3 transition hover:text-accent"
                    >
                      stream →
                    </a>
                  </td>
                </tr>
              );
            })}
            {(rows ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-ink-3">
                  No chatter recorded yet — the first nightly sweep populates this
                  table.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-6 text-xs leading-relaxed text-ink-3">
        Metrics derived from public StockTwits symbol streams: message velocity
        over the most recent posts, author-labeled bullish/bearish counts (lean
        shown only with 5+ labeled posts), and watcher totals. Aggregates only —
        crowd noise is a sentiment signal, not investment advice.
      </p>
    </>
  );
}
