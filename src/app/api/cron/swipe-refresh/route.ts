import { NextResponse, after } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { etToday } from "@/lib/setupEngine";
import { jobToken, validJobToken } from "@/lib/jobToken";
import { refreshBatch } from "@/lib/options/refresh";
import { freezeLastWeek } from "@/lib/options/stats";
import { supabaseService } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const JOB = "swipe-refresh";

/** Vercel Cron, an admin (Admin → Overview), or a previous run of this job handing on. */
async function allowed(request: Request, day: string) {
  const secret = process.env.CRON_SECRET;
  if (secret ? request.headers.get("authorization") === `Bearer ${secret}` : (request.headers.get("user-agent") ?? "").startsWith("vercel-cron")) return true;
  if (validJobToken(JOB, day, request.headers.get("x-job-token"))) return true;
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: me } = await supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
  return Boolean(me?.is_admin);
}

// The swipe deck's refresh (src/lib/options/refresh.ts): one paced batch per run, and another run started while stocks
// are still stale, up to ten in a row.
async function handle(request: Request) {
  const day = etToday();
  if (!(await allowed(request, day))) return NextResponse.json({ error: "Not allowed." }, { status: 401 });
  const hop = Number(new URL(request.url).searchParams.get("hop") ?? 0) || 0;
  try {
    const result = await refreshBatch();
    // The first run after a week ends freezes its contest.
    const contest = hop === 0 ? await freezeLastWeek(supabaseService()).catch((e) => ({ error: String(e) })) : null;
    if (result.left > 0 && result.priced > 0 && hop < 10) {
      const next = new URL(request.url);
      next.searchParams.set("hop", String(hop + 1));
      after(() => fetch(next, { method: "POST", headers: { "x-job-token": jobToken(JOB, day) } }).catch((e) => console.error("swipe-refresh hand-on failed:", e)));
    }
    return NextResponse.json({ ...result, hop, contest });
  } catch (e) {
    console.error("swipe-refresh failed:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
