// An icon for every strategy criterion and contract setting (Ben, 2026-11-19: "Give each entry, contract, exit and stop
// criteria a unique red/white/green icon"). 20×20, drawn from a few shapes in the app's green, red and white.

const G = "var(--color-up)";
const R = "var(--color-down)";
const W = "var(--color-ink)";
const S = { fill: "none", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

/** A candle: body from top to bottom, wick from hi to lo. */
const candle = (x: number, hi: number, top: number, bottom: number, lo: number, c: string) => (
  <g key={`c${x}${top}`}>
    <line x1={x} x2={x} y1={hi} y2={lo} stroke={c} strokeWidth={1.2} />
    <rect x={x - 1.8} y={top} width={3.6} height={bottom - top} rx={0.6} fill={c} />
  </g>
);
const line = (d: string, c: string, extra: object = {}) => <path key={d} d={d} stroke={c} {...S} {...extra} />;
const dash = (y: number, c = W) => <line key={`d${y}`} x1={2} x2={18} y1={y} y2={y} stroke={c} strokeWidth={1.1} strokeDasharray="2 2" opacity={0.8} />;
const arrow = (x: number, y1: number, y2: number, c: string) => {
  const up = y2 < y1;
  return (
    <g key={`a${x}${y1}${y2}`}>
      <line x1={x} x2={x} y1={y1} y2={y2} stroke={c} strokeWidth={1.7} strokeLinecap="round" />
      <path d={up ? `M${x - 2.6} ${y2 + 2.6} L${x} ${y2} L${x + 2.6} ${y2 + 2.6}` : `M${x - 2.6} ${y2 - 2.6} L${x} ${y2} L${x + 2.6} ${y2 - 2.6}`} stroke={c} {...S} />
    </g>
  );
};
const bars = (hs: number[], cs: string[], base = 16) =>
  hs.map((h, k) => <rect key={`b${k}`} x={3 + k * 3.4} y={base - h} width={2.4} height={h} rx={0.5} fill={cs[k]} />);
const doc = (extra: React.ReactNode) => (
  <>
    <rect x={3} y={2.5} width={10.5} height={14} rx={1.5} stroke={W} {...S} />
    {line("M5.5 6.5h5.5M5.5 9.5h5.5M5.5 12.5h3.5", W, { strokeWidth: 1.2 })}
    {extra}
  </>
);
const bands = (
  <>
    {line("M2 6 Q7 3 10 5 T18 4", W, { strokeWidth: 1.2 })}
    {line("M2 15 Q7 12 10 14 T18 13", W, { strokeWidth: 1.2 })}
  </>
);
const gauge = (angle: number, c: string) => {
  const a = (angle * Math.PI) / 180;
  return (
    <>
      <path d="M3 15 A7 7 0 0 1 17 15" stroke={W} {...S} />
      <line x1={10} y1={15} x2={10 - 6 * Math.cos(a)} y2={15 - 6 * Math.sin(a)} stroke={c} strokeWidth={2} strokeLinecap="round" />
      <circle cx={10} cy={15} r={1.6} fill={c} />
    </>
  );
};
const ticket = (inner: React.ReactNode) => (
  <>
    <rect x={2.5} y={5} width={15} height={10} rx={2} stroke={W} {...S} />
    <circle cx={6.5} cy={10} r={1.3} fill={W} />
    {inner}
  </>
);
const dollar = (c: string, ring: string) => (
  <>
    <circle cx={10} cy={10} r={7.5} stroke={ring} {...S} />
    <path d="M12.6 7.2c-.5-1-1.5-1.5-2.6-1.5-1.5 0-2.6.8-2.6 2s1.2 1.7 2.6 2 2.7.8 2.7 2.1-1.2 2.1-2.7 2.1c-1.2 0-2.2-.6-2.7-1.6M10 4.3v11.4" stroke={c} {...S} />
  </>
);

const ICONS: Record<string, React.ReactNode> = {
  // ---- Entry
  aboveMA: [line("M2 15 Q7 12 10 14 T18 12", W), candle(10, 2, 4, 9.5, 11, G)],
  belowMA: [line("M2 6 Q7 3 10 5 T18 4", W), candle(10, 8, 10, 15.5, 18, R)],
  rsiLow: [dash(13), line("M2 6 Q6 6 9 16 T18 7", G)],
  rsiHigh: [dash(7), line("M2 14 Q6 14 9 3 T18 13", R)],
  rsiUp: [dash(11), line("M3 16 L8 13 L11 9", G), arrow(14, 9, 3, G)],
  rsiDown: [dash(9), line("M3 4 L8 7 L11 11", R), arrow(14, 11, 17, R)],
  breakout: [line("M2 9h12", W), candle(6, 10, 11, 15, 17, W), candle(14, 2, 3.5, 9, 11, G)],
  breakdown: [line("M2 11h12", W), candle(6, 3, 5, 9, 10, W), candle(14, 9, 11, 16.5, 18, R)],
  goldenCross: [line("M2 4 L18 15", W), line("M2 15 L18 4", G), <circle key="gc" cx={10} cy={9.6} r={2} fill={G} />],
  deathCross: [line("M2 15 L18 4", W), line("M2 4 L18 15", R), <circle key="dc" cx={10} cy={9.6} r={2} fill={R} />],
  macdUp: [...bars([4, 2.5, 1.5, 3, 5.5], [R, R, W, G, G], 17), line("M2 9 Q8 12 18 4", G, { strokeWidth: 1.3 })],
  macdDown: [...bars([5.5, 3, 1.5, 2.5, 4], [G, G, W, R, R], 17), line("M2 4 Q12 12 18 9", R, { strokeWidth: 1.3 })],
  bbBounce: [bands, <circle key="bb" cx={7} cy={13.4} r={1.8} fill={R} />, arrow(12, 13, 7, G)],
  bbBreak: [bands, <circle key="bx" cx={13} cy={2.4} r={2} fill={G} />, candle(8, 6, 8, 12, 14, W)],
  volume: bars([3, 4, 2.5, 3.5, 12], [W, W, W, W, G], 17.5),
  gapUp: [candle(6, 9, 11, 16, 17.5, W), candle(14, 2, 3.5, 7, 8.5, G), line("M8 9.5h4", G, { strokeDasharray: "1.2 1.6" })],
  gapDown: [candle(6, 2.5, 4, 9, 10, W), candle(14, 11.5, 13, 17, 18, R), line("M8 10.5h4", R, { strokeDasharray: "1.2 1.6" })],
  runUp: [line("M2 17h16", W, { strokeWidth: 1.1 }), line("M3 15 L7 12 L10 13 L17 3", G), line("M13 3h4v4", G)],
  pullback: [line("M2 3h16", W, { strokeWidth: 1.1 }), line("M3 5 L7 8 L10 7 L17 16", R), line("M13 16h4v-4", R)],
  newsBusy: doc(<g key="nb"><circle cx={15} cy={15} r={3.6} fill={G} /><path d="M13.5 15h3M15 13.5v3" stroke="#fff" strokeWidth={1.3} strokeLinecap="round" /></g>),
  newsGood: doc(<path key="ng" d="M12.5 15.2l1.8 1.8 3.4-3.6" stroke={G} {...S} strokeWidth={2} />),
  newsBad: doc(<path key="nd" d="M12.6 13.2l4 4M16.6 13.2l-4 4" stroke={R} {...S} strokeWidth={2} />),

  // ---- Exit (take profit)
  "x-stockGain": [<circle key="t1" cx={10} cy={10} r={7.5} stroke={W} {...S} />, <circle key="t2" cx={10} cy={10} r={4.3} stroke={G} {...S} />, <circle key="t3" cx={10} cy={10} r={1.6} fill={G} />],
  "x-optionGain": ticket(arrow(13, 13, 7, G)),
  "x-dollars": dollar(G, W),
  "x-rsiHigh": gauge(150, G),
  "x-rsiLow": gauge(30, G),
  "x-upperBand": [bands, line("M13 2v8", G), <path key="f" d="M13 2.4h4l-1.2 1.6 1.2 1.6h-4z" fill={G} />],
  "x-lowerBand": [bands, line("M7 10v8", G), <path key="f2" d="M7 10.4h4l-1.2 1.6 1.2 1.6h-4z" fill={G} />],
  "x-macdDown": [line("M2 16h16", W, { strokeWidth: 1 }), ...bars([10, 8, 5.5, 3, 1.4], [G, G, G, G, W], 16)],
  "x-macdUp": [line("M2 4h16", W, { strokeWidth: 1 }), ...[10, 8, 5.5, 3, 1.4].map((h, k) => <rect key={`u${k}`} x={3 + k * 3.4} y={4} width={2.4} height={h} rx={0.5} fill={k === 4 ? W : G} />)],
  "x-belowEMA": [line("M2 11 Q8 7 18 10", W), arrow(11, 4, 16, G)],
  "x-aboveEMA": [line("M2 9 Q8 13 18 10", W), arrow(11, 16, 4, G)],
  "x-days": [<rect key="cal" x={3} y={4} width={14} height={13} rx={2} stroke={W} {...S} />, line("M3 8h14M7 2.5v3M13 2.5v3", W, { strokeWidth: 1.3 }), <path key="ck" d="M7 12.5l2 2 4-4" stroke={G} {...S} strokeWidth={2} />],
  "x-expiry": [<path key="hg" d="M5 2.5h10M5 17.5h10M6 2.5c0 4 8 4 8 7.5s-8 3.5-8 7.5M14 2.5c0 4-8 4-8 7.5s8 3.5 8 7.5" stroke={W} {...S} strokeWidth={1.3} />, <path key="sand" d="M7.5 16.6c.6-1.6 4.4-1.6 5 0z" fill={G} />],
  "x-newsBad": doc(arrow(15.2, 11, 17.5, G)),

  // ---- Stop (cut the loss)
  "s-stockLoss": [<path key="sh" d="M10 2l6.5 2.5v5c0 4-3 6.6-6.5 8.3C6.5 16.1 3.5 13.5 3.5 9.5v-5z" stroke={R} {...S} />, arrow(10, 5.5, 13.5, W)],
  "s-optionLoss": ticket(arrow(13, 7, 13, R)),
  "s-dollars": dollar(R, R),
  "s-belowMA": [line("M2 8 Q7 5 10 7 T18 6", W), candle(10, 9, 11, 16, 18, R), <path key="x" d="M14.5 13l3 3M17.5 13l-3 3" stroke={R} strokeWidth={1.5} strokeLinecap="round" />],
  "s-aboveMA": [line("M2 13 Q7 10 10 12 T18 11", W), candle(10, 2, 4, 9, 10, G), <path key="x" d="M14.5 3l3 3M17.5 3l-3 3" stroke={R} strokeWidth={1.5} strokeLinecap="round" />],
  "s-newLow": [line("M2 11h16", W), line("M2 15h16", W, { strokeWidth: 0.8, strokeDasharray: "1 2" }), arrow(10, 3, 18, R)],
  "s-newHigh": [line("M2 9h16", W), line("M2 5h16", W, { strokeWidth: 0.8, strokeDasharray: "1 2" }), arrow(10, 17, 2, R)],
  "s-rsiLow": [gauge(25, R), dash(4, R)],
  "s-rsiHigh": [gauge(155, R), dash(4, R)],
  "s-days": [<circle key="cl" cx={10} cy={10.5} r={7} stroke={W} {...S} />, line("M10 6.5v4l3 2", R, { strokeWidth: 2 }), line("M7.5 2h5", W)],
  "s-newsBad": [<path key="tri" d="M10 2.5l8 14H2z" stroke={R} {...S} />, line("M10 7.5v4.5", W, { strokeWidth: 2 }), <circle key="dot" cx={10} cy={14.3} r={1.1} fill={W} />],

  // ---- Contract
  "k-call": [<circle key="o" cx={10} cy={10} r={7.5} stroke={W} {...S} />, line("M6.5 13.5L13.5 6.5", G, { strokeWidth: 2 }), line("M9 6.5h4.5V11", G, { strokeWidth: 2 })],
  "k-put": [<circle key="o" cx={10} cy={10} r={7.5} stroke={W} {...S} />, line("M6.5 6.5L13.5 13.5", R, { strokeWidth: 2 }), line("M9 13.5h4.5V9", R, { strokeWidth: 2 })],
  "k-spread": [arrow(6, 16, 4, G), arrow(14, 4, 16, R), line("M6 10h8", W, { strokeDasharray: "1.4 1.6" })],
  "k-shares": [<ellipse key="e1" cx={10} cy={5} rx={6} ry={2.2} stroke={G} {...S} />, line("M4 5v5c0 1.2 2.7 2.2 6 2.2s6-1 6-2.2V5", W), line("M4 10v4.6c0 1.2 2.7 2.2 6 2.2s6-1 6-2.2V10", W)],
  "f-expiry": [<rect key="cal" x={3} y={4} width={14} height={13} rx={2} stroke={W} {...S} />, line("M3 8h14M7 2.5v3M13 2.5v3", W, { strokeWidth: 1.3 }), <rect key="d" x={11} y={11} width={4} height={4} rx={0.8} fill={R} />, <rect key="d2" x={6} y={11} width={3} height={2.5} rx={0.6} fill={G} />],
  "f-strike": [<circle key="o" cx={10} cy={10} r={7} stroke={W} {...S} />, line("M10 1.5v4M10 14.5v4M1.5 10h4M14.5 10h4", W, { strokeWidth: 1.3 }), <circle key="c" cx={10} cy={10} r={2.3} fill={G} />, <circle key="r" cx={14} cy={6} r={1.2} fill={R} />],
  "f-width": [line("M3 4v12M17 4v12", W), line("M5.5 10h9", W, { strokeWidth: 1.2 }), line("M7.5 7.5L5 10l2.5 2.5", G), line("M12.5 7.5L15 10l-2.5 2.5", R)],
  "f-size": [<rect key="s1" x={3} y={13} width={14} height={3.5} rx={1} fill={W} />, <rect key="s2" x={4.5} y={8.5} width={11} height={3.5} rx={1} fill={W} opacity={0.7} />, <rect key="s3" x={6} y={4} width={8} height={3.5} rx={1} fill={G} />, <circle key="s4" cx={16} cy={5} r={1.6} fill={R} />],
};

/** A criterion's (or contract setting's) icon, in a small tile. */
export function StrategyIcon({ id, size = 26 }: { id: string; size?: number }) {
  const art = ICONS[id];
  if (!art) return null;
  return (
    <span className="grid shrink-0 place-items-center rounded-md bg-bg ring-1 ring-inset ring-line" style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 20 20" width={size - 8} height={size - 8} style={{ overflow: "visible" }}>
        {Array.isArray(art) ? art.map((part, k) => <g key={k}>{part}</g>) : art}
      </svg>
    </span>
  );
}

export const ICON_IDS = Object.keys(ICONS);
