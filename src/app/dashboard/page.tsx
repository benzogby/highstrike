import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import TerminalMockup from "@/components/TerminalMockup";

export const metadata: Metadata = {
  title: "Dashboard — HighStrike",
};

export default async function DashboardPage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin?next=/dashboard");

  return (
    <main className="mx-auto max-w-5xl px-5 py-14">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs uppercase tracking-wider text-ink-3">Member dashboard</p>
          <h1 className="mt-1 font-display text-2xl font-bold sm:text-3xl">
            Welcome back
          </h1>
          <p className="mt-1 text-sm text-ink-2">
            Signed in as <span className="text-ink">{user.email}</span>
          </p>
        </div>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="rounded-lg border border-line-strong px-4 py-2 font-display text-sm font-semibold transition hover:border-accent/50 hover:text-accent"
          >
            Sign out
          </button>
        </form>
      </div>

      <div className="mt-8 rounded-2xl border border-accent/30 bg-panel px-6 py-5">
        <p className="font-display text-sm font-semibold text-accent">
          Terminal access pending
        </p>
        <p className="mt-1 text-sm leading-relaxed text-ink-2">
          Your account is active. Terminal access unlocks when your cohort opens —
          we&apos;ll email you the moment it does. Here&apos;s a preview of what
          you&apos;ll see every morning:
        </p>
      </div>

      <div className="mt-8">
        <TerminalMockup />
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Link
          href="/blog"
          className="group rounded-2xl border border-line bg-panel p-6 transition hover:border-accent/40"
        >
          <h2 className="font-display text-base font-semibold transition group-hover:text-accent">
            While you wait: the blog
          </h2>
          <p className="mt-1.5 text-sm text-ink-2">
            Expectancy, position sizing, options flow — the process behind the
            terminal.
          </p>
        </Link>
        <Link
          href="/results"
          className="group rounded-2xl border border-line bg-panel p-6 transition hover:border-accent/40"
        >
          <h2 className="font-display text-base font-semibold transition group-hover:text-accent">
            The scoreboard
          </h2>
          <p className="mt-1.5 text-sm text-ink-2">
            How the AI&apos;s published setups have performed — wins and losses
            together.
          </p>
        </Link>
      </div>
    </main>
  );
}
