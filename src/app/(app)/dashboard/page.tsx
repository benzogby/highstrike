import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { Logo } from "@/components/Header";
import { Gauge } from "@/components/TerminalMockup";
import ThemeToggle from "@/components/ThemeToggle";
import { NowDateLong, NowGreeting, NowTimeET, UpcomingFriday } from "@/components/Now";

export const metadata: Metadata = {
  title: "Dashboard — HighStrike",
};

const nav = [
  {
    label: "Home",
    active: true,
    icon: "M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3a1 1 0 001-1v-6h4v6a1 1 0 001 1h3a1 1 0 001-1V10",
  },
  {
    label: "Setups",
    icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  {
    label: "Scanner",
    icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6",
  },
  {
    label: "Watchlists",
    icon: "M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z",
  },
  {
    label: "Insider Feed",
    icon: "M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9",
  },
  {
    label: "Chatter",
    icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
  },
  {
    label: "Trading School",
    icon: "M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422A12.083 12.083 0 0121 12c0 2.21-.895 4.21-2.343 5.657L12 21l-6.657-3.343A7.962 7.962 0 013 12c0-1.192.26-2.323.727-3.339L12 14z",
  },
];

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

const watchlist = [
  { ticker: "NVDA", last: "182.90", chg: "+1.84%", up: true, flow: 91 },
  { ticker: "DELL", last: "148.22", chg: "+3.10%", up: true, flow: 87 },
  { ticker: "MCD", last: "339.45", chg: "+0.62%", up: true, flow: 84 },
  { ticker: "SMCI", last: "61.38", chg: "-1.12%", up: false, flow: 78 },
  { ticker: "XOM", last: "108.71", chg: "-0.44%", up: false, flow: 41 },
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
    .select("is_admin")
    .eq("id", user.id)
    .single();
  const isAdmin = Boolean(profile?.is_admin);

  const firstName = (user.email ?? "trader").split("@")[0];

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-line bg-panel lg:flex">
        <Link href="/" className="flex items-center gap-2.5 px-5 py-5">
          <Logo />
          <span className="font-display text-lg font-bold tracking-tight">
            highstrike
          </span>
        </Link>
        <nav className="mt-2 flex-1 space-y-1 px-3">
          {nav.map((n) => (
            <span
              key={n.label}
              className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                n.active
                  ? "bg-panel-2 font-semibold text-ink"
                  : "text-ink-2"
              }`}
            >
              <span className="flex items-center gap-3">
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={n.active ? "var(--color-accent)" : "currentColor"}
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d={n.icon} />
                </svg>
                {n.label}
              </span>
              {!n.active && (
                <span className="rounded-full border border-line px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-ink-3">
                  Soon
                </span>
              )}
            </span>
          ))}
        </nav>
        {isAdmin && (
          <div className="px-3 pb-2">
            <Link
              href="/admin"
              className="flex items-center gap-3 rounded-lg border border-accent/40 px-3 py-2 text-sm font-semibold text-accent transition hover:bg-panel-2"
            >
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Admin panel
            </Link>
          </div>
        )}
        <div className="border-t border-line p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">{firstName}</p>
              <p className="truncate text-xs text-ink-3">{user.email}</p>
            </div>
            <ThemeToggle />
          </div>
          <form action="/auth/signout" method="post" className="mt-3">
            <button
              type="submit"
              className="w-full rounded-lg border border-line-strong py-2 font-display text-xs font-semibold text-ink-2 transition hover:border-accent/50 hover:text-accent"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 lg:pl-60">
        {/* Top bar */}
        <header className="sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur">
          <div className="flex h-16 items-center justify-between gap-4 px-5 lg:px-8">
            <Link href="/" className="flex items-center gap-2 lg:hidden">
              <Logo size={24} />
              <span className="font-display text-base font-bold">highstrike</span>
            </Link>
            <div className="hidden max-w-md flex-1 lg:block">
              <div className="flex h-10 items-center gap-2.5 rounded-lg border border-line bg-panel px-3.5 text-sm text-ink-3">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                  <path d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Search tickers, setups, filings…
                <kbd className="ml-auto rounded border border-line px-1.5 font-mono-nums text-[10px]">/</kbd>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden font-mono-nums text-xs text-ink-3 sm:block">
                <NowTimeET />
              </span>
              <span className="hidden items-center gap-1.5 rounded-full border border-line bg-panel px-2.5 py-1 text-xs text-ink-2 sm:flex">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" aria-hidden="true" />
                Markets open
              </span>
              <button
                type="button"
                className="rounded-lg bg-accent px-4 py-2 font-display text-sm font-semibold text-bg transition hover:bg-accent-2"
              >
                + New watchlist
              </button>
            </div>
          </div>
        </header>

        <main className="px-5 py-8 lg:px-8">
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

              {/* Watchlist */}
              <div className="mt-8 flex items-baseline justify-between">
                <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-ink-2">
                  Watchlist
                </h2>
                <span className="text-[10px] uppercase tracking-wider text-ink-3">
                  Illustrative preview
                </span>
              </div>
              <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-panel">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-[10px] uppercase tracking-wider text-ink-3">
                      <th className="px-5 py-2.5 font-medium">Ticker</th>
                      <th className="px-3 py-2.5 text-right font-medium">Last</th>
                      <th className="px-3 py-2.5 text-right font-medium">Change</th>
                      <th className="px-5 py-2.5 text-right font-medium">Flow</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {watchlist.map((r) => (
                      <tr key={r.ticker}>
                        <td className="px-5 py-2.5 font-display font-semibold">
                          {r.ticker}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono-nums text-ink-2">
                          {r.last}
                        </td>
                        <td
                          className={`px-3 py-2.5 text-right font-mono-nums ${
                            r.up ? "text-up" : "text-down"
                          }`}
                        >
                          {r.chg}
                        </td>
                        <td className="px-5 py-2.5 text-right font-mono-nums text-ink-2">
                          {r.flow}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
        </main>
      </div>
    </div>
  );
}
