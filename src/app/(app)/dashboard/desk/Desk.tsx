"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import HighStrikeChart from "@/components/chart/HighStrikeChart";
import { useQuotes } from "@/components/useQuotes";
import type { PaperState } from "@/lib/paper";
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

/**
 * Home, the trading desk (Ben, 2026-11-18: "the /dashboard page become the paper trading charts and execution hub"):
 * the paper account across the top; the watchlist down the left; the chart, the option chain and the positions in the
 * middle; the order ticket, today's ideas and the next lesson on the right. Dark, dense and HighStrike's own.
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

  const stat = (label: string, value: React.ReactNode, cls = "text-ink") => (
    <div className="min-w-0">
      <p className="text-[11px] text-ink-3">{label}</p>
      <p className={`mt-0.5 truncate font-mono-nums text-[15px] font-semibold ${cls}`}>{value}</p>
    </div>
  );
  const totalPct = state.start ? (state.totalPnl / state.start) * 100 : null;

  return (
    <div className="flex flex-col gap-3">
      {/* The account */}
      <section className="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-xl border border-line bg-panel px-4 py-3">
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
      </section>

      <div className="grid gap-3 xl:grid-cols-[210px_minmax(0,1fr)_320px]">
        {/* Middle: the symbol, the chart, the chain, the blotter */}
        <div className="order-1 flex min-w-0 flex-col gap-3 xl:order-2">
          <section className="rounded-xl border border-line bg-panel p-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1 pb-2">
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
            <HighStrikeChart ticker={ticker} userId={userId} height={360} />
          </section>
          {/* On a phone the ticket sits right under the chart; from xl it's in the right column. */}
          <div className="xl:hidden">{ticket}</div>
          <OptionChain ticker={ticker} picked={pick?.contract ?? null} onPick={setPick} />
          <Blotter state={state} onSelect={select} onChange={refresh} />
        </div>

        {/* Right: the ticket, today's ideas, the next lesson */}
        <div className="order-2 flex flex-col gap-3 xl:order-3">
          <div className="hidden xl:block">{ticket}</div>
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
          {lesson && (
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
          )}
        </div>

        {/* Left: find a symbol, and the watchlist */}
        <aside className="order-3 flex flex-col gap-3 xl:order-1">
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
              className="h-9 w-full rounded-lg border border-line-strong bg-bg px-3 font-mono-nums text-sm uppercase text-ink outline-none placeholder:normal-case placeholder:text-ink-3 focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </form>
          <section className="rounded-xl border border-line bg-panel">
            <div className="flex items-baseline justify-between border-b border-line px-3 py-2">
              <h2 className="text-[13px] font-medium text-ink">Watchlist</h2>
              <Link href="/watchlists" className="text-[11px] text-ink-3 hover:text-ink">
                Edit
              </Link>
            </div>
            <ul className="max-h-[640px] overflow-y-auto py-1">
              {list.map((t) => {
                const lq = quotes[t];
                const on = t === ticker;
                return (
                  <li key={t}>
                    <button
                      type="button"
                      onClick={() => select(t)}
                      className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left transition ${on ? "bg-panel-3" : "hover:bg-panel-2"}`}
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
          </section>
        </aside>
      </div>
      <p className="text-[11px] leading-relaxed text-ink-3">
        Paper trading with practice money: nothing here is a real order or investment advice. Stocks fill at the live price. {state.optionPrices === "quote" ? "Options fill at the 15-minute-delayed bid and ask." : "Options fill at estimated prices from the live stock price and each contract's implied volatility, marked est."}
      </p>
    </div>
  );
}
