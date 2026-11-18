import { rateGuard } from "@/features/inbox/platform";
import { inboxMeta } from "@/features/inbox/gmail";
import { jsonRoute } from "@/features/inbox/route-kit";

export const dynamic = "force-dynamic";

/** GET: Admin → Inbox's left rail: the labels with their counts, the addresses with theirs, and who mail goes out as. */
export async function GET(request: Request) {
  const tooMany = await rateGuard(request, "/api/admin/inbox/meta");
  if (tooMany) return tooMany;
  return jsonRoute("/api/admin/inbox/meta", () => inboxMeta());
}
