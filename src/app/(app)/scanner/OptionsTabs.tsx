import Link from "next/link";
import type { OptionRow, TickerOptions } from "@/lib/scan/types";
import { Badge, CARD } from "@/components/ui";
import { PlanIt, TickerLink, big, contractLabel, count, day, pct, price } from "./fmt";

const sideOf = (r: OptionRow) => (r.type === "call" ? "long" : "short") as "long" | "short";
const chip = (on: boolean) => `whitespace-nowrap rounded-md px-2.5 py-1 text-[13px] font-medium transition ${on ? "bg-panel-2 text-ink ring-1 ring-inset ring-line-strong" : "text-ink-3 hover:text-ink"}`;

/** When the Massive plan has no option chains: what's missing, and (for an admin) how to switch it on. */
export function NoOptions({ admin }: { admin: boolean }) {
  return (
    <div className={`${CARD} px-6 py-10 text-center`}>
      <p className="font-display text-lg text-ink">Options data is being switched on</p>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-ink-2">
        Hot contracts, unusual flow and implied volatility come from every option chain, refreshed every 5 minutes. Heatmap, Movers and Earnings work now.
      </p>
      {admin && (
        <p className="mx-auto mt-4 max-w-lg rounded-lg border border-warn/30 bg-warn-soft px-4 py-3 text-left text-sm text-ink-2">
          <b className="text-ink">Admin:</b> upgrade the Massive account (massive.com → Billing) to <b className="text-ink">Options Starter</b> (and Stocks Starter for 15-minute stock prices across the whole
          heatmap). The same key works; these tabs fill in within 6 hours, or at the next refresh after the plan check.
        </p>
      )}
    </div>
  );
}

type Filters = { type?: string; dte?: string };

