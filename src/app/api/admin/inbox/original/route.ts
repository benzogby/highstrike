import { NextResponse } from "next/server";
import { rateGuard } from "@/features/inbox/platform";
import { isThreadId, originalText } from "@/features/inbox/gmail";
import { FILE_HEADERS, NO_STORE, failure, founderOnly } from "@/features/inbox/route-kit";

export const dynamic = "force-dynamic";

/** GET ?id=<message>: Show original, the message as it came (its headers and every part), as plain text in a new tab. */
export async function GET(request: Request) {
  const tooMany = await rateGuard(request, "/api/admin/inbox/original");
  if (tooMany) return tooMany;
  const refused = await founderOnly();
  if (refused) return refused;
  const id = new URL(request.url).searchParams.get("id");
  if (!isThreadId(id)) return NextResponse.json({ error: "No such message" }, { status: 400, headers: NO_STORE });
  try {
    return new Response(await originalText(id), { headers: { ...FILE_HEADERS, "content-type": "text/plain; charset=utf-8", "cache-control": "private, no-store" } });
  } catch (e) {
    return failure(e, "/api/admin/inbox/original");
  }
}
