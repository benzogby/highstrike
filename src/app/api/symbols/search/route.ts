import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/lib/supabaseConfig";

export const dynamic = "force-dynamic";

// Symbol lookup for the add-to-watchlist box. Uses Finnhub search when a key
// is configured (US common stocks/ETFs), falling back to the local symbols
// table. Results are candidates only — /api/symbols/add validates on insert.
export async function GET(request: Request) {
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (q.length < 1 || q.length > 20) {
    return NextResponse.json({ results: [] });
  }

  const token = process.env.FINNHUB_API_KEY;
  if (token) {
    try {
      const res = await fetch(
        `https://finnhub.io/api/v1/search?q=${encodeURIComponent(q)}&exchange=US&token=${token}`,
        { next: { revalidate: 3600 } }
      );
      if (res.ok) {
        const data = (await res.json()) as {
          result?: { symbol: string; description: string; type: string }[];
        };
        const results = (data.result ?? [])
          .filter((r) => /^[A-Z.-]{1,10}$/.test(r.symbol) && r.type === "Common Stock")
          .slice(0, 8)
          .map((r) => ({ ticker: r.symbol, name: r.description }));
        if (results.length) return NextResponse.json({ results });
      }
    } catch {
      // fall through to local search
    }
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  const { data } = await supabase
    .from("symbols")
    .select("ticker, name")
    .or(`ticker.ilike.${q}%,name.ilike.%${q}%`)
    .eq("is_active", true)
    .limit(8);

  return NextResponse.json({ results: data ?? [] });
}
