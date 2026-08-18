// Illustrative mockup of a published setup card in the terminal.

const rows = [
  { field: "Direction", value: "Long", accent: false },
  { field: "Justification", value: "Q4 Earnings Momentum", accent: false },
  { field: "Entry criteria", value: "3 triggers", accent: false },
  { field: "Price target", value: "$345.00", accent: true },
  { field: "Time frame", value: "3–4 days", accent: false },
];

const flags = [
  { label: "Social chatter", value: "Bullish" },
  { label: "Insider activity", value: "2 flags" },
  { label: "Unusual options", value: "5 flags" },
];

const contracts = ["Mar 28 $340C", "Mar 28 $345C", "Apr 4 $340C", "Apr 4 $350C"];

export default function SetupCardMockup() {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl shadow-black/50">
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <div className="flex items-center gap-3">
          <span className="rounded-md bg-accent px-2 py-0.5 font-display text-xs font-bold text-bg">
            SETUP
          </span>
          <span className="font-display text-sm font-semibold">$MCD · McDonald&apos;s Corp</span>
        </div>
        <span className="font-mono-nums text-xs text-ink-3">08:47 ET</span>
      </div>

      <dl className="divide-y divide-line">
        {rows.map((r) => (
          <div key={r.field} className="flex items-center justify-between px-5 py-2.5">
            <dt className="text-xs uppercase tracking-wider text-ink-3">{r.field}</dt>
            <dd
              className={`font-mono-nums text-sm ${r.accent ? "text-accent" : "text-ink"}`}
            >
              {r.value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="grid grid-cols-3 gap-px border-t border-line bg-line">
        {flags.map((f) => (
          <div key={f.label} className="bg-panel-2 px-4 py-3">
            <p className="text-[10px] uppercase tracking-wider text-ink-3">{f.label}</p>
            <p className="mt-0.5 font-mono-nums text-sm text-ink">{f.value}</p>
          </div>
        ))}
      </div>

      <div className="border-t border-line px-5 py-3.5">
        <p className="text-[10px] uppercase tracking-wider text-ink-3">
          Suggested contracts
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {contracts.map((c) => (
            <span
              key={c}
              className="rounded-md border border-line bg-panel-2 px-2.5 py-1 font-mono-nums text-xs text-ink-2"
            >
              {c}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
