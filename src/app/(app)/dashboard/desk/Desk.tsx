"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, useTransition } from "react";
import HighStrikeChart from "@/components/chart/HighStrikeChart";
import { useQuotes } from "@/components/useQuotes";
import type { PaperState } from "@/lib/paper";
import type { Candle } from "@/lib/chart/types";
import { toastError, toastSuccess } from "@/lib/toastBus";
import { resetPaper } from "../paperActions";
import OptionChain, { type Pick } from "./OptionChain";
import OrderTicket, { type TicketTarget } from "./OrderTicket";
import Blotter from "./Blotter";
import { parseContract, pct, signed, tone, usd } from "./fmt";

export type DeskIdea = { id: string; ticker: string; direction: "long" | "short"; headline: string; option: string | null };
export type DeskLesson = { href: string; title: string; label: string; done: number; total: number } | null;

const EVERY_MS = 15_000;
const TICKER = /^[A-Z][A-Z0-9.]{0,7}$/;
const WIDE = "(min-width: 1280px)";

/** Whether the screen is wide enough for the full-screen desk (Tailwind's xl). */
function useWide() {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(WIDE);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(WIDE).matches,
    () => false
  );
}

/** Which floating panels are open, remembered in this browser. */
function usePanels() {
  const [open, setOpen] = useState({ side: true });
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("hs-desk-panels") ?? "null");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restores the member's panel layout once, from this browser
      if (saved && typeof saved === "object") setOpen((o) => ({ ...o, ...saved }));
    } catch {}
  }, []);
  const toggle = (k: keyof typeof open) =>
    setOpen((o) => {
      const next = { ...o, [k]: !o[k] };
      try {
        localStorage.setItem("hs-desk-panels", JSON.stringify(next));
      } catch {}
      return next;
    });
  return [open, toggle] as const;
}

const FLOAT = "rounded-xl border border-line-strong bg-panel/[0.92] shadow-[0_18px_40px_-12px_rgb(0_0_0/0.7)] backdrop-blur-md";

/**
 * Home, the trading desk (Ben, 2026-11-18: "the /dashboard page become the paper trading charts and execution hub";
 * "make the chart fullscreen… with the widgets overlaid on the edges"). On a wide screen the chart fills the page and the
 * panels float over its edges (watchlist left; ticket, ideas and lesson right; option chain and positions docked along
 * the bottom), each one collapsible, the chart widening into the room. On smaller screens everything stacks.
 */
