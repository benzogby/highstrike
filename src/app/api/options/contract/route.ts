import { NextResponse } from "next/server";
import { viewer } from "@/lib/membership";
import { getCandles } from "@/lib/candles";
import { realOption } from "@/lib/optionQuotes";
import { throttle } from "@/lib/security";

export const dynamic = "force-dynamic";

// /api/options/contract?u=AAPL&type=call&from=2026-12-10&strike=350 — the real listed contract for a plan's option and
// its price (src/lib/optionQuotes.ts), members only. { quote: null } when there's none to show; the page keeps its estimate.
export async function GET(request: Request) {
  const limited = await throttle(request, "contract", { max: 300, windowSec: 60 });
  if (limited) return limited;
  const q = new URL(request.url).searchParams;
  const u = (q.get("u") ?? "").trim().toUpperCase();
  const type = q.get("type");
  const from = q.get("from") ?? "";
  const strike = Number(q.get("strike"));
  if (!/^[A-Z][A-Z.]{0,7}$/.test(u) || (type !== "call" && type !== "put") || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !(strike > 0 && strike < 1e6)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const context = await viewer();
  if (!context?.member) return NextResponse.json({ error: "Members only" }, { status: 401 });
  const { candles } = await getCandles(u);
  const closes = new Map(candles.map((c) => [c.t, c.c]));
  const quote = await realOption(u, type, from, strike, (day) => closes.get(day) ?? candles.at(-1)?.c ?? null);
  return NextResponse.json({ quote }, { headers: { "Cache-Control": quote ? "private, max-age=120" : "no-store" } });
}
