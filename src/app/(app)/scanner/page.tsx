import type { Metadata } from "next";
import { requireMember } from "@/lib/membership";
import AppShell from "@/components/AppShell";
import ScannerTable from "./ScannerTable";
import { PageHeader } from "@/components/ui";

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
      <PageHeader
        className="anim-rise"
        title="Scanner"
        subtitle="The universe ranked by conviction: momentum, range strength, gaps and multi-day trend in one score."
      />
      <div className="anim-rise mt-6" style={{ "--rise-delay": "90ms" } as React.CSSProperties}>
        <ScannerTable />
      </div>
    </AppShell>
  );
}
