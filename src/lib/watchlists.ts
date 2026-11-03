import type { SupabaseClient } from "@supabase/supabase-js";

// A member's watchlists (supabase/migrations/20260820100000_watchlists.sql: named lists of tickers, the owner's alone by
// RLS), read on the server for /watchlists and Home's compact panel (Ben, 2026-11-03: Watchlists gets its own page), so
// a page arrives with its lists, the companies' names and the trend lines in one query. Prices come live in the browser
// from /api/quotes (src/components/useQuotes.ts).

export type Watchlist = { id: string; name: string; tickers: string[] };

export type WatchlistData = {
  lists: Watchlist[];
  /** Company names by ticker. */
  names: Record<string, string>;
  /** Up to the last 12 closes by ticker, oldest first, from HighStrike's own price history (2+ points, else absent). */
  trends: Record<string, number[]>;
};

/** Symbols a list can hold (the cap /api/symbols/add has always had). */
export const LIST_SIZE = 50;
/** Lists a member can keep. */
export const MAX_LISTS = 20;
/** A list's longest name. */
export const NAME_MAX = 40;
/** The list a member starts with. */
export const DEFAULT_LIST = "My Watchlist";
/** One tap fills an empty list with the classics. */
export const STARTERS = ["SPY", "QQQ", "NVDA", "AAPL", "TSLA"];

type ItemRow = {
  ticker: string;
  added_at: string;
  symbols: { name: string | null; price_history: { close: number | string }[] | null } | null;
};
type ListRow = { id: string; name: string; watchlist_items: ItemRow[] | null };

const TRENDS = "watchlist_items.symbols.price_history";

/**
 * The member's lists, oldest first, each with its tickers in the order they were added, plus names and trend lines.
 * `start` makes "My Watchlist" for a member with none (as Home's panel used to on a first visit). The trend lines come
 * newest first, 12 at most per ticker from the last five weeks, so a long-idle ticker draws nothing rather than an old
 * line.
 */
export async function memberWatchlists(supabase: SupabaseClient, userId: string, { start = false } = {}): Promise<WatchlistData> {
  const since = new Date(Date.now() - 35 * 86_400_000).toISOString().slice(0, 10);
  const { data } = await supabase
    .from("watchlists")
    .select("id, name, watchlist_items(ticker, added_at, symbols(name, price_history(close)))")
    .eq("user_id", userId)
    .order("created_at")
    .order("added_at", { referencedTable: "watchlist_items" })
    .gte(`${TRENDS}.price_date`, since)
    .order("price_date", { referencedTable: TRENDS, ascending: false })
    .limit(12, { referencedTable: TRENDS });
  let rows = (data ?? []) as unknown as ListRow[];

  if (rows.length === 0 && start) {
    const { data: made } = await supabase.from("watchlists").insert({ user_id: userId, name: DEFAULT_LIST }).select("id, name").single();
    if (made) rows = [{ id: made.id, name: made.name, watchlist_items: [] }];
  }

  const names: Record<string, string> = {};
  const trends: Record<string, number[]> = {};
  const lists = rows.map((r) => {
    const items = r.watchlist_items ?? [];
    for (const i of items) {
      if (i.symbols?.name) names[i.ticker] = i.symbols.name;
      const closes = (i.symbols?.price_history ?? []).map((p) => Number(p.close)).filter(Number.isFinite);
      if (closes.length >= 2 && !trends[i.ticker]) trends[i.ticker] = closes.reverse();
    }
    return { id: r.id, name: r.name, tickers: items.map((i) => i.ticker) };
  });
  return { lists, names, trends };
}

/** The tickers the member has a live price alert on, for the bells that show one is set. */
export async function alertedTickers(supabase: SupabaseClient, userId: string): Promise<string[]> {
  const { data } = await supabase.from("price_alerts").select("ticker").eq("user_id", userId).eq("status", "active").limit(500);
  return [...new Set(((data ?? []) as { ticker: string }[]).map((r) => r.ticker))];
}
