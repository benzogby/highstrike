import { NextResponse } from "next/server";
import { checkAlerts } from "@/lib/alerts";
import { checkTrades } from "@/lib/tradeAlerts";
import { marketOpen } from "@/lib/marketCalendar";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// The market-hours price check (Ben, 2026-11-03: alerts fire on time, not only while someone has the site open).
// Vercel Cron calls it every minute on weekdays from 13:00 to 21:59 UTC (vercel.json), which holds New York's session
// in summer and in winter; it checks prices only while the market's open, and for five minutes after the bell so a
// stock that closes past a level still alerts. Each check sweeps price alerts (src/lib/alerts.ts) and tracked trades'
// targets and stops (src/lib/tradeAlerts.ts). Member traffic and the morning job sweep too; each alert goes out once.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const cron = secret ? request.headers.get("authorization") === `Bearer ${secret}` : (request.headers.get("user-agent") ?? "").startsWith("vercel-cron");
  if (!cron) return NextResponse.json({ error: "Cron only." }, { status: 401 });
  if (!marketOpen(Date.now(), 5)) return NextResponse.json({ skipped: "The market's closed." });
  const failed = (e: unknown) => ({ error: e instanceof Error ? e.message : "failed" });
  const [alerts, trades] = await Promise.all([checkAlerts().catch(failed), checkTrades().catch(failed)]);
  const broke = "error" in alerts || "error" in trades;
  if (broke) console.error("check-alerts:", JSON.stringify({ alerts, trades }));
  else if (alerts.fired || trades.alerted) console.log("check-alerts:", JSON.stringify({ alerts, trades }));
  return NextResponse.json({ alerts, trades }, { status: broke ? 500 : 200 });
}
