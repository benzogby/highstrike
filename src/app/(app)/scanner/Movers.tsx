import type { StockRow } from "@/lib/scan/types";
import { CARD } from "@/components/ui";
import { PlanIt, TickerLink, count, pct, price, tone } from "./fmt";

type List = { title: string; why: string; rows: StockRow[]; side: (s: StockRow) => "long" | "short"; stat: (s: StockRow) => React.ReactNode };

/** Who's moving and why it might matter: the biggest moves, gaps, volume surges and 5-day runs, each one tap from a plan. */
export default function Movers({ stocks }: { stocks: StockRow[] }) {
  const by = (f: (s: StockRow) => number | null, dir: 1 | -1, n = 10) =>
    stocks
      .filter((s) => f(s) != null && (dir === 1 ? (f(s) as number) > 0 : (f(s) as number) < 0))
      .sort((a, b) => dir * ((f(b) as number) - (f(a) as number)))
      .slice(0, n);
  const lists: List[] = [
    { title: "Biggest gainers", why: "Up the most today. Strength can carry on, or fade by the close.", rows: by((s) => s.chg, 1), side: () => "long", stat: (s) => <span className={tone(s.chg)}>{pct(s.chg)}</span> },
    { title: "Biggest losers", why: "Down the most today. Weakness can carry on, or bounce.", rows: by((s) => s.chg, -1), side: () => "short", stat: (s) => <span className={tone(s.chg)}>{pct(s.chg)}</span> },
    {
      title: "Volume surges",
      why: "Trading far more than usual: something's going on. The move tells you which way.",
      rows: stocks.filter((s) => s.relVol != null && s.relVol >= 1.3).sort((a, b) => (b.relVol as number) - (a.relVol as number)).slice(0, 10),
      side: (s) => ((s.chg ?? 0) >= 0 ? "long" : "short"),
      stat: (s) => (
        <>
          <span className="text-ink">{s.relVol?.toFixed(1)}×</span> <span className={tone(s.chg)}>{pct(s.chg)}</span>
        </>
      ),
    },
    {
      title: "Gaps",
      why: "Opened well away from the last close. Gaps that hold often run; gaps that fill reverse.",
      rows: stocks.filter((s) => s.gap != null && Math.abs(s.gap) >= 1).sort((a, b) => Math.abs(b.gap as number) - Math.abs(a.gap as number)).slice(0, 10),
      side: (s) => ((s.gap ?? 0) >= 0 ? "long" : "short"),
      stat: (s) => (
        <>
          <span className={tone(s.gap)}>gap {pct(s.gap)}</span> <span className="text-ink-3">now {pct(s.chg)}</span>
        </>
      ),
    },
    { title: "5-day leaders", why: "The strongest run over a week: a trend to ride on a pullback.", rows: by((s) => s.mom5, 1), side: () => "long", stat: (s) => <span className={tone(s.mom5)}>{pct(s.mom5)}</span> },
    { title: "5-day laggards", why: "The weakest over a week: trends down, or stretched for a bounce.", rows: by((s) => s.mom5, -1), side: () => "short", stat: (s) => <span className={tone(s.mom5)}>{pct(s.mom5)}</span> },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
      {lists.map((l) => (
        <section key={l.title} className={`${CARD} p-4`}>
          <h3 className="text-[15px] font-medium text-ink">{l.title}</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-ink-3">{l.why}</p>
          {l.rows.length === 0 ? (
            <p className="mt-4 text-sm text-ink-3">None right now.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {l.rows.map((s) => (
                <li key={s.t} className="flex items-center gap-3 py-2 text-sm">
                  <span className="w-14">
                    <TickerLink t={s.t} />
                  </span>
                  <span className="w-16 font-mono-nums text-ink-2">{price(s.price)}</span>
                  <span className="min-w-0 flex-1 truncate font-mono-nums text-xs">{l.stat(s)}</span>
                  <span className="hidden font-mono-nums text-xs text-ink-3 sm:inline">{count(s.vol)}</span>
                  <PlanIt t={s.t} side={l.side(s)} />
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
