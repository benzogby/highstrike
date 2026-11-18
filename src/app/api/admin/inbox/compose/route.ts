import { NextResponse } from "next/server";
import { rateGuard } from "@/features/inbox/platform";
import { cleanZone, DEFAULT_ZONE } from "@/features/inbox/zone";
import { composeSeed, draftSeed, isDraftId, isThreadId } from "@/features/inbox/gmail";
import { NO_STORE, jsonRoute } from "@/features/inbox/route-kit";

export const dynamic = "force-dynamic";

/**
 * GET: what a message being written starts with. `?message=<id>&mode=reply|all|forward&zone=<IANA>` for Reply, Reply all
 * and Forward (the quote's date in the viewer's zone), or `?draft=<id>` to open a saved draft.
 */
export async function GET(request: Request) {
  const tooMany = await rateGuard(request, "/api/admin/inbox/compose");
  if (tooMany) return tooMany;
  const sp = new URL(request.url).searchParams;
  const draft = sp.get("draft");
  if (draft) {
    if (!isDraftId(draft)) return NextResponse.json({ error: "No such draft" }, { status: 400, headers: NO_STORE });
    return jsonRoute("/api/admin/inbox/compose", () => draftSeed(draft));
  }
  const message = sp.get("message");
  const mode = sp.get("mode");
  if (!isThreadId(message) || (mode !== "reply" && mode !== "all" && mode !== "forward")) return NextResponse.json({ error: "No such message" }, { status: 400, headers: NO_STORE });
  return jsonRoute("/api/admin/inbox/compose", () => composeSeed(message, mode, cleanZone(sp.get("zone")) ?? DEFAULT_ZONE));
}
