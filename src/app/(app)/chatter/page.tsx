import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "Chatter — HighStrike",
};

export default async function ChatterPage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin?next=/chatter");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, name, avatar_url")
    .eq("id", user.id)
    .single();

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
    <AppShell
      email={user.email ?? ""}
      isAdmin={Boolean(profile?.is_admin)}
      active="chatter"
      displayName={profile?.name}
      avatarUrl={profile?.avatar_url}
    >
      <div className="anim-rise flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs uppercase tracking-wider text-ink-3">
            Chatter Engine{dayLabel ? ` — ${dayLabel}` : ""}
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold sm:text-3xl">
            Where the crowd is loudest
          </h1>
        </div>
        <p className="text-xs text-ink-3">
          Crowd metrics from public StockTwits streams, refreshed nightly.
        </p>
      </div>

      <div className="anim-rise mt-6 overflow-x-auto rounded-2xl border border-line bg-panel" style={{ "--rise-delay": "90ms" } as React.CSSProperties}>
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-[10px] uppercase tracking-wider text-ink-3">
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
                      className="font-display font-semibold transition hover:text-accent"
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
    </AppShell>
  );
}
