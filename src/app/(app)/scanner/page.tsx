import type { Metadata } from "next";
import { requireMember } from "@/lib/membership";
import { readScan } from "@/lib/scan/build";
import ScannerView, { TABS, type Query, type Tab } from "./ScannerView";

export const metadata: Metadata = { title: "Scanner — HighStrike" };
export const maxDuration = 300;

/**
 * The Scanner (Ben, 2026-11-18: "Create an awesome Scanner tab now. Subtabs Heatmap, hot contracts, unusual flow, etc.
 * Make it super comprehensive… really easy to read and get contract ideas from"): about 400 of the most traded options
 * names, refreshed every 5 minutes into one kept snapshot (src/lib/scan/build.ts), drawn by ScannerView.
 */
export default async function ScannerPage({ searchParams }: { searchParams: Promise<Query> }) {
  const { profile } = await requireMember("/scanner");
  const q = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === q.tab) ? (q.tab as Tab) : "heatmap";
  const snap = await readScan().catch(() => null);
  return <ScannerView snap={snap} tab={tab} q={q} admin={Boolean(profile?.is_admin)} />;
}
