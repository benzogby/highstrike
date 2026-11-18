import { NextResponse } from "next/server";
import { rateGuard } from "@/features/inbox/platform";
import { getThread, isThreadId } from "@/features/inbox/gmail";
import { NO_STORE, jsonRoute } from "@/features/inbox/route-kit";

export const dynamic = "force-dynamic";

/** GET ?id=: one conversation, every message with its body and files, for Admin → Inbox's reading view. */
export async function GET(request: Request) {
  const tooMany = await rateGuard(request, "/api/admin/inbox/thread");
  if (tooMany) return tooMany;
  const id = new URL(request.url).searchParams.get("id");
  if (!isThreadId(id)) return NextResponse.json({ error: "No such conversation" }, { status: 400, headers: NO_STORE });
  return jsonRoute("/api/admin/inbox/thread", () => getThread(id));
}