export default function Desk({
  userId,
  initial,
  watch,
  ideas,
  lesson,
  budget,
}: {
  userId: string;
  initial: PaperState;
  watch: string[];
  ideas: DeskIdea[];
  lesson: DeskLesson;
  budget: number | null;
}) {
  const wide = useWide();
  const [panels, toggle] = usePanels();
  const [over, setOver] = useState<"watch" | "account" | "ideas" | null>(null);
  const [state, setState] = useState(initial);
  const [ticker, setTicker] = useState(initial.positions[0]?.underlying ?? watch[0] ?? "SPY");
  const [pick, setPick] = useState<Pick | null>(null);
  const [search, setSearch] = useState("");
  const [resetting, startReset] = useTransition();

  const refresh = useCallback(async () => {
    const r = await fetch("/api/paper", { cache: "no-store" }).catch(() => null);
    if (r?.ok) setState(await r.json());
  }, []);
  useEffect(() => {
    const t = setInterval(() => document.visibilityState === "visible" && refresh(), EVERY_MS);
    return () => clearInterval(t);
  }, [refresh]);

  const list = useMemo(() => [...new Set([...state.positions.map((p) => p.underlying), ...watch, ...ideas.map((i) => i.ticker)])].slice(0, 40), [state.positions, watch, ideas]);
  const { quotes: all, flash } = useQuotes([...new Set([...list, ticker])]);
  // Only live prices on the desk: when the quote service falls back to sample prices, a dash is shown instead.
  const quotes = useMemo(() => Object.fromEntries(Object.entries(all).filter(([, v]) => v.live)), [all]);
  const q = quotes[ticker];

  const select = (symbol: string) => {
    const c = parseContract(symbol);
    setTicker(c ? c.underlying : symbol);
    setPick(null);
  };
  const choose = (p: Pick) => {
    setPick(p);
    if (wide && !panels.side) toggle("side");
  };
  const held = (symbol: string) => state.positions.find((p) => p.symbol === symbol)?.qty ?? 0;

  const target: TicketTarget = pick
    ? { symbol: pick.contract, kind: "option", side: pick.side, bid: pick.bid, ask: pick.ask, last: null, held: held(pick.contract) }
    : { symbol: ticker, kind: "stock", side: "buy", bid: null, ask: null, last: q?.price ?? null, held: held(ticker) };

  const reset = () => {
    if (!confirm("Reset your paper account to $25,000? Positions and working orders are cleared.")) return;
    startReset(async () => {
      await resetPaper();
      toastSuccess("Paper account reset to $25,000");
      setPick(null);
      refresh();
    });
  };

  // ---- The pieces, laid out below for wide or small screens ----------------------------------------------------------

  const stat = (label: string, value: React.ReactNode, cls = "text-ink") => (
    <div className="min-w-0">
      <p className="text-[11px] leading-none text-ink-3">{label}</p>
      <p className={`mt-1 truncate font-mono-nums text-[14px] font-semibold leading-none ${cls}`}>{value}</p>
    </div>
  );
  const totalPct = state.start ? (state.totalPnl / state.start) * 100 : null;

  // The price summary (Ben, 2026-11-18: the top bar "should instead show the price data summary"): the stock's daily
  // bars (the same request the chart makes, so the browser's copy answers it) for the day's open, high, low, volume,
  // the last close and the 52-week range; the live quote for the price.
  const [daily, setDaily] = useState<{ ticker: string; candles: Candle[] } | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(`/api/candles?symbol=${encodeURIComponent(ticker)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { candles?: Candle[] } | null) => alive && d && setDaily({ ticker, candles: d.candles ?? [] }))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [ticker]);
  const bars = daily?.ticker === ticker ? daily.candles : [];
  const lastBar = bars.at(-1) ?? null;
  const prevBar = bars.at(-2) ?? null;
  const yearBars = bars.slice(-252);
  const hi52 = yearBars.length ? Math.max(...yearBars.map((b) => b.h)) : null;
  const lo52 = yearBars.length ? Math.min(...yearBars.map((b) => b.l)) : null;
  const lastPrice = q?.price ?? lastBar?.c ?? null;
  const change = lastPrice != null && prevBar ? lastPrice - prevBar.c : null;
  const changePct = q?.changePct ?? (change != null && prevBar ? (change / prevBar.c) * 100 : null);
  const vol = (n: number | null | undefined) => (n == null || n <= 0 ? "—" : n >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(n));
  const searchBox = (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const t = search.trim().toUpperCase().replace(/^\$/, "");
        if (!TICKER.test(t)) return toastError("Type a ticker, like AAPL.");
        select(t);
        setSearch("");
      }}
    >
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Symbol"
        aria-label="Open a symbol"
        className="h-8 w-full rounded-lg border border-line-strong bg-bg px-3 font-mono-nums text-sm uppercase text-ink outline-none placeholder:normal-case placeholder:text-ink-3 focus:border-accent focus:ring-2 focus:ring-accent/20"
      />
    </form>
  );

  const priceBar = (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
      <div className="w-36">{searchBox}</div>
      <div className="flex items-baseline gap-3">
        <h1 className="font-mono-nums text-[20px] font-semibold leading-none text-ink">{ticker}</h1>
        <span className={`font-mono-nums text-[20px] leading-none ${flash[ticker] === "up" ? "text-up" : flash[ticker] === "down" ? "text-down" : "text-ink"}`}>{usd(lastPrice)}</span>
        <span className={`font-mono-nums text-[13px] ${tone(change)}`}>
          {change != null ? `${change >= 0 ? "+" : "−"}${Math.abs(change).toFixed(2)}` : "—"} ({pct(changePct)})
        </span>
      </div>
      {stat("Open", usd(lastBar?.o ?? null), "text-ink-2")}
      {stat("High", usd(lastBar?.h ?? null), "text-ink-2")}
      {stat("Low", usd(lastBar?.l ?? null), "text-ink-2")}
      {stat("Prev close", usd(prevBar?.c ?? null), "text-ink-2")}
      {stat("Volume", vol(lastBar?.v), "text-ink-2")}
      {stat("52-week range", hi52 != null && lo52 != null ? `${lo52.toFixed(2)} – ${hi52.toFixed(2)}` : "—", "text-ink-2")}
      <span className="ml-auto flex items-center gap-4 text-[12px]">
        <span className="flex items-center gap-1.5 text-[11px] text-ink-3">
          <span className={`size-1.5 rounded-full ${state.open ? "bg-up" : "bg-ink-3"}`} aria-hidden="true" />
          {state.open ? "Market open" : "Market closed"}
        </span>
        <Link href={`/plan?t=${ticker}`} className="text-ink-2 hover:text-accent">
          Plan &amp; grade
        </Link>
        <Link href={`/symbol/${ticker}`} className="text-ink-2 hover:text-accent">
          Stock page
        </Link>
      </span>
    </div>
  );
  // The paper account, compact, at the top of the Trade panel.
  const accountBox = (
    <div className="rounded-lg border border-line bg-panel/60 p-2.5">
      <div className="flex items-center justify-between">
        <span className="rounded-md bg-accent-soft px-1.5 py-0.5 text-[11px] font-medium text-accent-ink">Paper account</span>
        <button type="button" onClick={reset} disabled={resetting} className="text-[11px] font-medium text-ink-3 transition hover:text-ink">
          {resetting ? "Resetting…" : "Reset to $25,000"}
        </button>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2">
        {stat("Account value", usd(state.equity))}
        {stat(
          "Total P&L",
          <>
            {signed(state.totalPnl)} <span className="text-[11px] font-normal">{pct(totalPct)}</span>
          </>,
          tone(state.totalPnl)
        )}
        {stat("Open P&L", signed(state.openPnl), tone(state.openPnl))}
        {stat("Cash", usd(state.cash))}
      </div>
    </div>
  );
  const accountBar = (
    <div className="flex flex-wrap items-center gap-x-7 gap-y-3">
      <div className="flex items-center gap-2">
        <span className="rounded-md bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent-ink">Paper</span>
        <span className="flex items-center gap-1.5 text-[11px] text-ink-3">
          <span className={`size-1.5 rounded-full ${state.open ? "bg-up" : "bg-ink-3"}`} aria-hidden="true" />
          {state.open ? "Market open" : "Market closed"}
        </span>
      </div>
      {stat("Account value", usd(state.equity))}
      {stat(
        "Total P&L",
        <>
          {signed(state.totalPnl)} <span className="text-[12px] font-normal">{pct(totalPct)}</span>
        </>,
        tone(state.totalPnl)
      )}
      {stat("Open P&L", signed(state.openPnl), tone(state.openPnl))}
      {stat("Cash", usd(state.cash))}
      {stat("Buying power", usd(state.cash), "text-ink-2")}
      <button type="button" onClick={reset} disabled={resetting} className="ml-auto rounded-md px-2.5 py-1 text-[12px] font-medium text-ink-3 transition hover:bg-panel-2 hover:text-ink">
        {resetting ? "Resetting…" : "Reset to $25,000"}
      </button>
    </div>
  );

  const symbolHead = (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pb-2">
      <h1 className="font-mono-nums text-[22px] font-semibold leading-none text-ink">{ticker}</h1>
      <span className={`font-mono-nums text-[17px] ${flash[ticker] === "up" ? "text-up" : flash[ticker] === "down" ? "text-down" : "text-ink"}`}>{usd(q?.price ?? null)}</span>
      <span className={`font-mono-nums text-[13px] ${tone(q?.changePct ?? null)}`}>{pct(q?.changePct ?? null)}</span>
      <span className="ml-auto flex gap-3 text-[12px]">
        <Link href={`/plan?t=${ticker}`} className="text-ink-2 hover:text-accent">
          Plan &amp; grade
        </Link>
        <Link href={`/symbol/${ticker}`} className="text-ink-2 hover:text-accent">
          Stock page
        </Link>
      </span>
    </div>
  );

  const ticket = (
    <div className="flex flex-col gap-2">
      <OrderTicket key={`${target.symbol}:${target.side}`} target={target} cash={state.cash} budget={budget} open={state.open} onDone={refresh} />
      {pick && (
        <button type="button" onClick={() => setPick(null)} className="text-left text-[12px] text-ink-3 hover:text-ink">
          ← Trade {ticker} shares instead
        </button>
      )}
    </div>
  );


  const watchRows = (
    <ul className="py-1">
      {list.map((t) => {
        const lq = quotes[t];
        const on = t === ticker;
        return (
          <li key={t}>
            <button type="button" onClick={() => select(t)} className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left transition ${on ? "bg-panel-3" : "hover:bg-panel-2"}`}>
              <span className={`font-mono-nums text-[13px] font-semibold ${on ? "text-accent-ink" : "text-ink"}`}>{t}</span>
              <span className="text-right font-mono-nums text-[12px] leading-tight">
                <span className={`block ${flash[t] === "up" ? "text-up" : flash[t] === "down" ? "text-down" : "text-ink-2"}`}>{lq ? lq.price.toFixed(2) : "—"}</span>
                <span className={`block text-[11px] ${tone(lq?.changePct ?? null)}`}>{pct(lq?.changePct ?? null)}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );

  const ideasPanel = (
    <section className="rounded-xl border border-line bg-panel p-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[13px] font-medium text-ink">Today&apos;s ideas</h2>
        <Link href="/ideas" className="text-[12px] text-accent hover:underline">
          All →
        </Link>
      </div>
      {ideas.length === 0 ? (
        <p className="mt-2 text-[12px] text-ink-3">The next ideas land before the open.</p>
      ) : (
        <ul className="mt-2 divide-y divide-line">
          {ideas.map((i) => (
            <li key={i.id} className="py-2">
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => select(i.ticker)} className="font-mono-nums text-[13px] font-semibold text-ink hover:text-accent">
                  {i.ticker}
                </button>
                <span className={`text-[11px] ${i.direction === "long" ? "text-up" : "text-down"}`}>{i.direction === "long" ? "Long" : "Short"}</span>
                <Link href={`/ideas/${i.id}`} className="ml-auto text-[11px] text-ink-3 hover:text-ink">
                  Open
                </Link>
              </div>
              <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-ink-2">{i.headline}</p>
              {i.option && <p className="mt-0.5 font-mono-nums text-[11px] text-ink-3">{i.option}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  const lessonPanel = lesson && (
    <section className="rounded-xl border border-line bg-panel p-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[13px] font-medium text-ink">Keep learning</h2>
        <span className="font-mono-nums text-[11px] text-ink-3">
          {lesson.done}/{lesson.total}
        </span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-panel-2" aria-hidden="true">
        <div className="h-full rounded-full bg-accent" style={{ width: `${Math.round((lesson.done / Math.max(1, lesson.total)) * 100)}%` }} />
      </div>
      <p className="mt-2 text-[11px] text-ink-3">{lesson.label}</p>
      <Link href={lesson.href} className="mt-0.5 block text-[13px] font-medium text-ink hover:text-accent">
        {lesson.title} →
      </Link>
    </section>
  );

  const disclaimer = (
    <>
      Paper trading with practice money: nothing here is a real order or investment advice. Stocks fill at the live price.{" "}
      {state.optionPrices === "quote" ? "Options fill at the 15-minute-delayed bid and ask." : "Options fill at estimated prices from the live stock price and each contract's implied volatility, marked est."}
    </>
  );

  // ---- Wide: the full-screen chart with floating panels ---------------------------------------------------------------

  if (wide) {
    // Ben, 2026-11-18: "Put options chain on the right and execution box above it". The right column runs the full
    // height: the ticket, then the chain filling the rest. Positions and today's ideas are a panel toggled over the
    // chart from the buttons at its foot ("Get rid of the positions and make it a toggle-over"), so the chart keeps the
    // whole height.
    const SIDE = 452;
    // Ben, 2026-11-18: "Remove the left side watchlist panel altogether, and abut the chart to the left side… Watchlist
    // should be its own tab": the chart starts at the left edge; the watchlist is a tab at its foot.
    const leftEdge = 12;
    const rightEdge = panels.side ? SIDE + 24 : 56;
    const working = state.orders.filter((o) => o.status === "working").length;
    return (
      <div className="fixed bottom-0 left-60 right-0 top-14 z-20 flex flex-col bg-bg">
        <div className="border-b border-line px-4 py-2.5">{priceBar}</div>
        <div className="relative min-h-0 flex-1">
          {/* The chart fills the room the open panels leave. */}
          <div
            className="absolute inset-0 flex flex-col pt-3 transition-[padding] duration-300 ease-out"
            style={{ paddingLeft: leftEdge, paddingRight: rightEdge, paddingBottom: 56 }}
          >
            <div className="min-h-0 flex-1">
              <HighStrikeChart ticker={ticker} userId={userId} fill />
            </div>
          </div>

          {/* Right, full height: the order ticket, and the option chain under it */}
          {panels.side ? (
            <aside className={`${FLOAT} absolute bottom-3 right-3 top-3 flex flex-col overflow-hidden`} style={{ width: SIDE }}>
              <div className="flex items-center justify-between border-b border-line px-3 py-2">
                <h2 className="text-[13px] font-medium text-ink">Trade</h2>
                <PanelButton label="Hide the trade panel" onClick={() => toggle("side")} d="M9 6l6 6-6 6" />
              </div>
              <div className="max-h-[70%] flex-none space-y-2 overflow-y-auto p-2">
                {accountBox}
                {ticket}
              </div>
              <div className="flex min-h-0 flex-1 flex-col border-t border-line">
                <p className="px-3 pt-2 text-[13px] font-medium text-ink">
                  Option chain <span className="font-mono-nums text-ink-3">{ticker}</span>
                </p>
                <div className="min-h-0 flex-1">
                  <OptionChain ticker={ticker} picked={pick?.contract ?? null} onPick={choose} fill />
                </div>
              </div>
            </aside>
          ) : (
            <EdgeTab label="Trade" className="right-3 top-3" onClick={() => toggle("side")} d="M15 6l-6 6 6 6" />
          )}

          {/* The toggles at the chart's foot, and the panel they open over it: watchlist, positions and orders, today's ideas */}
          <div className="absolute bottom-3 flex gap-1.5 transition-[left] duration-300 ease-out" style={{ left: leftEdge }}>
            {(
              [
                ["watch", "Watchlist"],
                ["account", `Positions ${state.positions.length}${working ? ` · ${working} working` : ""}`],
                ["ideas", `Today's ideas ${ideas.length}`],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                aria-pressed={over === k}
                onClick={() => setOver((o) => (o === k ? null : k))}
                className={`${FLOAT} px-3 py-1.5 text-[13px] font-medium transition ${over === k ? "text-ink ring-1 ring-inset ring-accent/50" : "text-ink-2 hover:text-ink"}`}
              >
                {label}
              </button>
            ))}
          </div>
          {over && (
            <section
              className={`${FLOAT} anim-pop absolute bottom-14 flex flex-col overflow-hidden transition-[left,right] duration-300 ease-out`}
              style={{ left: leftEdge, right: rightEdge, height: "min(46vh, 460px)" }}
              aria-label={over === "watch" ? "Watchlist" : over === "account" ? "Positions and orders" : "Today's ideas"}
            >
              <div className="flex h-10 flex-none items-center gap-2 border-b border-line px-3">
                <h2 className="text-[13px] font-medium text-ink">{over === "watch" ? "Watchlist" : over === "account" ? "Positions and orders" : "Today's ideas"}</h2>
                {over === "watch" && (
                  <Link href="/watchlists" className="text-[12px] text-ink-3 hover:text-ink">
                    Edit lists
                  </Link>
                )}
                <p className="ml-auto hidden max-w-[60%] truncate text-[11px] text-ink-3 2xl:block">{disclaimer}</p>
                <PanelButton label="Close" onClick={() => setOver(null)} d="M6 6l12 12M18 6L6 18" />
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {over === "watch" ? (
                  <ul className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-1.5 p-2">
                    {list.map((t) => {
                      const lq = quotes[t];
                      const on = t === ticker;
                      return (
                        <li key={t}>
                          <button
                            type="button"
                            onClick={() => {
                              select(t);
                              setOver(null);
                            }}
                            className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left transition ${on ? "border-accent/50 bg-accent-soft" : "border-line bg-panel hover:border-line-strong hover:bg-panel-2"}`}
                          >
                            <span className={`font-mono-nums text-[13px] font-semibold ${on ? "text-accent-ink" : "text-ink"}`}>{t}</span>
                            <span className="text-right font-mono-nums text-[12px] leading-tight">
                              <span className={`block ${flash[t] === "up" ? "text-up" : flash[t] === "down" ? "text-down" : "text-ink-2"}`}>{lq ? lq.price.toFixed(2) : "—"}</span>
                              <span className={`block text-[11px] ${tone(lq?.changePct ?? null)}`}>{pct(lq?.changePct ?? null)}</span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : over === "account" ? (
                  <Blotter state={state} onSelect={select} onChange={refresh} />
                ) : (
                  <div className="grid gap-2 p-2 lg:grid-cols-[minmax(0,1fr)_280px]">
                    {ideasPanel}
                    {lessonPanel}
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    );
  }

  // ---- Small screens: stacked ------------------------------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-3">
      <section className="rounded-xl border border-line bg-panel px-4 py-3">{accountBar}</section>
      <section className="rounded-xl border border-line bg-panel p-3">
        {symbolHead}
        <HighStrikeChart ticker={ticker} userId={userId} height={320} />
      </section>
      {ticket}
      <OptionChain ticker={ticker} picked={pick?.contract ?? null} onPick={setPick} />
      <Blotter state={state} onSelect={select} onChange={refresh} />
      <section className="rounded-xl border border-line bg-panel">
        <div className="flex items-baseline justify-between border-b border-line px-3 py-2">
          <h2 className="text-[13px] font-medium text-ink">Watchlist</h2>
          <Link href="/watchlists" className="text-[11px] text-ink-3 hover:text-ink">
            Edit
          </Link>
        </div>
        <div className="p-2">{searchBox}</div>
        {watchRows}
      </section>
      {ideasPanel}
      {lessonPanel}
      <p className="text-[11px] leading-relaxed text-ink-3">{disclaimer}</p>
    </div>
  );
}

function PanelButton({ label, onClick, d }: { label: string; onClick: () => void; d: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className="grid size-7 place-items-center rounded-md text-ink-3 transition hover:bg-panel-3 hover:text-ink">
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={d} />
      </svg>
    </button>
  );
}

/** A collapsed panel: a small tab on the chart's edge that opens it again. */
function EdgeTab({ label, className, onClick, d }: { label: string; className: string; onClick: () => void; d: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${FLOAT} absolute flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium text-ink-2 transition hover:text-ink ${className}`}
    >
      <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={d} />
      </svg>
      {label}
    </button>
  );
}
