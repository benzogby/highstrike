import { Bone, TableBones } from "@/components/Skeleton";
import { viewer } from "@/lib/membership";
import { memberWatchlists } from "@/lib/watchlists";
import WatchlistCompact from "./WatchlistCompact";

/**
 * Home's watchlist, compact (Ben, 2026-11-03: Watchlists has its own page now; Home keeps a short version with an "All
 * watchlists" link): read on the server and streamed in under its own placeholder, so Home never waits for it.
 */
export default async function WatchlistPanel() {
  const v = await viewer();
  if (!v) return null;
  const { lists, names, trends } = await memberWatchlists(v.supabase, v.user.id);
  return <WatchlistCompact lists={lists} names={names} trends={trends} />;
}

/** The panel's place while it loads: its title, then a few rows. */
export function WatchlistPanelBones() {
  return (
    <div className="mt-8" role="status" aria-label="Loading your watchlist">
      <Bone className="h-4 w-24" />
      <div className="mt-3">
        <TableBones rows={4} cols={4} />
      </div>
    </div>
  );
}
