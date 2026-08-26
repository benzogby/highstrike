import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "Setups — HighStrike",
};

type SetupRow = {
  report_date: string;
  ticker: string;
  direction: string;
  justification: string;
  entry_criteria: string[];
  price_target: string;
  time_frame: string;
  flow_score: number;
  status: string;
  current_pct: number | null;
  result_pct: number | null;
  entry_price: number | null;
};

const STATUS_META: Record<string, { label: string; classes: string }> = {
  open: { label: "OPEN", classes: "border border-line-strong text-ink-2" },
  target_hit: { label: "TARGET HIT", classes: "bg-accent text-bg" },
  stopped: { label: "STOPPED", classes: "bg-down/90 text-bg" },
  expired: { label: "EXPIRED", classes: "border border-line-strong text-ink-3" },
};

function dateLabel(d: string) {
  return new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default async function SetupsPage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin?next=/setups");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, name, avatar_url")
    .eq("id", user.id)
    .single();

  const [{ data: rows }, { data: statsRows }] = await Promise.all([
    supabase
      .from("setups")
      .select(
        "report_date, ticker, direction, justification, entry_criteria, price_target, time_frame, flow_score, status, current_pct, result_pct, entry_price"
      )
      .order("report_date", { ascending: false })
      .order("flow_score", { ascending: false })
      .limit(120),
    supabase.rpc("get_setup_stats"),
  ]);

  const stats = (statsRows as
    | { closed_count: number; open_count: number; win_rate: number | null; avg_gain: number | null; avg_loss: number | null }[]
    | null)?.[0];

  const byDate = new Map<string, SetupRow[]>();
  for (const r of (rows ?? []) as SetupRow[]) {
    const list = byDate.get(r.report_date) ?? [];
    list.push(r);
    byDate.set(r.report_date, list);
  }

  const tiles = [
    { label: "Open setups", value: stats ? String(stats.open_count) : "—" },
    { label: "Closed setups", value: stats ? String(stats.closed_count) : "—" },
    {
      label: "Win rate",
      value: stats?.win_rate != null ? `${stats.win_rate}%` : "—",
    },
    {
      label: "Avg gain / loss",
      value:
        stats?.avg_gain != null || stats?.avg_loss != null
          ? `${stats?.avg_gain != null ? `+${stats.avg_gain}%` : "—"} / ${stats?.avg_loss != null ? `${stats.avg_loss}%` : "—"}`
          : "—",
    },
  ];

  return (
    <AppShell
      email={user.email ?? ""}
      isAdmin={Boolean(profile?.is_admin)}
      active="setups"
      displayName={profile?.name}
      avatarUrl={profile?.avatar_url}
    >
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs uppercase tracking-wider text-ink-3">Setup Engine</p>
          <h1 className="mt-1 font-display text-2xl font-bold sm:text-3xl">
            Setup history
          </h1>
        </div>
        <p className="text-xs text-ink-3">
          Every published setup is graded automatically — wins and losses together.
        </p>
      </div>

      {/* Scoreboard */}
      <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="bg-panel px-5 py-5">
            <p className="font-display text-2xl font-bold text-accent">{t.value}</p>
            <p className="mt-0.5 text-[10px] uppercase tracking-wider text-ink-3">
              {t.label}
            </p>
          </div>
        ))}
      </div>

      {byDate.size === 0 && (
        <p className="mt-10 rounded-2xl border border-line bg-panel px-5 py-10 text-center text-sm text-ink-3">
          No setups published yet — the first batch lands before the next open.
        </p>
      )}

      {[...byDate.entries()].map(([date, list]) => (
        <section key={date} className="mt-10">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-ink-2">
            {dateLabel(date)}
          </h2>
          <div className="mt-3 grid gap-4 lg:grid-cols-3">
            {list.map((s) => {
              const meta = STATUS_META[s.status] ?? STATUS_META.open;
              const pct = s.status === "open" ? s.current_pct : s.result_pct;
              const pctUp = (pct ?? 0) >= 0;
              return (
                <div
                  key={`${date}-${s.ticker}`}
                  className="flex flex-col rounded-2xl border border-line bg-panel p-5"
                >
                  <div className="flex items-center justify-between">
                    <Link
                      href={`/symbol/${s.ticker}`}
                      className="font-display text-lg font-bold transition hover:text-accent"
                    >
                      ${s.ticker}
                    </Link>
                    <span
                      className={`rounded-full px-2 py-0.5 font-display text-[10px] font-bold ${meta.classes}`}
                    >
                      {meta.label}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-ink-3">
                    {s.direction === "long" ? "▲ Long" : "▼ Short"} · target{" "}
                    {s.price_target} · {s.time_frame}
                  </p>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-ink-2">
                    {s.justification}
                  </p>
                  <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-sm">
                    <span className="flex items-center gap-2 text-xs text-ink-3">
                      Flow
                      <span
                        className="h-1.5 w-12 overflow-hidden rounded-full bg-panel-2"
                        aria-hidden="true"
                      >
                        <span
                          className="block h-full rounded-full bg-accent"
                          style={{ width: `${s.flow_score}%` }}
                        />
                      </span>
                      <span className="font-mono-nums text-ink-2">{s.flow_score}</span>
                    </span>
                    <span
                      className={`font-mono-nums ${
                        pct == null ? "text-ink-3" : pctUp ? "text-up" : "text-down"
                      }`}
                    >
                      {pct == null
                        ? "—"
                        : `${pctUp ? "+" : ""}${pct.toFixed(2)}%${s.status === "open" ? " so far" : ""}`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <p className="mt-10 text-xs leading-relaxed text-ink-3">
        Setups are market commentary generated by HighStrike AI, not investment
        advice. Results are measured from the recorded entry price to target,
        stop (−8% adverse move), or expiry, using end-of-interval prices.
      </p>
    </AppShell>
  );
}
