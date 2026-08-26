import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import { Gauge } from "@/components/TerminalMockup";
import { NowDateLong, NowGreeting, UpcomingFriday } from "@/components/Now";
import WatchlistPanel from "./WatchlistPanel";

export const metadata: Metadata = {
  title: "Dashboard — HighStrike",
};

const setups = [
  {
    ticker: "$MCD",
    name: "McDonald's Corp",
    direction: "Long",
    up: true,
    target: "$345.00",
    frame: "3–4 days",
    justification: "Q4 earnings momentum with confirming flow",
    flow: 84,
  },
  {
    ticker: "$NVDA",
    name: "NVIDIA Corp",
    direction: "Long",
    up: true,
    target: "$196.00",
    frame: "1–2 weeks",
    justification: "AI-infrastructure leadership, unusual call buying",
    flow: 91,
  },
  {
    ticker: "$XOM",
    name: "Exxon Mobil",
    direction: "Short",
    up: false,
    target: "$102.50",
    frame: "1 week",
    justification: "Crude weakness, relative volume fading on rallies",
    flow: 41,
  },
];

const activity = [
  { text: "Weather report published", time: "08:15 ET", accent: true },
  { text: "$NVDA setup card updated — flow score 91", time: "08:47 ET" },
  { text: "Insider cluster flagged on $DELL (3 buyers)", time: "09:02 ET" },
  { text: "$MCD entry trigger 2 of 3 armed", time: "09:20 ET" },
  { text: "Chatter spike: $SMCI mentions +180% (24h)", time: "09:41 ET" },
];

export default async function DashboardPage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin?next=/dashboard");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, name, avatar_url")
    .eq("id", user.id)
    .single();
  const isAdmin = Boolean(profile?.is_admin);

  const firstName = profile?.name || (user.email ?? "trader").split("@")[0];

  return (
    <AppShell
      email={user.email ?? ""}
      isAdmin={isAdmin}
      active="home"
      displayName={profile?.name}
      avatarUrl={profile?.avatar_url}
    >
      
          {/* Greeting */}
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs uppercase tracking-wider text-ink-3">
                <NowDateLong />
              </p>
              <h1 className="mt-1 font-display text-2xl font-bold sm:text-3xl">
                <NowGreeting />, {firstName}
              </h1>
            </div>
            <p className="rounded-full border border-accent/40 bg-panel px-3.5 py-1.5 text-xs text-ink-2">
              <span className="font-semibold text-accent">Terminal access pending</span>{" "}
              — live data unlocks with your cohort
            </p>
          </div>

          {/* Weather strip */}
          <section className="mt-8">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-ink-2">
                Today&apos;s weather report
              </h2>
              <span className="text-[10px] uppercase tracking-wider text-ink-3">
                Illustrative preview
              </span>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Gauge label="Volatility" value={82} />
              <Gauge label="Opportunity" value={55} />
              <Gauge label="Direction" value={35} />
            </div>
          </section>

          <div className="mt-10 grid gap-8 xl:grid-cols-3">
            {/* Setups */}
            <section className="xl:col-span-2">
              <div className="flex items-baseline justify-between">
                <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-ink-2">
                  Today&apos;s setups
                </h2>
                <span className="text-[10px] uppercase tracking-wider text-ink-3">
                  Illustrative preview
                </span>
              </div>
              <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {setups.map((s) => (
                  <div
                    key={s.ticker}
                    className="flex flex-col rounded-2xl border border-line bg-panel p-5 transition hover:border-accent/40"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-display text-lg font-bold">{s.ticker}</p>
                      <span
                        className={`font-mono-nums text-xs ${s.up ? "text-up" : "text-down"}`}
                      >
                        {s.up ? "▲" : "▼"} {s.direction}
                      </span>
                    </div>
                    <p className="text-xs text-ink-3">{s.name}</p>
                    <p className="mt-3 flex-1 text-xs leading-relaxed text-ink-2">
                      {s.justification}
                    </p>
                    <dl className="mt-4 space-y-1.5 border-t border-line pt-3 text-xs">
                      <div className="flex justify-between">
                        <dt className="text-ink-3">Target</dt>
                        <dd className="font-mono-nums text-accent">{s.target}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-ink-3">Time frame</dt>
                        <dd className="font-mono-nums">{s.frame}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-ink-3">Nearest expiry</dt>
                        <dd className="font-mono-nums">
                          <UpcomingFriday />
                        </dd>
                      </div>
                      <div className="flex items-center justify-between">
                        <dt className="text-ink-3">Flow score</dt>
                        <dd className="flex items-center gap-2">
                          <span className="h-1.5 w-12 overflow-hidden rounded-full bg-panel-2" aria-hidden="true">
                            <span
                              className="block h-full rounded-full bg-accent"
                              style={{ width: `${s.flow}%` }}
                            />
                          </span>
                          <span className="font-mono-nums">{s.flow}</span>
                        </dd>
                      </div>
                    </dl>
                  </div>
                ))}
              </div>

              {/* Watchlist — live */}
              <WatchlistPanel userId={user.id} />
            </section>

            {/* Right rail */}
            <section>
              <div className="flex items-baseline justify-between">
                <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-ink-2">
                  Activity
                </h2>
                <span className="text-[10px] uppercase tracking-wider text-ink-3">
                  Illustrative preview
                </span>
              </div>
              <div className="mt-3 rounded-2xl border border-line bg-panel">
                <ul className="divide-y divide-line">
                  {activity.map((a) => (
                    <li key={a.text} className="flex items-start gap-3 px-5 py-3.5">
                      <span
                        className={`mt-1.5 h-1.5 w-1.5 flex-none rounded-full ${
                          a.accent ? "bg-accent" : "bg-line-strong"
                        }`}
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <p className="text-sm text-ink">{a.text}</p>
                        <p className="mt-0.5 font-mono-nums text-xs text-ink-3">{a.time}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-6 rounded-2xl border border-line bg-panel p-6">
                <h3 className="font-display text-sm font-semibold">
                  While you wait for your cohort
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-2">
                  The blog covers the process behind every card — expectancy,
                  sizing, and how the AI reads the market each morning.
                </p>
                <div className="mt-4 flex gap-3">
                  <Link
                    href="/blog"
                    className="rounded-lg bg-accent px-4 py-2 font-display text-xs font-semibold text-bg transition hover:bg-accent-2"
                  >
                    Read the blog
                  </Link>
                  <Link
                    href="/results"
                    className="rounded-lg border border-line-strong px-4 py-2 font-display text-xs font-semibold text-ink-2 transition hover:border-accent/50 hover:text-accent"
                  >
                    Scoreboard
                  </Link>
                </div>
              </div>
            </section>
          </div>
    </AppShell>
  );
}
