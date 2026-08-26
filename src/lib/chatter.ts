import { supabaseService } from "@/lib/stripe";

// Chatter Engine v1: nightly per-ticker crowd metrics from StockTwits'
// public symbol streams. We derive aggregates only — message velocity from
// the recent stream's time span, counts of author-labeled Bullish/Bearish
// posts, and the symbol's watcher total. No post content is stored.

const UA = { "User-Agent": "HighStrike/1.0 (support@highstrike.com)" };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type StreamMessage = {
  created_at?: string;
  entities?: { sentiment?: { basic?: string } | null };
};

type StreamResponse = {
  symbol?: { watchlist_count?: number };
  messages?: StreamMessage[];
};

export async function ingestChatter(): Promise<{ tickers: number; recorded: number }> {
  const service = supabaseService();
  const { data: universe } = await service
    .from("symbols")
    .select("ticker")
    .eq("is_active", true)
    .limit(200);
  const tickers = (universe ?? []).map((r) => r.ticker);
  if (tickers.length === 0) return { tickers: 0, recorded: 0 };

  const day = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  let recorded = 0;

  for (const ticker of tickers) {
    try {
      const res = await fetch(
        `https://api.stocktwits.com/api/2/streams/symbol/${encodeURIComponent(ticker)}.json`,
        { headers: UA }
      );
      if (!res.ok) {
        await sleep(250);
        continue;
      }
      const data = (await res.json()) as StreamResponse;
      const msgs = data.messages ?? [];
      if (msgs.length === 0) {
        await sleep(250);
        continue;
      }

      const times = msgs
        .map((m) => Date.parse(m.created_at ?? ""))
        .filter((t) => Number.isFinite(t))
        .sort((a, b) => a - b);
      const spanHours =
        times.length >= 2 ? Math.max((times[times.length - 1] - times[0]) / 3600000, 0.05) : null;
      const msgsPerHour =
        spanHours != null ? Math.round((msgs.length / spanHours) * 100) / 100 : null;

      let bullish = 0;
      let bearish = 0;
      for (const m of msgs) {
        const s = m.entities?.sentiment?.basic;
        if (s === "Bullish") bullish++;
        if (s === "Bearish") bearish++;
      }

      const { error } = await service.from("chatter_stats").upsert(
        {
          ticker,
          day,
          msgs_per_hour: msgsPerHour,
          bullish,
          bearish,
          watchers: data.symbol?.watchlist_count ?? null,
        },
        { onConflict: "ticker,day" }
      );
      if (!error) recorded++;
    } catch (e) {
      console.error(`chatter ingest failed for ${ticker}:`, e instanceof Error ? e.message : e);
    }
    await sleep(250);
  }

  return { tickers: tickers.length, recorded };
}

export type ChatterSignal = {
  msgsPerHour: number | null;
  bullishPct: number | null;
  watchers: number | null;
};

/** Latest-day chatter per ticker, for the cross-system engine. */
export async function latestChatter(): Promise<Map<string, ChatterSignal>> {
  const service = supabaseService();
  const { data: latest } = await service
    .from("chatter_stats")
    .select("day")
    .order("day", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!latest) return new Map();

  const { data } = await service
    .from("chatter_stats")
    .select("ticker, msgs_per_hour, bullish, bearish, watchers")
    .eq("day", latest.day);

  return new Map(
    (data ?? []).map((r) => {
      const labeled = r.bullish + r.bearish;
      return [
        r.ticker,
        {
          msgsPerHour: r.msgs_per_hour != null ? Number(r.msgs_per_hour) : null,
          bullishPct: labeled >= 5 ? Math.round((r.bullish / labeled) * 100) : null,
          watchers: r.watchers,
        },
      ];
    })
  );
}
