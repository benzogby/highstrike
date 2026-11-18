import type { ScanSnapshot } from "@/lib/scan/types";
import Link from "next/link";
import { CARD, PageHeader } from "@/components/ui";
import ScannerTable from "./ScannerTable";
import Heatmap from "./Heatmap";
import Movers from "./Movers";
import Earnings from "./Earnings";
import RefreshNow from "./RefreshNow";
import { HotContracts, IvTable, NoOptions, UnusualFlow } from "./OptionsTabs";
import { PlanIt, big, contractLabel, day, pct, tone } from "./fmt";


export const TABS = [
  { key: "heatmap", label: "Heatmap" },
  { key: "movers", label: "Movers" },
  { key: "hot", label: "Hot contracts" },
  { key: "unusual", label: "Unusual flow" },
  { key: "iv", label: "IV" },
  { key: "earnings", label: "Earnings" },
  { key: "setups", label: "Setups" },
] as const;
export type Tab = (typeof TABS)[number]["key"];

export type Query = { tab?: string; by?: string; type?: string; dte?: string };

const TIME = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" });

/**
 * The Scanner (Ben, 2026-11-18: "Create an awesome Scanner tab now. Subtabs Heatmap, hot contracts, unusual flow, etc.
 * Make it super comprehensive… really easy to read and get contract ideas from"): about 400 of the most traded options
 * names, refreshed every 5 minutes into one kept snapshot (src/lib/scan/build.ts). Every row is a tap from its chart and
 * from the Trade Planner.
 */
