"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type List = { id: string; name: string };
type Quote = { symbol: string; price: number; changePct: number; live: boolean };
type SearchHit = { ticker: string; name: string };

const REFRESH_MS = 45_000;

/** 12-point mini trend from accrued closes; renders a dash until history exists. */
function Sparkline({ values }: { values?: number[] }) {
  if (!values || values.length < 2) {
    return <span className="text-xs text-ink-3">—</span>;
  }
  const w = 64;
  const h = 22;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values
    .map(
      (v, i) =>
        `${((i / (values.length - 1)) * (w - 4) + 2).toFixed(1)},${(
          h - 3 - ((v - min) / span) * (h - 6)
        ).toFixed(1)}`
    )
    .join(" ");
  const up = values[values.length - 1] >= values[0];
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="inline-block align-middle"
      aria-label={`Trend ${up ? "up" : "down"} over ${values.length} sessions`}
      role="img"
    >
      <polyline
        points={pts}
        fill="none"
        stroke={up ? "var(--color-up)" : "var(--color-down)"}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function WatchlistPanel({ userId }: { userId: string }) {
  const [lists, setLists] = useState<List[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [tickers, setTickers] = useState<string[]>([]);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [sparks, setSparks] = useState<Record<string, number[]>>({});
  const [live, setLive] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load lists (create the default on first visit).
  useEffect(() => {
    let alive = true;
    (async () => {
      const supabase = supabaseBrowser();
      const { data } = await supabase
        .from("watchlists")
        .select("id, name")
        .order("created_at");
      let all = data ?? [];
      if (all.length === 0) {
        const { data: created } = await supabase
          .from("watchlists")
          .insert({ user_id: userId, name: "My Watchlist" })
          .select("id, name")
          .single();
        if (created) all = [created];
      }
      if (!alive) return;
      setLists(all);
      setActiveId((cur) => cur ?? all[0]?.id ?? null);
    })();
    return () => {
      alive = false;
    };
  }, [userId]);

  // Load items for the active list.
  const loadItems = useCallback(async () => {
    if (!activeId) return;
    const { data } = await supabaseBrowser()
      .from("watchlist_items")
      .select("ticker")
      .eq("watchlist_id", activeId)
      .order("added_at");
    setTickers((data ?? []).map((r) => r.ticker));
  }, [activeId]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // Quotes polling.
  useEffect(() => {
    if (tickers.length === 0) {
      setQuotes({});
      return;
    }
    let alive = true;
    async function refresh() {
      try {
        const res = await fetch(`/api/quotes?symbols=${tickers.join(",")}`);
        if (!res.ok) return;
        const data = (await res.json()) as { live: boolean; quotes: Quote[] };
        if (!alive) return;
        setLive(Boolean(data.live));
        setQuotes(Object.fromEntries(data.quotes.map((q) => [q.symbol, q])));
      } catch {
        // keep last quotes
      }
    }
    refresh();
    const t = setInterval(refresh, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [tickers]);

  // Sparklines from first-party price history (fills as history accrues).
  useEffect(() => {
    if (tickers.length === 0) {
      setSparks({});
      return;
    }
    let alive = true;
    fetch(`/api/sparklines?symbols=${tickers.join(",")}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d?.series) setSparks(d.series);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [tickers]);

  // Debounced symbol search.
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (query.trim().length < 1) {
      setHits([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/symbols/search?q=${encodeURIComponent(query.trim())}`);
        const data = (await res.json()) as { results: SearchHit[] };
        setHits(data.results.filter((h) => !tickers.includes(h.ticker)));
      } catch {
        setHits([]);
      }
    }, 250);
  }, [query, tickers]);

  async function addTicker(ticker: string) {
    if (!activeId || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/symbols/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ watchlistId: activeId, ticker }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't add symbol");
      setQuery("");
      setHits([]);
      await loadItems();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add symbol");
    } finally {
      setBusy(false);
    }
  }

  async function removeTicker(ticker: string) {
    if (!activeId) return;
    setTickers((t) => t.filter((x) => x !== ticker));
    await supabaseBrowser()
      .from("watchlist_items")
      .delete()
      .eq("watchlist_id", activeId)
      .eq("ticker", ticker);
  }

  async function newList() {
    const name = window.prompt("Watchlist name", `List ${(lists?.length ?? 0) + 1}`);
    if (!name?.trim()) return;
    const { data, error: err } = await supabaseBrowser()
      .from("watchlists")
      .insert({ user_id: userId, name: name.trim().slice(0, 40) })
      .select("id, name")
      .single();
    if (err || !data) {
      setError(err?.message ?? "Couldn't create list");
      return;
    }
    setLists((l) => [...(l ?? []), data]);
    setActiveId(data.id);
  }

  async function deleteList() {
    if (!activeId || !lists || lists.length <= 1) return;
    if (!window.confirm("Delete this watchlist?")) return;
    await supabaseBrowser().from("watchlists").delete().eq("id", activeId);
    const remaining = (lists ?? []).filter((l) => l.id !== activeId);
    setLists(remaining);
    setActiveId(remaining[0]?.id ?? null);
  }

  return (
    <>
      <div
        id="watchlist"
        className="mt-8 flex scroll-mt-24 flex-wrap items-center justify-between gap-3"
      >
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-ink-2">
            Watchlist
          </h2>
          {lists === null && (
            <span className="text-xs text-ink-3">Loading…</span>
          )}
          {(lists ?? []).map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => setActiveId(l.id)}
              className={`rounded-full px-3 py-1 font-display text-xs font-semibold transition ${
                l.id === activeId
                  ? "bg-accent text-bg"
                  : "border border-line text-ink-2 hover:border-accent/50 hover:text-accent"
              }`}
            >
              {l.name}
            </button>
          ))}
          <button
            type="button"
            onClick={newList}
            className="rounded-full border border-line px-3 py-1 font-display text-xs font-semibold text-ink-3 transition hover:border-accent/50 hover:text-accent"
          >
            + New
          </button>
          {(lists?.length ?? 0) > 1 && (
            <button
              type="button"
              onClick={deleteList}
              className="rounded-full border border-line px-3 py-1 font-display text-xs font-semibold text-ink-3 transition hover:border-down/50 hover:text-down"
            >
              Delete
            </button>
          )}
        </div>
        <span className="text-[10px] uppercase tracking-wider text-ink-3">
          {live ? "Live quotes · refreshes every 45s" : "Sample quotes — live data pending"}
        </span>
      </div>

      {/* Add symbol */}
      <div className="relative mt-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && query.trim()) addTicker(query.trim().toUpperCase());
          }}
          placeholder="Add symbol — type a ticker or company name…"
          aria-label="Add symbol to watchlist"
          className="h-10 w-full rounded-lg border border-line bg-panel px-3.5 text-sm text-ink placeholder:text-ink-3 outline-none transition focus:border-accent/60 focus:ring-2 focus:ring-accent/20"
        />
        {hits.length > 0 && (
          <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-line bg-panel shadow-xl">
            {hits.map((h) => (
              <li key={h.ticker}>
                <button
                  type="button"
                  onClick={() => addTicker(h.ticker)}
                  className="flex w-full items-center justify-between px-3.5 py-2 text-left text-sm transition hover:bg-panel-2"
                >
                  <span className="font-display font-semibold">{h.ticker}</span>
                  <span className="ml-3 truncate text-xs text-ink-3">{h.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {error && <p className="mt-1.5 text-xs text-down">{error}</p>}
      </div>

      <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-panel">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-[10px] uppercase tracking-wider text-ink-3">
              <th className="px-5 py-2.5 font-medium">Ticker</th>
              <th className="px-3 py-2.5 text-right font-medium">Last</th>
              <th className="px-3 py-2.5 text-right font-medium">Change</th>
              <th className="hidden px-3 py-2.5 text-right font-medium sm:table-cell">
                Trend
              </th>
              <th className="px-5 py-2.5 text-right font-medium" aria-label="Actions" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {tickers.map((t) => {
              const q = quotes[t];
              const up = (q?.changePct ?? 0) >= 0;
              return (
                <tr key={t} className="group">
                  <td className="px-5 py-2.5 font-display font-semibold">
                    <Link
                      href={`/symbol/${t}`}
                      className="transition hover:text-accent"
                    >
                      {t}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono-nums text-ink-2">
                    {q ? q.price.toFixed(2) : "—"}
                  </td>
                  <td
                    className={`px-3 py-2.5 text-right font-mono-nums ${
                      up ? "text-up" : "text-down"
                    }`}
                  >
                    {q ? `${up ? "▲" : "▼"} ${Math.abs(q.changePct).toFixed(2)}%` : "—"}
                  </td>
                  <td className="hidden px-3 py-2.5 text-right sm:table-cell">
                    <Sparkline values={sparks[t]} />
                  </td>
                  <td className="px-5 py-2.5 text-right">
                    <span className="inline-flex items-center gap-3">
                      <Link
                        href={`/symbol/${t}#alerts`}
                        aria-label={`Set alert on ${t}`}
                        title="Set price alert"
                        className="text-ink-3 opacity-0 transition group-hover:opacity-100 hover:text-accent"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                        </svg>
                      </Link>
                      <button
                        type="button"
                        onClick={() => removeTicker(t)}
                        aria-label={`Remove ${t}`}
                        className="text-xs text-ink-3 opacity-0 transition group-hover:opacity-100 hover:text-down"
                      >
                        ✕
                      </button>
                    </span>
                  </td>
                </tr>
              );
            })}
            {tickers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-sm text-ink-3">
                  <p>No symbols yet — add a ticker above, or start with the classics:</p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      if (!activeId) return;
                      setBusy(true);
                      await supabaseBrowser()
                        .from("watchlist_items")
                        .insert(
                          ["SPY", "QQQ", "NVDA", "AAPL", "TSLA"].map((t) => ({
                            watchlist_id: activeId,
                            ticker: t,
                          }))
                        );
                      setBusy(false);
                      loadItems();
                    }}
                    className="mt-3 rounded-lg bg-accent px-4 py-2 font-display text-sm font-semibold text-bg transition hover:bg-accent-2 disabled:opacity-60"
                  >
                    {busy ? "Adding…" : "Add SPY, QQQ, NVDA, AAPL, TSLA"}
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
