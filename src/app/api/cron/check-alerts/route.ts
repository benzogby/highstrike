import { NextResponse } from "next/server";
import { checkAlerts } from "@/lib/alerts";
import { marketOpen } from "@/lib/marketCalendar";
import { supabaseService } from "@/lib/stripe";
import { sweepPaper } from "@/lib/paper";
import { checkStrategies } from "@/lib/strategies/live";
import { isCron } from "@/lib/security";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// The market-hours price check (Ben, 2026-11-03: alerts fire on time, not only while someone has the site open).
// Vercel Cron calls it every minute on weekdays from 13:00 to 21:59 UTC (vercel.json), which holds New York's session
// in summer and in winter; it checks prices only while the market's open, and for five minutes after the bell so a
// stock that closes past a level still alerts. Each check sweeps price alerts (src/lib/alerts.ts), paper trading's
// working orders (src/lib/paper.ts) and, every fifth minute, live strategies (src/lib/strategies/live.ts). Member traffic and the morning job sweep too; each alert goes out once.
export async function GET(request: Request) {
  const cron = isCron(request);
  if (!cron) return NextResponse.json({ error: "Cron only." }, { status: 401 });
  if (!marketOpen(Date.now(), 5)) return NextResponse.json({ skipped: "The market's closed." });
  const failed = (e: unknown) => ({ error: e instanceof Error ? e.message : "failed" });
  // Paper trading's working orders and expired options are swept on the same minute (src/lib/paper.ts).
  // Live strategies every fifth minute (src/lib/strategies/live.ts): their entries and the trades they opened.
  const fifth = new Date().getUTCMinutes() % 5 === 0;
  const [alerts, paper, strategies] = await Promise.all([
    checkAlerts().catch(failed),
    sweepPaper().catch(failed),
    fifth ? checkStrategies().catch(failed) : Promise.resolve(null),
  ]);
  if (strategies && "error" in strategies) console.error("check-alerts: strategies:", strategies.error);
  else if (strategies && (strategies.fired || strategies.closed)) console.log("check-alerts: strategies:", JSON.stringify(strategies));
  if ("error" in paper) console.error("check-alerts: paper sweep:", paper.error);
  else if (paper.filled || paper.settled) console.log("check-alerts: paper:", JSON.stringify(paper));
  const broke = "error" in alerts;
  if (broke) console.error("check-alerts:", JSON.stringify({ alerts }));
  else {
    if (alerts.fired) console.log("check-alerts:", JSON.stringify({ alerts }));
    // The last good check, so anyone can see alerts are being watched: stale during market hours means they aren't.
    const now = new Date().toISOString();
    await supabaseService().from("site_settings").upsert({ key: "price_check_last", value: now, updated_at: now });
  }
  return NextResponse.json({ alerts, paper, strategies }, { status: broke ? 500 : 200 });
}
