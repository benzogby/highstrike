import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/lib/supabaseConfig";
import { fetchQuotes } from "@/lib/quotes";

// Flow Scanner v1: ranks the symbol universe on signals computable from
// quote data — day momentum, closing strength within the day's range, gap
// follow-through, and 5-day momentum from first-party price history. The
// formula is deliberately transparent (documented in the UI): this is an
// honest v1 without paid options-flow data.

export type ScanRow = {
  ticker: string;
  name: string;
  price: number;
  changePct: number;
  rangePos: number | null; // 0..1 where in the day's range price sits
  gapPct: number | null;
  mom5d: number | null;
  score: number;
  bias: "long" | "short" | "neutral";
  live: boolean;
};

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export async function computeScan(): Promise<{ rows: ScanRow[]; live: boolean }> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  const { data: universe } = await supabase
    .from("symbols")
    .select("ticker, name")
    .eq("is_active", true)
    .limit(200);
  const symbols = universe ?? [];
  if (symbols.length === 0) return { rows: [], live: false };

  const quotes = await fetchQuotes(symbols.map((s) => s.ticker));
  const nameOf = new Map(symbols.map((s) => [s.ticker, s.name]));

  // 5-day momentum from accrued closes (empty until price_history fills).
  const since = new Date(Date.now() - 9 * 86400000).toISOString().slice(0, 10);
  const { data: hist } = await supabase
    .from("price_history")
    .select("ticker, price_date, close")
    .gte("price_date", since)
    .order("price_date", { ascending: true });
  const oldest = new Map<string, number>();
  for (const r of hist ?? []) {
    if (!oldest.has(r.ticker)) oldest.set(r.ticker, Number(r.close));
  }

  const rows: ScanRow[] = quotes.map((q) => {
    const rangePos =
      q.high != null && q.low != null && q.high > q.low
        ? (q.price - q.low) / (q.high - q.low)
        : null;
    const gapPct =
      q.open != null && q.prevClose != null && q.prevClose > 0
        ? ((q.open - q.prevClose) / q.prevClose) * 100
        : null;
    const base = oldest.get(q.symbol);
    const mom5d = base && base > 0 ? ((q.price - base) / base) * 100 : null;

    const score = clamp(
      50 +
        q.changePct * 6 +
        (rangePos != null ? (rangePos - 0.5) * 30 : 0) +
        (gapPct != null ? gapPct * 3 : 0) +
        (mom5d != null ? mom5d * 2 : 0)
    );

    return {
      ticker: q.symbol,
      name: nameOf.get(q.symbol) ?? q.symbol,
      price: q.price,
      changePct: q.changePct,
      rangePos: rangePos != null ? Math.round(rangePos * 100) / 100 : null,
      gapPct: gapPct != null ? Math.round(gapPct * 100) / 100 : null,
      mom5d: mom5d != null ? Math.round(mom5d * 100) / 100 : null,
      score,
      bias: score >= 60 ? "long" : score <= 40 ? "short" : "neutral",
      live: q.live,
    };
  });

  rows.sort((a, b) => b.score - a.score);
  return { rows, live: rows.some((r) => r.live) };
}
