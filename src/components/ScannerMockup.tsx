// Illustrative mockup of the flow scanner view in the terminal.

const rows = [
  { ticker: "NVDA", flow: 91, relVol: "2.4×", unusual: 7, dir: "up" as const },
  { ticker: "DELL", flow: 87, relVol: "3.1×", unusual: 5, dir: "up" as const },
  { ticker: "MCD", flow: 84, relVol: "1.8×", unusual: 5, dir: "up" as const },
  { ticker: "SMCI", flow: 78, relVol: "2.7×", unusual: 4, dir: "up" as const },
  { ticker: "XOM", flow: 41, relVol: "0.9×", unusual: 1, dir: "down" as const },
];

export default function ScannerMockup() {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-panel card-shadow">
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <span className="font-display text-sm font-semibold">Flow Scanner</span>
        <span className="flex items-center gap-1.5 text-xs text-ink-3">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" aria-hidden="true" />
          Scanning 5,400 symbols
        </span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-[10px] uppercase tracking-wider text-ink-3">
            <th className="px-5 py-2.5 font-medium">Ticker</th>
            <th className="px-3 py-2.5 text-right font-medium">Flow score</th>
            <th className="hidden px-3 py-2.5 text-right font-medium sm:table-cell">Rel vol</th>
            <th className="hidden px-3 py-2.5 text-right font-medium sm:table-cell">Unusual</th>
            <th className="px-5 py-2.5 text-right font-medium">Bias</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <tr key={r.ticker}>
              <td className="px-5 py-2.5 font-display font-semibold">{r.ticker}</td>
              <td className="px-3 py-2.5 text-right">
                <span className="inline-flex items-center gap-2">
                  <span
                    className="h-1.5 w-14 overflow-hidden rounded-full bg-panel-2"
                    aria-hidden="true"
                  >
                    <span
                      className="block h-full rounded-full bg-accent"
                      style={{ width: `${r.flow}%` }}
                    />
                  </span>
                  <span className="font-mono-nums text-ink">{r.flow}</span>
                </span>
              </td>
              <td className="hidden px-3 py-2.5 text-right font-mono-nums text-ink-2 sm:table-cell">
                {r.relVol}
              </td>
              <td className="hidden px-3 py-2.5 text-right font-mono-nums text-ink-2 sm:table-cell">
                {r.unusual}
              </td>
              <td
                className={`px-5 py-2.5 text-right font-mono-nums ${
                  r.dir === "up" ? "text-up" : "text-down"
                }`}
              >
                {r.dir === "up" ? "▲ Long" : "▼ Short"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-line bg-panel-2 px-5 py-2.5 text-[10px] uppercase tracking-wider text-ink-3">
        Illustrative view
      </p>
    </div>
  );
}
