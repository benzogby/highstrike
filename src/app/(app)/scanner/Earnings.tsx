import type { EarningsRow, StockRow } from "@/lib/scan/types";
import { CARD } from "@/components/ui";
import { PlanIt, TickerLink, pct, price, tone, weekday } from "./fmt";

/** The next two weeks' earnings among the scanner's names, by day, with the move priced in and the IV-crush warning. */
export default function Earnings({ rows, stocks }: { rows: EarningsRow[]; stocks: Map<string, StockRow> }) {
  const days = new Map<string, EarningsRow[]>();
  for (const r of rows) days.set(r.date, [...(days.get(r.date) ?? []), r]);
  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-3xl text-sm leading-relaxed text-ink-2">
        Earnings can gap a stock past any stop, and options lose value the moment the news is out (IV crush). The expected move is what options price in for the week; a trade needs the stock to move more
        than that to pay.
      </p>
      {rows.length === 0 && <p className={`${CARD} px-4 py-8 text-center text-sm text-ink-3`}>No earnings among the scanner&apos;s names in the next two weeks.</p>}
      {[...days.entries()].map(([d, list]) => (
        <section key={d} className={`${CARD} p-4`}>
          <h3 className="text-[15px] font-medium text-ink">
            {weekday(d)} <span className="text-ink-3">· {list.length}</span>
          </h3>
          <ul className="mt-2 divide-y divide-line">
            {list.map((r) => {
              const s = stocks.get(r.t);
              return (
                <li key={r.t} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                  <span className="w-14">
                    <TickerLink t={r.t} />
                  </span>
                  <span className="w-24 text-xs text-ink-3">{r.hour ?? "time not set"}</span>
                  <span className="w-20 font-mono-nums text-ink-2">{price(s?.price ?? null)}</span>
                  <span className={`w-16 font-mono-nums text-xs ${tone(s?.chg ?? null)}`}>{pct(s?.chg ?? null)}</span>
                  <span className="min-w-0 flex-1 font-mono-nums text-xs text-ink-2">
                    {r.movePct != null ? (
                      <>
                        ±{r.movePct.toFixed(1)}% <span className="text-ink-3">{r.moveFrom === "options" ? "priced in" : "typical 2-day move"}</span>
                      </>
                    ) : (
                      "—"
                    )}
                    {r.eps != null && <span className="ml-3 text-ink-3">EPS est. {r.eps.toFixed(2)}</span>}
                  </span>
                  <PlanIt t={r.t} side={(s?.mom5 ?? 0) >= 0 ? "long" : "short"} />
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
