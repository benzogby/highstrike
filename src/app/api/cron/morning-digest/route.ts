import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/stripe";
import { etToday } from "@/lib/setupEngine";
import { scanWatchlists, sendDigests, validMorningToken } from "@/lib/morning";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// The morning email and watchlist scans (piece 5 of the trade-ideas plan). The engine's run starts it as soon as the
// day's ideas are written (api/cron/generate-setups, with the day's signed token); Vercel Cron starts it again later as a
// backup (vercel.json). It runs once a market day, and only once there are ideas: a site_settings marker holds the last
// day it sent.
export async function GET(request: Request) {
  const day = etToday();
  const secret = process.env.CRON_SECRET;
  const cron = secret ? request.headers.get("authorization") === `Bearer ${secret}` : (request.headers.get("user-agent") ?? "").startsWith("vercel-cron");
  if (!cron && !validMorningToken(day, request.headers.get("x-morning-token"))) return NextResponse.json({ error: "Cron only." }, { status: 401 });
  const dow = new Date(`${day}T12:00:00Z`).getUTCDay();
  if (dow === 0 || dow === 6) return NextResponse.json({ skipped: "weekend", day });
  const db = supabaseService();
  const { data: last } = await db.from("site_settings").select("value").eq("key", "digest_last_sent").maybeSingle();
  if (last?.value === day) return NextResponse.json({ skipped: "already sent", day });
  const { count } = await db.from("setups").select("id", { count: "exact", head: true }).eq("report_date", day).is("owner_id", null);
  if (!count) return NextResponse.json({ skipped: "no ideas yet", day });
  // Claim the day first, so an overlapping run can't send twice.
  await db.from("site_settings").upsert({ key: "digest_last_sent", value: day, updated_at: new Date().toISOString() });
  try {
    const watchlists = await scanWatchlists();
    const digests = await sendDigests();
    return NextResponse.json({ day, watchlists, digests });
  } catch (e) {
    console.error("morning-digest failed:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "failed", day }, { status: 500 });
  }
}
