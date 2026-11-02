import { NextRequest, NextResponse } from "next/server";
import { captureError } from "@/lib/capture";

export const dynamic = "force-dynamic";

// A browser's error, from the error pages (app/error.tsx, app/global-error.tsx), for Admin → Errors. Public, like
// /api/track: only short text is kept, bots are dropped, and it always answers ok.
const BOT = /bot|crawl|spider|headless|lighthouse/i;

export async function POST(req: NextRequest) {
  try {
    if (BOT.test(req.headers.get("user-agent") ?? "")) return NextResponse.json({ ok: true });
    const origin = req.headers.get("origin");
    if (origin && new URL(origin).host !== new URL(req.url).host) return NextResponse.json({ ok: true });
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const text = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : "");
    const e = new Error(text(b.message, 1000) || "(no message)");
    e.stack = text(b.stack, 4000) || undefined;
    await captureError(e, { source: "client", path: text(b.path, 300) || null, digest: text(b.digest, 100) || null });
  } catch {
    /* never fails the page */
  }
  return NextResponse.json({ ok: true });
}
