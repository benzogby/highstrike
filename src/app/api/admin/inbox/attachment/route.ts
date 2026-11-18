import { NextResponse } from "next/server";
import { rateGuard } from "@/features/inbox/platform";
import { sniff } from "@/features/inbox/platform";
import { attachmentBytes, isAttachmentId, isThreadId } from "@/features/inbox/gmail";
import { FILE_HEADERS, NO_STORE, disposition, failure, founderOnly, streamOf } from "@/features/inbox/route-kit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET ?m=<message>&a=<attachment>&n=<name>: one file from the mailbox, through this server (the browser never talks to
 * Gmail). A download by default; `inline=1` shows it in place, for a picture in a message (a sender's cid: image, a
 * thumbnail) or a PDF opened in a tab, and only when its bytes really are one. Streamed, so a file past the platform's
 * 4.5 MB response ceiling still goes through, and sandboxed by its headers, so nothing in it runs as this site.
 */
export async function GET(request: Request) {
  const tooMany = await rateGuard(request, "/api/admin/inbox/attachment");
  if (tooMany) return tooMany;
  const refused = await founderOnly();
  if (refused) return refused;
  const sp = new URL(request.url).searchParams;
  const m = sp.get("m");
  const a = sp.get("a");
  if (!isThreadId(m) || !isAttachmentId(a)) return NextResponse.json({ error: "No such file" }, { status: 400, headers: NO_STORE });
  try {
    const buf = await attachmentBytes(m, a);
    const name = (sp.get("n") ?? "").slice(0, 200) || "file";
    const image = sniff(buf);
    const pdf = buf.subarray(0, 5).toString("latin1") === "%PDF-";
    const inline = sp.get("inline") === "1" && (image || pdf);
    // A browser's PDF viewer doesn't open inside a sandboxed document, and runs nothing as this site anyway.
    const guard = inline && !image ? { "x-content-type-options": "nosniff", "cross-origin-resource-policy": "same-origin" } : FILE_HEADERS;
    return new Response(streamOf(buf), {
      headers: {
        ...guard,
        "content-type": inline ? (image ?? "application/pdf") : "application/octet-stream",
        "content-disposition": disposition(inline ? "inline" : "attachment", name),
        "content-length": String(buf.length),
        "cache-control": "private, max-age=3600",
      },
    });
  } catch (e) {
    return failure(e, "/api/admin/inbox/attachment");
  }
}
