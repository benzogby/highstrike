import { NextResponse } from "next/server";
import { viewer } from "@/lib/membership";
import { INTRADAY, getCandles, getIntraday, getOptionCandles, type Intraday } from "@/lib/candles";

export const dynamic = "force-dynamic";

// /api/candles?symbol=AAPL[&tf=5m] — two years of daily candles, or intraday bars, for HighStrike Chart (src/lib/candles.ts), members only: the
// data plan is paid for the membership.
export async function GET(request: Request) {
  const symbol = (new URL(request.url).searchParams.get("symbol") ?? "").trim().toUpperCase();
  // A stock ("AAPL") or one option contract ("O:AAPL261218C00350000"), whose own price the desk charts.
  const option = /^O:[A-Z.]{1,8}\d{6}[CP]\d{8}$/.test(symbol);
  if (!option && !/^[A-Z.-]{1,10}$/.test(symbol)) return NextResponse.json({ error: "Invalid symbol" }, { status: 400 });
  const context = await viewer();
  if (!context?.member) return NextResponse.json({ error: "Members only" }, { status: 401 });
  // ?tf=1m … 4h for intraday bars (src/lib/candles.ts); daily otherwise (the chart rolls daily into weekly itself).
  const tf = new URL(request.url).searchParams.get("tf");
  const intraday = tf && tf in INTRADAY ? (tf as Intraday) : null;
  const set = option ? await getOptionCandles(symbol, intraday) : intraday ? await getIntraday(symbol, intraday) : await getCandles(symbol);
  // Only a full answer is kept by the browser; an empty one is asked again next time.
  return NextResponse.json(set, { headers: { "Cache-Control": set.candles.length ? "private, max-age=60" : "no-store" } });
}
