import { NextResponse, after } from "next/server";
import { morningToken } from "@/lib/morning";
import { supabaseServer } from "@/lib/supabase/server";
import { generateDaily, gradeSetups, snapshotPrices } from "@/lib/setupEngine";
import { checkAlerts } from "@/lib/alerts";
import { checkTrades } from "@/lib/tradeAlerts";
import { SITE_URL } from "@/lib/mail";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** The hour in New York now (0-23). */
function newYorkHour() {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hourCycle: "h23" }).format(new Date()));
}

// Daily generation trigger. Called by Vercel Cron (pre-market) and by admins
// ("Generate now"). Idempotent per ET date, so an unauthenticated hit can at
// most cause the one scheduled generation to happen early — `force`
// (regenerate) requires an admin session or the CRON_SECRET bearer.
// The day's ideas come out at 8:30 AM New York time all year (Ben, 2026-11-03), so Vercel calls at both 12:30 and
// 13:30 UTC (vercel.json) and only the call that lands in New York's 8 o'clock hour runs; the other, an hour off as the
// clocks change, answers "skipped". An admin's Generate now runs whenever.
async function handle(request: Request) {
  const url = new URL(request.url);
  const wantsForce = url.searchParams.get("force") === "1";

  let authorized = false;
  let admin = false;
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
      if (me?.is_admin) authorized = admin = true;
    }
  }

  if (wantsForce && !authorized) {
    return NextResponse.json({ error: "force requires admin" }, { status: 403 });
  }
  if (!admin && !wantsForce && newYorkHour() !== 8) {
    return NextResponse.json({ skipped: "The morning run is at 8:30 AM New York time." });
  }

  try {
    const snapshot = await snapshotPrices();
    const grading = await gradeSetups();
    const alerts = await checkAlerts();
    const tradeAlerts = await checkTrades().catch((e) => ({ error: e instanceof Error ? e.message : "failed" }));
    const result = await generateDaily(wantsForce);
    // The day's ideas are in: start the morning email and watchlist scans in a run of their own (once a day; a forced
    // regeneration from Admin doesn't email anyone).
    if (result.status === "generated" && !wantsForce) {
      // On production, the site's own address: Vercel Cron calls the deployment's generated vercel.app URL, which sits
      // behind Vercel Authentication, so the email's start got its sign-in page and waited for the backup cron.
      const origin = process.env.VERCEL_ENV === "production" ? SITE_URL : new URL(request.url).origin;
      after(() =>
        fetch(`${origin}/api/cron/morning-digest`, { headers: { "x-morning-token": morningToken(result.date) } })
          .then((r) => r.json())
          .then((j) => console.log("morning-digest:", JSON.stringify(j)))
          .catch((e) => console.error("morning-digest start failed:", e))
      );
    }
    return NextResponse.json({ ...result, grading, snapshot, alerts, tradeAlerts });
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
