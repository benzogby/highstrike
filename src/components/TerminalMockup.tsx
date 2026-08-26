// The HighStrike AI Terminal "weather report" card. When the homepage passes
// a real published report it renders live values; otherwise it falls back to
// illustrative gauges with a client-side current date.

import { NowDateLong } from "@/components/Now";
import Gauge from "@/components/Gauge";

// Re-exported so existing `import { Gauge } from "@/components/TerminalMockup"`
// call sites keep working after the animated extraction.
export { default as Gauge } from "@/components/Gauge";

export type PublicReport = {
  volatility: number;
  opportunity: number;
  direction: number;
  summary: string;
  dateLabel: string;
};


const snapshot = [
  { symbol: "S&P 500", note: "Grinding higher into month-end", dir: "up" as const },
  { symbol: "QQQ", note: "Leadership rotating back to megacaps", dir: "up" as const },
  { symbol: "VIX", note: "Compressing — supportive of longs", dir: "down" as const },
];

export default function TerminalMockup({ report }: { report?: PublicReport | null }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-panel card-shadow">
      {/* window chrome */}
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-line-strong" aria-hidden="true" />
          <span className="h-2.5 w-2.5 rounded-full bg-line-strong" aria-hidden="true" />
          <span className="h-2.5 w-2.5 rounded-full bg-line-strong" aria-hidden="true" />
        </div>
        <span className="font-display text-xs font-semibold tracking-wide text-ink-2">
          HighStrike AI Terminal
        </span>
        {report ? (
          <span className="flex items-center gap-1.5 font-mono-nums text-xs text-accent">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" aria-hidden="true" />
            LIVE
          </span>
        ) : (
          <span className="font-mono-nums text-xs text-ink-3">PREVIEW</span>
        )}
      </div>

      <div className="p-6">
        <p className="font-display text-lg font-semibold">
          {report ? report.dateLabel : <NowDateLong />}
        </p>
        <p className="mt-0.5 text-xs text-ink-3">
          {report
            ? "Today's published AI Weather Report — this is the real one"
            : "Today's HighStrike AI Weather Report"}
        </p>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Gauge label="Volatility" value={report?.volatility ?? 82} />
          <Gauge label="Opportunity" value={report?.opportunity ?? 55} />
          <Gauge label="Direction" value={report?.direction ?? 35} />
        </div>

        {report?.summary && (
          <p className="mt-4 rounded-xl border border-line bg-panel-2 px-4 py-3 text-sm leading-relaxed text-ink-2">
            {report.summary}
          </p>
        )}

        <p className="mt-6 text-[11px] uppercase tracking-wider text-ink-3">
          Market snapshot
        </p>
        <div className="mt-2 divide-y divide-line rounded-xl border border-line">
          {snapshot.map((s) => (
            <div key={s.symbol} className="flex items-center justify-between px-4 py-2.5">
              <span className="font-display text-sm font-semibold">{s.symbol}</span>
              <span className="hidden text-xs text-ink-2 sm:block">{s.note}</span>
              <span
                className={`font-mono-nums text-xs ${s.dir === "up" ? "text-up" : "text-down"}`}
              >
                {s.dir === "up" ? "▲" : "▼"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
