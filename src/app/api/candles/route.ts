import { NextResponse } from "next/server";
import { viewer } from "@/lib/membership";
import { getCandles } from "@/lib/candles";

export const dynamic = "force-dynamic";

// /api/candles?symbol=AAPL — two years of daily candles for HighStrike Chart (src/lib/candles.ts), members only: the
// data plan is paid for the membership.
export async function GET(request: Request) {
  const symbol = (new URL(request.url).searchParams.get("symbol") ?? "").trim().toUpperCase();
  if (!/^[A-Z.-]{1,10}$/.test(symbol)) return NextResponse.json({ error: "Invalid symbol" }, { status: 400 });
  const context = await viewer();
  if (!context?.member) return NextResponse.json({ error: "Members only" }, { status: 401 });
  const set = await getCandles(symbol);
  // Only a full answer is kept by the browser; an empty one is asked again next time.
  return NextResponse.json(set, { headers: { "Cache-Control": set.candles.length ? "private, max-age=60" : "no-store" } });
}
