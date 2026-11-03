import type { Metadata } from "next";
import { requireMember } from "@/lib/membership";
import { alertedTickers, memberWatchlists } from "@/lib/watchlists";
import WatchlistsBoard from "./WatchlistsBoard";

export const metadata: Metadata = { title: "Watchlists — HighStrike" };

/**
 * Watchlists (Ben, 2026-11-03: "Watchlists gets its own page"; it was only a panel on Home): every list, full width.
 * Lists, names and trend lines come in one query beside the member's live alerts; prices stream in the browser.
 */
export default async function WatchlistsPage() {
  const { supabase, user } = await requireMember("/watchlists");
  const [{ lists, names, trends }, alerted] = await Promise.all([
    memberWatchlists(supabase, user.id, { start: true }),
    alertedTickers(supabase, user.id),
  ]);
  return <WatchlistsBoard lists={lists} names={names} trends={trends} alerted={alerted} />;
}
