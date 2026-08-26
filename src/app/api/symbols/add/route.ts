import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseService } from "@/lib/stripe";

export const dynamic = "force-dynamic";

// Adds a ticker to a member's watchlist, registering it in public.symbols
// first when it's new (validated against Finnhub when a key is configured).
// The symbols upsert needs the service role because symbols is read-only to
// members; the watchlist insert then runs as the user under RLS.
export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  let body: { watchlistId?: unknown; ticker?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const watchlistId = typeof body.watchlistId === "string" ? body.watchlistId : "";
  const ticker =
    typeof body.ticker === "string" ? body.ticker.trim().toUpperCase() : "";
  if (!/^[0-9a-f-]{36}$/.test(watchlistId) || !/^[A-Z.-]{1,10}$/.test(ticker)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Ownership check (RLS would also block, but fail fast with a clear error).
  const { data: list } = await supabase
    .from("watchlists")
    .select("id")
    .eq("id", watchlistId)
    .single();
  if (!list) return NextResponse.json({ error: "Watchlist not found" }, { status: 404 });

  // Cap list size.
  const { count } = await supabase
    .from("watchlist_items")
    .select("ticker", { count: "exact", head: true })
    .eq("watchlist_id", watchlistId);
  if ((count ?? 0) >= 50) {
    return NextResponse.json({ error: "Watchlist is full (50 symbols)" }, { status: 400 });
  }

  // Ensure the symbol exists in the universe.
  const { data: known } = await supabase
    .from("symbols")
    .select("ticker")
    .eq("ticker", ticker)
    .maybeSingle();

  if (!known) {
    let name = ticker;
    const token = process.env.FINNHUB_API_KEY;
    if (token) {
      try {
        const res = await fetch(
          `https://finnhub.io/api/v1/search?q=${encodeURIComponent(ticker)}&exchange=US&token=${token}`,
          { next: { revalidate: 3600 } }
        );
        const data = (await res.json()) as {
          result?: { symbol: string; description: string }[];
        };
        const hit = (data.result ?? []).find((r) => r.symbol === ticker);
        if (!hit) {
          return NextResponse.json({ error: `Unknown symbol ${ticker}` }, { status: 404 });
        }
        name = hit.description || ticker;
      } catch {
        return NextResponse.json({ error: "Symbol lookup failed — try again" }, { status: 502 });
      }
    }
    try {
      const service = supabaseService();
      const { error: upErr } = await service
        .from("symbols")
        .upsert({ ticker, name }, { onConflict: "ticker" });
      if (upErr) throw upErr;
    } catch {
      return NextResponse.json(
        { error: `${ticker} isn't in the symbol universe yet` },
        { status: 400 }
      );
    }
  }

  const { error: insErr } = await supabase
    .from("watchlist_items")
    .insert({ watchlist_id: watchlistId, ticker });
  if (insErr && insErr.code !== "23505") {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, ticker });
}
