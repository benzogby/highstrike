import { NextResponse } from "next/server";
import { refreshScan } from "@/lib/scan/build";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// The Scanner's data (src/lib/scan/build.ts): every 5 minutes in market hours, once after the close for the day's bars,
// and once before the open (vercel.json). Each run reads what's kept and fetches only what's new.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const cron = secret ? request.headers.get("authorization") === `Bearer ${secret}` : (request.headers.get("user-agent") ?? "").startsWith("vercel-cron");
  if (!cron) return NextResponse.json({ error: "Cron only." }, { status: 401 });
  try {
    const result = await refreshScan();
    console.log("scan-refresh:", JSON.stringify(result));
    return NextResponse.json(result);
  } catch (e) {
    console.error("scan-refresh:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
