import { supabaseService } from "@/lib/stripe";

/**
 * Makes sure a ticker is in public.symbols, looking it up on Finnhub when it's new (as a watchlist add does). `active`
 * false keeps it out of the scanner's universe: a pasted idea on a new stock shouldn't change what the scanner ranks.
 * Returns an error in words, or null when the ticker is there.
 */
export async function ensureSymbol(ticker: string, { active = true } = {}): Promise<string | null> {
  const db = supabaseService();
  const { data: known } = await db.from("symbols").select("ticker").eq("ticker", ticker).maybeSingle();
  if (known) return null;
  let name = ticker;
  const token = process.env.FINNHUB_API_KEY;
  if (token) {
    try {
      const res = await fetch(`https://finnhub.io/api/v1/search?q=${encodeURIComponent(ticker)}&exchange=US&token=${token}`, { next: { revalidate: 3600 } });
      const data = (await res.json()) as { result?: { symbol: string; description: string }[] };
      const hit = (data.result ?? []).find((r) => r.symbol === ticker);
      if (!hit) return `${ticker} isn't a US stock we can find.`;
      name = hit.description || ticker;
    } catch {
      return "Couldn't look the ticker up just now. Try again.";
    }
  }
  const { error } = await db.from("symbols").upsert({ ticker, name, is_active: active }, { onConflict: "ticker" });
  return error ? `${ticker} couldn't be added: ${error.message}` : null;
}
