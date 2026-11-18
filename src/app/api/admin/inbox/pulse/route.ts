import { rateGuard } from "@/features/inbox/platform";
import { profile } from "@/features/inbox/gmail";
import { jsonRoute } from "@/features/inbox/route-kit";

export const dynamic = "force-dynamic";

/**
 * GET: Admin → Inbox's poll, every 15 seconds while the tab is in front: the mailbox's history id alone (one unit of
 * Gmail's quota). The page reads its lists, counts and open conversation again only when it moves, so nothing redraws
 * while the mailbox is still (the board's lesson, lib/live-poll.mjs).
 */
export async function GET(request: Request) {
  const tooMany = await rateGuard(request, "/api/admin/inbox/pulse");
  if (tooMany) return tooMany;
  return jsonRoute("/api/admin/inbox/pulse", async () => ({ historyId: (await profile()).historyId }));
}
