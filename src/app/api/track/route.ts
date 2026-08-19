import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/lib/supabaseConfig";

export const dynamic = "force-dynamic";

// PUBLIC pageview tracker. One tiny insert per pageview, fired by
// TrackPageview.tsx in the root layout. Deliberately minimal so it can never
// slow the site down or fail a visitor's request:
//   - bots are dropped before touching the database
//   - ALWAYS returns { ok: true }, even on error (tracking must never surface)
// Retention pruning happens in the admin traffic route (RLS: admins delete).

const BOT_RE =
  /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|headless|lighthouse|pingdom|uptime|monitor|scrape|python-requests|curl\/|wget\//i;

export async function POST(req: NextRequest) {
  try {
    const ua = req.headers.get("user-agent") || "";
    if (!ua || BOT_RE.test(ua)) return NextResponse.json({ ok: true });

    const body = await req.json().catch(() => ({}) as Record<string, unknown>);
    const path = typeof body.path === "string" ? body.path : "";
    if (!path.startsWith("/") || path.startsWith("/api")) return NextResponse.json({ ok: true });

    const device =
      /ipad|tablet/i.test(ua) ? "tablet"
      : /mobile|iphone|android/i.test(ua) ? "mobile"
      : "desktop";

    const db = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
    // Only a plausible UUID is accepted; anything else records as anonymous.
    const uid =
      typeof body.userId === "string" && /^[0-9a-f-]{36}$/i.test(body.userId) ? body.userId : null;

    await db.from("page_views").insert({
      user_id: uid,
      path: path.slice(0, 300),
      referrer: (typeof body.referrer === "string" ? body.referrer : "").slice(0, 500) || null,
      visitor_id: (typeof body.visitorId === "string" ? body.visitorId : "").slice(0, 64) || null,
      session_id: (typeof body.sessionId === "string" ? body.sessionId : "").slice(0, 64) || null,
      device,
      country: req.headers.get("x-vercel-ip-country") || null,
      // Vercel URI-encodes the city header (e.g. S%C3%A3o%20Paulo).
      city: (() => {
        try {
          const c = req.headers.get("x-vercel-ip-city");
          return c ? decodeURIComponent(c).slice(0, 100) : null;
        } catch {
          return null;
        }
      })(),
      region: req.headers.get("x-vercel-ip-country-region")?.slice(0, 50) || null,
    });
  } catch (e) {
    console.error("[track] failed:", e);
  }
  return NextResponse.json({ ok: true });
}
