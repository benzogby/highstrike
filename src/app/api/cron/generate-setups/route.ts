import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { generateDaily, gradeSetups, snapshotPrices } from "@/lib/setupEngine";
import { checkAlerts } from "@/lib/alerts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Daily generation trigger. Called by Vercel Cron (pre-market) and by admins
// ("Generate now"). Idempotent per ET date, so an unauthenticated hit can at
// most cause the one scheduled generation to happen early — `force`
// (regenerate) requires an admin session or the CRON_SECRET bearer.
async function handle(request: Request) {
  const url = new URL(request.url);
  const wantsForce = url.searchParams.get("force") === "1";

  let authorized = false;
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (secret && auth === `Bearer ${secret}`) authorized = true;

  if (!authorized) {
    const supabase = await supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: me } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single();
      if (me?.is_admin) authorized = true;
    }
  }

  if (wantsForce && !authorized) {
    return NextResponse.json({ error: "force requires admin" }, { status: 403 });
  }

  try {
    const snapshot = await snapshotPrices();
    const grading = await gradeSetups();
    const alerts = await checkAlerts();
    const result = await generateDaily(wantsForce);
    return NextResponse.json({ ...result, grading, snapshot, alerts });
  } catch (e) {
    console.error("generate-setups failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "generation failed" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
