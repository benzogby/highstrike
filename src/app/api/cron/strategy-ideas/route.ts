import { NextResponse, after } from "next/server";
import { etToday } from "@/lib/setupEngine";
import { morningToken, validMorningToken } from "@/lib/morning";
import { generateStrategyIdeas } from "@/lib/strategies/ideas";
import { SITE_URL } from "@/lib/mail";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// The day's ideas from strategies (src/lib/strategies/ideas.ts). The morning run (api/cron/generate-setups) starts it
// with the day's signed token once the other ideas are written; with ?digest=1 it then starts the morning email, so
// the email has these too. Weekdays only.
export async function GET(request: Request) {
  const day = etToday();
  const secret = process.env.CRON_SECRET;
  const cron = secret ? request.headers.get("authorization") === `Bearer ${secret}` : false;
  if (!cron && !validMorningToken(day, request.headers.get("x-morning-token"))) return NextResponse.json({ error: "Cron only." }, { status: 401 });
  const dow = new Date(`${day}T12:00:00Z`).getUTCDay();
  if (dow === 0 || dow === 6) return NextResponse.json({ skipped: "weekend", day });
  try {
    const result = await generateStrategyIdeas(day);
    console.log("strategy-ideas:", JSON.stringify(result));
    if (new URL(request.url).searchParams.get("digest") === "1") {
      const origin = process.env.VERCEL_ENV === "production" ? SITE_URL : new URL(request.url).origin;
      after(() =>
        fetch(`${origin}/api/cron/morning-digest`, { headers: { "x-morning-token": morningToken(day) } })
          .then((r) => r.json())
          .then((j) => console.log("morning-digest:", JSON.stringify(j)))
          .catch((e) => console.error("morning-digest start failed:", e))
      );
    }
    return NextResponse.json({ day, ...result });
  } catch (e) {
    console.error("strategy-ideas failed:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "failed", day }, { status: 500 });
  }
}