/** The most traded contracts right now, filterable by calls or puts and by time to expiry. */
export function HotContracts({ rows, byTicker, f }: { rows: OptionRow[]; byTicker: TickerOptions[]; f: Filters }) {
  const type = f.type === "call" || f.type === "put" ? f.type : null;
  const dte = f.dte === "7" || f.dte === "30" ? Number(f.dte) : null;
  const list = rows.filter((r) => (!type || r.type === type) && (dte == null || r.dte <= dte)).slice(0, 60);
  const link = (patch: Filters) => {
    const q = new URLSearchParams({ tab: "hot", ...(type ? { type } : {}), ...(dte ? { dte: String(dte) } : {}), ...patch } as Record<string, string>);
    for (const [k, v] of [...q.entries()]) if (!v) q.delete(k);
    return `/scanner?${q}`;
  };
  const busiest = [...byTicker].sort((a, b) => b.premium - a.premium).slice(0, 12);
  return (
    <div className="flex flex-col gap-6">
      <section>
        <h3 className="text-[15px] font-medium text-ink">Where the options money is</h3>
        <p className="mt-0.5 text-xs text-ink-3">Dollars traded in each name&apos;s options today, and whether it&apos;s mostly calls (betting up) or puts (betting down or hedging).</p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
          {busiest.map((b) => {
            const calls = b.callVol + b.putVol > 0 ? Math.round((b.callVol / (b.callVol + b.putVol)) * 100) : 50;
            return (
              <Link key={b.u} href={`/symbol/${b.u}`} className={`${CARD} block p-3 transition hover:border-line-strong`}>
                <p className="flex items-baseline justify-between">
                  <span className="font-mono-nums font-semibold text-ink">{b.u}</span>
                  <span className="font-mono-nums text-xs text-ink-2">{big(b.premium)}</span>
                </p>
                <div className="mt-2 flex h-1.5 overflow-hidden rounded-full" aria-label={`${calls}% calls`}>
                  <span className="bg-up" style={{ width: `${calls}%` }} />
                  <span className="flex-1 bg-down" />
                </div>
                <p className="mt-1 flex justify-between font-mono-nums text-[11px] text-ink-3">
                  <span>{calls}% calls</span>
                  <span>P/C {b.pcr?.toFixed(2) ?? "—"}</span>
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-[15px] font-medium text-ink">Hot contracts</h3>
          <div className="flex flex-wrap gap-1">
            <Link href={link({ type: "" })} className={chip(!type)}>Calls and puts</Link>
            <Link href={link({ type: "call" })} className={chip(type === "call")}>Calls</Link>
            <Link href={link({ type: "put" })} className={chip(type === "put")}>Puts</Link>
            <span className="mx-1 h-4 w-px self-center bg-line" />
            <Link href={link({ dte: "" })} className={chip(!dte)}>Up to 45 days</Link>
            <Link href={link({ dte: "30" })} className={chip(dte === 30)}>30 days</Link>
            <Link href={link({ dte: "7" })} className={chip(dte === 7)}>This week</Link>
          </div>
        </div>
        <div className={`${CARD} mt-3 overflow-x-auto`}>
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-3">
                <th className="px-3 py-2 font-medium">Contract</th>
                <th className="px-3 py-2 text-right font-medium">Price</th>
                <th className="px-3 py-2 text-right font-medium">Traded</th>
                <th className="px-3 py-2 text-right font-medium">Open</th>
                <th className="px-3 py-2 text-right font-medium" title="Volume today ÷ contracts already open">Vol/OI</th>
                <th className="px-3 py-2 text-right font-medium">$ traded</th>
                <th className="px-3 py-2 text-right font-medium" title="Implied volatility">IV</th>
                <th className="px-3 py-2 text-right font-medium" title="Roughly the chance it ends in the money">Delta</th>
                <th className="px-3 py-2 text-right font-medium">Out of money</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {list.map((r) => (
                <tr key={r.c} className="hover:bg-panel-2">
                  <td className="px-3 py-2">
                    <span className={`mr-2 inline-block size-2 rounded-full ${r.type === "call" ? "bg-up" : "bg-down"}`} aria-hidden="true" />
                    <span className="font-mono-nums text-ink">{contractLabel(r)}</span>
                    <span className="ml-2 text-xs text-ink-3">{r.dte}d</span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono-nums text-ink">{price(r.mid)}</td>
                  <td className="px-3 py-2 text-right font-mono-nums text-ink">{count(r.vol)}</td>
                  <td className="px-3 py-2 text-right font-mono-nums text-ink-2">{count(r.oi)}</td>
                  <td className={`px-3 py-2 text-right font-mono-nums ${r.volOi != null && r.volOi >= 2 ? "text-warn" : "text-ink-2"}`}>{r.volOi != null ? `${r.volOi.toFixed(1)}×` : "new"}</td>
                  <td className="px-3 py-2 text-right font-mono-nums text-ink-2">{big(r.premium)}</td>
                  <td className="px-3 py-2 text-right font-mono-nums text-ink-2">{r.iv != null ? `${Math.round(r.iv * 100)}%` : "—"}</td>
                  <td className="px-3 py-2 text-right font-mono-nums text-ink-2">{r.delta != null ? Math.abs(r.delta).toFixed(2) : "—"}</td>
                  <td className="px-3 py-2 text-right font-mono-nums text-ink-2">{pct(r.otm)}</td>
                  <td className="px-3 py-2 text-right">
                    <PlanIt t={r.u} side={sideOf(r)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.length === 0 && <p className="px-4 py-8 text-center text-sm text-ink-3">No contracts match.</p>}
        </div>
      </section>
    </div>
  );
}

/** Contracts trading far more than are open, with real money behind them, in plain sentences. */
export function UnusualFlow({ rows }: { rows: OptionRow[] }) {
  const calls = rows.filter((r) => r.type === "call").reduce((a, r) => a + (r.premium ?? 0), 0);
  const puts = rows.filter((r) => r.type === "put").reduce((a, r) => a + (r.premium ?? 0), 0);
  const share = calls + puts > 0 ? Math.round((calls / (calls + puts)) * 100) : 50;
  return (
    <div className="flex flex-col gap-4">
      <section className={`${CARD} p-4`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
          <span className="font-medium text-ink">Unusual money today</span>
          <span className="font-mono-nums text-xs">
            <span className="text-up">calls {big(calls)}</span> · <span className="text-down">puts {big(puts)}</span>
          </span>
        </div>
        <div className="mt-2 flex h-2 overflow-hidden rounded-full">
          <span className="bg-up" style={{ width: `${share}%` }} />
          <span className="flex-1 bg-down" />
        </div>
        <p className="mt-2 text-xs leading-relaxed text-ink-3">
          Unusual: at least twice as many contracts traded today as were open, 300 or more, and $50K or more spent. A buyer could be betting, hedging or closing; it shows where big money moved, not why.
        </p>
      </section>
      {rows.length === 0 && <p className={`${CARD} px-4 py-8 text-center text-sm text-ink-3`}>Nothing unusual yet today.</p>}
      <ul className="grid gap-3 lg:grid-cols-2">
        {rows.slice(0, 60).map((r) => (
          <li key={r.c} className={`${CARD} flex items-start gap-3 p-4`}>
            <span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${r.type === "call" ? "bg-up" : "bg-down"}`} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2">
                <TickerLink t={r.u} />
                <span className="font-mono-nums text-sm text-ink">
                  ${r.strike} {r.type}s · {day(r.expiry)}
                </span>
                <Badge tone={r.type === "call" ? "up" : "down"}>{r.type === "call" ? "Bullish bet" : "Bearish bet or hedge"}</Badge>
              </p>
              <p className="mt-1 text-sm leading-relaxed text-ink-2">
                <span className="font-mono-nums text-ink">{count(r.vol)}</span> traded against <span className="font-mono-nums">{count(r.oi)}</span> open (
                <span className="text-warn">{r.volOi?.toFixed(1)}×</span>), about <span className="font-mono-nums text-ink">{big(r.premium)}</span> at {price(r.mid)}. {Math.abs(r.otm).toFixed(1)}%{" "}
                {r.otm >= 0 ? "out of" : "in"} the money, {r.dte} days left{r.iv != null ? `, IV ${Math.round(r.iv * 100)}%` : ""}.
              </p>
            </div>
            <PlanIt t={r.u} side={sideOf(r)} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Whether each name's options are cheap or dear next to how much the stock actually moves, and the move they price in. */
export function IvTable({ rows, hv }: { rows: TickerOptions[]; hv: Map<string, number | null> }) {
  const list = rows.filter((r) => r.atmIv != null).sort((a, b) => (b.ivHv ?? 0) - (a.ivHv ?? 0));
  const read = (k: number | null) =>
    k == null ? { text: "—", cls: "text-ink-3" } : k >= 1.4 ? { text: "Expensive", cls: "text-down" } : k >= 1.15 ? { text: "Rich", cls: "text-warn" } : k <= 0.9 ? { text: "Cheap", cls: "text-up" } : { text: "Fair", cls: "text-ink-2" };
  return (
    <div className="flex flex-col gap-3">
      <p className="max-w-3xl text-sm leading-relaxed text-ink-2">
        Implied volatility (IV) is the yearly move option prices assume. Next to the stock&apos;s own recent moves it says whether options are cheap (good for buying) or expensive (spreads cost less, or sell
        premium). The expected move is what options price in by the expiry about a month out.
      </p>
      <div className={`${CARD} overflow-x-auto`}>
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-ink-3">
              <th className="px-3 py-2 font-medium">Stock</th>
              <th className="px-3 py-2 text-right font-medium">IV</th>
              <th className="px-3 py-2 text-right font-medium">Moved (20d)</th>
              <th className="px-3 py-2 text-right font-medium">IV ÷ moved</th>
              <th className="px-3 py-2 font-medium">Options are</th>
              <th className="px-3 py-2 text-right font-medium">Expected move</th>
              <th className="px-3 py-2 text-right font-medium">Put/call</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {list.map((r) => {
              const v = read(r.ivHv);
              const h = hv.get(r.u);
              return (
                <tr key={r.u} className="hover:bg-panel-2">
                  <td className="px-3 py-2">
                    <TickerLink t={r.u} />
                  </td>
                  <td className="px-3 py-2 text-right font-mono-nums text-ink">{Math.round((r.atmIv as number) * 100)}%</td>
                  <td className="px-3 py-2 text-right font-mono-nums text-ink-2">{h != null ? `${Math.round(h * 100)}%` : "—"}</td>
                  <td className="px-3 py-2 text-right font-mono-nums text-ink-2">{r.ivHv != null ? `${r.ivHv.toFixed(2)}×` : "—"}</td>
                  <td className={`px-3 py-2 font-medium ${v.cls}`}>{v.text}</td>
                  <td className="px-3 py-2 text-right font-mono-nums text-ink-2">
                    {r.movePct != null ? `±${r.movePct.toFixed(1)}%` : "—"}
                    {r.moveExpiry && <span className="ml-1 text-xs text-ink-3">by {day(r.moveExpiry)}</span>}
                  </td>
                  <td className="px-3 py-2 text-right font-mono-nums text-ink-2">{r.pcr?.toFixed(2) ?? "—"}</td>
                  <td className="px-3 py-2 text-right">
                    <PlanIt t={r.u} side="long" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
