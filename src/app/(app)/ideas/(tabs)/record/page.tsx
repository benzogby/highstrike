import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/membership";
import RecordView, { type RecordRow, type RecordStats } from "./RecordView";

export const metadata: Metadata = { title: "Track record — HighStrike" };

/**
 * Ideas' Track record tab (Ben, 2026-11-03: Setups merged into Ideas; /setups redirects here): the scoreboard and every
 * idea HighStrike has published, by day, each opening its idea page. Only the house's ideas (owner_id null), the same
 * ones get_setup_stats() counts; a member's own pasted or built ideas aren't part of the record.
 * Admins only since 2026-11-17 (Ben: "Hide the record for now", docs/plans/offer-overhaul.md) while the idea rules are
 * fixed; members land on the feed.
 */
export default async function TrackRecordPage() {
  const { supabase, profile } = await requireMember("/ideas/record");
  if (!profile?.is_admin) redirect("/ideas");

  const [{ data, error }, { data: stats }] = await Promise.all([
    supabase
      .from("setups")
      .select("id, report_date, ticker, direction, headline, justification, status, current_pct, result_pct")
      .is("owner_id", null)
      .order("report_date", { ascending: false })
      .order("flow_score", { ascending: false })
      .limit(120),
    supabase.rpc("get_setup_stats"),
  ]);

  return <RecordView rows={(data ?? []) as RecordRow[]} stats={(stats as RecordStats[] | null)?.[0]} error={error?.message} />;
}
