import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseService } from "@/lib/stripe";
import { ingestInsiders } from "@/lib/insiders";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Nightly EDGAR ingestion (Vercel Cron). Unauthenticated calls are allowed
// but throttled to one run per hour — ingestion is incremental and
// idempotent, so the worst an anonymous hit can do is run it early.
async function handle(request: Request) {
  let privileged = false;
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (secret && auth === `Bearer ${secret}`) privileged = true;

  if (!privileged) {
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
      if (me?.is_admin) privileged = true;
    }
  }

  try {
    const service = supabaseService();
    if (!privileged) {
      const { data } = await service
        .from("site_settings")
        .select("value")
        .eq("key", "insiders_last_run")
        .maybeSingle();
      if (data?.value && Date.now() - Date.parse(data.value) < 3600_000) {
        return NextResponse.json({ status: "throttled" });
      }
    }
    await service.from("site_settings").upsert({
      key: "insiders_last_run",
      value: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const result = await ingestInsiders();
    return NextResponse.json({ status: "ok", ...result });
  } catch (e) {
    console.error("ingest-insiders failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "ingestion failed" },
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
