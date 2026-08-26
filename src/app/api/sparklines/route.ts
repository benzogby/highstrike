import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Last 12 recorded closes per symbol from first-party price history —
// powers watchlist sparklines. Member-only; returns {} until history accrues.
export async function GET(request: Request) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const raw = new URL(request.url).searchParams.get("symbols") ?? "";
  const symbols = [
    ...new Set(
      raw
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter((s) => /^[A-Z.^-]{1,10}$/.test(s))
    ),
  ].slice(0, 60);
  if (symbols.length === 0) return NextResponse.json({ series: {} });

  const { data } = await supabase
    .from("price_history")
    .select("ticker, price_date, close")
    .in("ticker", symbols)
    .order("price_date", { ascending: true });

  const series: Record<string, number[]> = {};
  for (const r of data ?? []) {
    (series[r.ticker] ??= []).push(Number(r.close));
  }
  for (const key of Object.keys(series)) {
    series[key] = series[key].slice(-12);
    if (series[key].length < 2) delete series[key];
  }

  return NextResponse.json({ series });
}
