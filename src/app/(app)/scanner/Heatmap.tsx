import Link from "next/link";
import type { StockRow } from "@/lib/scan/types";
import { SECTOR_ORDER } from "@/lib/scan/sectors";
import { pct, big, tone } from "./fmt";

/** A tile's colour from its move: deeper green or red the bigger it is. */
function heat(n: number | null) {
  if (n == null) return "bg-panel-2 text-ink-3";
  if (n >= 3) return "bg-up/70 text-white";
  if (n >= 1.5) return "bg-up/45 text-ink";
  if (n >= 0.4) return "bg-up/20 text-ink";
  if (n > -0.4) return "bg-panel-3 text-ink-2";
  if (n > -1.5) return "bg-down/20 text-ink";
  if (n > -3) return "bg-down/45 text-ink";
  return "bg-down/70 text-white";
}

/**
 * The market at a glance: every name in its group, the busiest biggest, coloured by the move (today, or over 5 days).
 * A group's own move is its names' moves weighted by dollars traded.
 */
export default function Heatmap({ stocks, by }: { stocks: StockRow[]; by: "today" | "5d" }) {
  const move = (s: StockRow) => (by === "5d" ? s.mom5 : s.chg);
  const groups = new Map<string, StockRow[]>();
  for (const s of stocks) groups.set(s.sector, [...(groups.get(s.sector) ?? []), s]);
  const allDollars = stocks.map((s) => s.dollarVol ?? 0).sort((a, b) => b - a);
  const cut = (q: number) => allDollars[Math.floor(allDollars.length * q)] ?? 0;
  const [top, mid] = [cut(0.06), cut(0.25)];
  const order = [...SECTOR_ORDER, "Other"].filter((g) => groups.has(g));

  const legend = [-3, -1.5, -0.4, 0, 0.4, 1.5, 3];
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Colour by" className="flex gap-1 rounded-lg bg-bg p-1">
          {(["today", "5d"] as const).map((k) => (
            <Link
              key={k}
              href={`/scanner?tab=heatmap${k === "5d" ? "&by=5d" : ""}`}
              className={`rounded-md px-3 py-1 text-[13px] font-medium transition ${by === k ? "bg-panel-3 text-ink ring-1 ring-inset ring-line-strong" : "text-ink-3 hover:text-ink"}`}
            >
              {k === "today" ? "Today" : "5 days"}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-1 text-[11px] text-ink-3" aria-label="Colour key">
          {legend.map((n) => (
            <span key={n} className={`rounded px-1.5 py-0.5 font-mono-nums ${heat(n === 0 ? 0 : n)}`}>
              {n === 0 ? "0" : `${n > 0 ? "+" : ""}${n}%`}
            </span>
          ))}
          <span className="ml-2">Bigger tile: more dollars traded</span>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {order.map((g) => {
          const list = [...groups.get(g)!].sort((a, b) => (b.dollarVol ?? 0) - (a.dollarVol ?? 0));
          const w = list.reduce((a, s) => a + (s.dollarVol ?? 0), 0);
          const avg = w > 0 ? list.reduce((a, s) => a + (move(s) ?? 0) * (s.dollarVol ?? 0), 0) / w : null;
          return (
            <section key={g} className="rounded-xl border border-line bg-panel p-3">
              <h3 className="flex items-baseline justify-between gap-2 text-[13px]">
                <span className="font-medium text-ink">{g}</span>
                <span className="font-mono-nums text-xs">
                  <span className={tone(avg)}>{pct(avg)}</span>
                  <span className="text-ink-3"> · {big(w)}</span>
                </span>
              </h3>
              <div className="mt-2 grid grid-flow-dense auto-rows-[46px] grid-cols-[repeat(auto-fill,minmax(58px,1fr))] gap-1">
                {list.map((s) => {
                  const d = s.dollarVol ?? 0;
                  const size = d >= top ? "col-span-2 row-span-2" : d >= mid ? "col-span-2" : "";
                  const m = move(s);
                  return (
                    <Link
                      key={s.t}
                      href={`/symbol/${s.t}`}
                      title={`${s.t} ${pct(m, 2)} · $${s.price} · ${big(s.dollarVol)} traded`}
                      className={`flex flex-col items-center justify-center rounded-md px-1 text-center transition hover:ring-2 hover:ring-ink/40 ${size} ${heat(m)}`}
                    >
                      <span className={`font-mono-nums font-semibold leading-none ${size.includes("row-span-2") ? "text-[15px]" : "text-[12px]"}`}>{s.t}</span>
                      <span className={`mt-1 font-mono-nums leading-none ${size.includes("row-span-2") ? "text-[13px]" : "text-[10px]"}`}>{pct(m)}</span>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
