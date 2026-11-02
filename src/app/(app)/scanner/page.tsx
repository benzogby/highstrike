import type { Metadata } from "next";
import { requireMember } from "@/lib/membership";
import AppShell from "@/components/AppShell";
import ScannerTable from "./ScannerTable";

export const metadata: Metadata = {
  title: "Scanner — HighStrike",
};

export default async function ScannerPage() {
  const { user, profile } = await requireMember("/scanner");

  return (
    <AppShell
      email={user.email ?? ""}
      isAdmin={Boolean(profile?.is_admin)}
      active="scanner"
      displayName={profile?.name}
      avatarUrl={profile?.avatar_url}
    >
      <div className="anim-rise flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs uppercase tracking-wider text-ink-3">Flow Scanner</p>
          <h1 className="mt-1 font-display text-2xl font-bold sm:text-3xl">
            The universe, ranked by conviction
          </h1>
        </div>
        <p className="text-xs text-ink-3">
          Momentum, range strength, gaps, and multi-day trend in one score.
        </p>
      </div>
      <div className="anim-rise mt-6" style={{ "--rise-delay": "90ms" } as React.CSSProperties}>
        <ScannerTable />
      </div>
    </AppShell>
  );
}
