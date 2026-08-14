// Deterministic product-mockup chart for the hero. Data is seeded (not random)
// so server and client render identical markup.

function seededSeries(seed: number, n: number, start: number, drift: number, vol: number) {
  let s = seed;
  const rand = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
  const out: number[] = [start];
  for (let i = 1; i < n; i++) {
    out.push(out[i - 1] + drift + (rand() - 0.48) * vol);
  }
  return out;
}

const W = 640;
const H = 280;
const PAD = { top: 16, right: 56, bottom: 24, left: 8 };

const series = seededSeries(42, 90, 182, 0.28, 3.4);

function toPath(vals: number[]) {
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const x = (i: number) =>
    PAD.left + (i / (vals.length - 1)) * (W - PAD.left - PAD.right);
  const y = (v: number) =>
    PAD.top + (1 - (v - min) / (max - min)) * (H - PAD.top - PAD.bottom);
  const line = vals.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const area = `${line}L${x(vals.length - 1).toFixed(1)},${H - PAD.bottom}L${PAD.left},${H - PAD.bottom}Z`;
  return { line, area, lastX: x(vals.length - 1), lastY: y(vals[vals.length - 1]) };
}

const { line, area, lastX, lastY } = toPath(series);
const last = series[series.length - 1];
const first = series[0];
const changePct = ((last - first) / first) * 100;

const gridYs = [0.2, 0.4, 0.6, 0.8].map(
  (f) => PAD.top + f * (H - PAD.top - PAD.bottom)
);

const stats = [
  { label: "RSI (14)", value: "61.4" },
  { label: "Rel volume", value: "1.8×" },
  { label: "Flow score", value: "87" },
  { label: "IV rank", value: "34%" },
];

export default function HeroChart() {
  return (
    <div className="rounded-2xl border border-line bg-panel shadow-2xl shadow-black/50 overflow-hidden">
      {/* window chrome */}
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="font-display text-sm font-semibold tracking-wide">NVDA</span>
          <span className="text-xs text-ink-3">NVIDIA Corp · NASDAQ</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-mono-nums text-sm">{last.toFixed(2)}</span>
          <span className="font-mono-nums text-xs text-up">
            ▲ {changePct.toFixed(2)}%
          </span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block w-full"
        role="img"
        aria-label={`Illustrative NVDA price chart, up ${changePct.toFixed(1)} percent over the period`}
      >
        {gridYs.map((gy) => (
          <line
            key={gy}
            x1={PAD.left}
            x2={W - PAD.right}
            y1={gy}
            y2={gy}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="1"
          />
        ))}
        <path d={area} fill="rgba(163,230,53,0.10)" />
        <path
          d={line}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* end marker: 8px dot with a 2px surface ring */}
        <circle cx={lastX} cy={lastY} r="6" fill="var(--color-panel)" />
        <circle cx={lastX} cy={lastY} r="4" fill="var(--color-accent)" />
        <text
          x={lastX + 10}
          y={lastY + 4}
          fill="var(--color-ink-2)"
          fontSize="12"
          className="font-mono-nums"
        >
          {last.toFixed(0)}
        </text>
      </svg>

      {/* stat row */}
      <div className="grid grid-cols-2 gap-px border-t border-line bg-line sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-panel px-5 py-3">
            <div className="text-[11px] uppercase tracking-wider text-ink-3">{s.label}</div>
            <div className="mt-0.5 font-mono-nums text-sm text-ink">{s.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
