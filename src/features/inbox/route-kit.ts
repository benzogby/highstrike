import "server-only";
import { NextResponse } from "next/server";
import { adminRefusal, captureError } from "@/features/inbox/platform";
import { inboxErrorText } from "./gmail";

/**
 * What every /api/admin/inbox route does after its own rate limit (scripts/check-routes.mjs wants rateGuard in each
 * file): HighStrike's admins alone (anybody else gets a 404), never cached,
 * and a failure answered in words the page can show, with a reason when Gmail isn't connected.
 */
export const NO_STORE = { "cache-control": "private, no-store" };

export async function founderOnly(): Promise<Response | null> {
  return adminRefusal();
}

/** Headers for a file or picture served from the mailbox: never run as a page of this site, never second-guessed. */
export const FILE_HEADERS = {
  "content-security-policy": "sandbox; default-src 'none'; img-src data:; style-src 'unsafe-inline'",
  "x-content-type-options": "nosniff",
  "cross-origin-resource-policy": "same-origin",
};

export async function failure(e: unknown, path: string): Promise<Response> {
  const r = inboxErrorText(e);
  if (r.status >= 500 && r.status !== 502) await captureError(e, { source: "route", path });
  return NextResponse.json({ error: r.error, reason: r.reason ?? null }, { status: r.status, headers: NO_STORE });
}

export async function jsonRoute(path: string, fn: () => Promise<unknown>): Promise<Response> {
  const refused = await founderOnly();
  if (refused) return refused;
  try {
    return NextResponse.json(await fn(), { headers: NO_STORE });
  } catch (e) {
    return failure(e, path);
  }
}

/** A buffer as a streamed body, so a file over the platform's 4.5 MB response ceiling still goes through. */
export function streamOf(buf: Uint8Array): ReadableStream<Uint8Array> {
  let at = 0;
  return new ReadableStream({
    pull(controller) {
      if (at >= buf.length) return controller.close();
      const end = Math.min(at + 256 * 1024, buf.length);
      controller.enqueue(buf.subarray(at, end));
      at = end;
    },
  });
}

/** Content-Disposition for a file name, ASCII with RFC 6266's UTF-8 form beside it. */
export function disposition(kind: "inline" | "attachment", name: string): string {
  const clean = name.replace(/[\r\n"\\/]/g, "_").slice(0, 180) || "file";
  const ascii = clean.replace(/[^\x20-\x7e]/g, "_");
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(clean)}`;
}