export default function ScannerView({ snap, tab, q, admin }: { snap: ScanSnapshot | null; tab: Tab; q: Query; admin: boolean }) {
  const header = (
    <PageHeader
      className="anim-rise"
      title="Scanner"
      subtitle="The most traded options names: where the market's moving, where the options money is going, and the contracts worth a look."
      actions={admin ? <RefreshNow /> : undefined}
    />
  );

  if (!snap || snap.stocks.length === 0) {
    return (
      <>
        {header}
        <p className={`${CARD} mt-8 px-6 py-12 text-center text-sm text-ink-2`}>The Scanner is gathering its first data. It refreshes every 5 minutes; check back shortly.</p>
      </>
    );
  }

  const stocks = new Map(snap.stocks.map((s) => [s.t, s]));
  const index = ["SPY", "QQQ", "IWM", "DIA"].map((t) => stocks.get(t)).filter((s) => s != null);
  const sectors = new Map<string, { w: number; m: number }>();
  for (const s of snap.stocks) {
    if (s.sector === "Indexes & ETFs" || s.chg == null || !s.dollarVol) continue;
    const g = sectors.get(s.sector) ?? { w: 0, m: 0 };
    sectors.set(s.sector, { w: g.w + s.dollarVol, m: g.m + s.chg * s.dollarVol });
  }
  const ranked = [...sectors.entries()].map(([g, v]) => ({ g, m: v.m / v.w })).sort((a, b) => b.m - a.m);
  const breadth = snap.breadth.up + snap.breadth.down > 0 ? Math.round((snap.breadth.up / (snap.breadth.up + snap.breadth.down)) * 100) : 50;
  const live = snap.stocksFrom !== "close";
  const asOf = snap.stocksFrom === "snapshot" ? `${TIME.format(new Date(snap.asOf))} ET, 15 min delayed` : snap.stocksFrom === "close+live" ? `${TIME.format(new Date(snap.asOf))} ET · live for the busiest names, last close for the rest` : `the close on ${day(snap.session)}`;
  const topFlow = snap.unusual[0];

  return (
    <>
      {header}

      {/* The read: indexes, breadth, the leading and lagging groups, the biggest unusual bet */}
      <section className="anim-rise mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4" style={{ "--rise-delay": "60ms" } as React.CSSProperties}>
        <div className={`${CARD} p-4`}>
          <p className="text-xs text-ink-3">Indexes</p>
          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
            {index.map((s) => (
              <Link key={s.t} href={`/symbol/${s.t}`} className="flex justify-between font-mono-nums text-sm hover:text-accent">
                <span className="text-ink">{s.t}</span>
                <span className={tone(s.chg)}>{pct(s.chg, 2)}</span>
              </Link>
            ))}
          </div>
        </div>
        <div className={`${CARD} p-4`}>
          <p className="flex justify-between text-xs text-ink-3">
            <span>Breadth</span>
            <span className="font-mono-nums">
              <span className="text-up">{snap.breadth.up} up</span> · <span className="text-down">{snap.breadth.down} down</span>
            </span>
          </p>
          <div className="mt-3 flex h-2 overflow-hidden rounded-full">
            <span className="bg-up" style={{ width: `${breadth}%` }} />
            <span className="flex-1 bg-down" />
          </div>
          <p className="mt-2 text-xs text-ink-2">{breadth >= 65 ? "Broad buying: most names are up." : breadth <= 35 ? "Broad selling: most names are down." : "Mixed: no clear side."}</p>
        </div>
        <div className={`${CARD} p-4`}>
          <p className="text-xs text-ink-3">Groups</p>
          {ranked.length > 0 && (
            <div className="mt-2 space-y-1 text-sm">
              {[ranked[0], ranked[1], ranked[ranked.length - 1]].filter(Boolean).map((r, i) => (
                <p key={r.g} className="flex justify-between gap-2">
                  <span className="truncate text-ink-2">
                    {i === 2 ? "Weakest: " : i === 0 ? "Strongest: " : ""}
                    {r.g}
                  </span>
                  <span className={`font-mono-nums ${tone(r.m)}`}>{pct(r.m)}</span>
                </p>
              ))}
            </div>
          )}
        </div>
        <div className={`${CARD} p-4`}>
          <p className="text-xs text-ink-3">Biggest unusual bet</p>
          {topFlow ? (
            <div className="mt-2 flex items-start justify-between gap-2">
              <div>
                <p className={`font-mono-nums text-sm ${topFlow.type === "call" ? "text-up" : "text-down"}`}>{contractLabel(topFlow)}</p>
                <p className="mt-1 text-xs text-ink-2">
                  {big(topFlow.premium)} traded, {topFlow.volOi?.toFixed(1)}× the open contracts
                </p>
              </div>
              <PlanIt t={topFlow.u} side={topFlow.type === "call" ? "long" : "short"} />
            </div>
          ) : (
            <p className="mt-2 text-xs text-ink-3">{snap.optionsFrom ? "Nothing unusual yet today." : "Comes with options data."}</p>
          )}
        </div>
      </section>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Scanner" className="-mx-1 flex gap-1 overflow-x-auto px-1">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={`/scanner?tab=${t.key}`}
              aria-current={tab === t.key ? "page" : undefined}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition ${tab === t.key ? "bg-panel-2 text-ink ring-1 ring-inset ring-line-strong" : "text-ink-3 hover:text-ink"}`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
        <p className="text-xs text-ink-3">
          <span className={`mr-1.5 inline-block size-1.5 rounded-full ${live ? "bg-up" : "bg-ink-3"}`} aria-hidden="true" />
          {snap.stocks.length} names · as of {asOf}
        </p>
      </div>

      <div className="mt-4">
        {tab === "heatmap" && <Heatmap stocks={snap.stocks} by={q.by === "5d" ? "5d" : "today"} />}
        {tab === "movers" && <Movers stocks={snap.stocks} />}
        {tab === "hot" && (snap.optionsFrom ? <HotContracts rows={snap.hot} byTicker={snap.byTicker} f={q} /> : <NoOptions admin={admin} />)}
        {tab === "unusual" && (snap.optionsFrom ? <UnusualFlow rows={snap.unusual} /> : <NoOptions admin={admin} />)}
        {tab === "iv" && (snap.optionsFrom ? <IvTable rows={snap.byTicker} hv={new Map(snap.stocks.map((s) => [s.t, s.hv20]))} /> : <NoOptions admin={admin} />)}
        {tab === "earnings" && <Earnings rows={snap.earnings} stocks={stocks} />}
        {tab === "setups" && <ScannerTable />}
      </div>

      {admin && snap.notes.length > 0 && <p className="mt-6 text-xs text-ink-3">Admin notes: {snap.notes.join(" ")}</p>}
      <p className="mt-8 text-xs leading-relaxed text-ink-3">
        Market data and education, not investment advice. Option activity shows where money moved, not why: a trade can be a bet, a hedge or a close. Plan any idea in the Trade Planner before you trade it.
      </p>
    </>
  );
}
