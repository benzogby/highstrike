import type { Close, ClosedSetup } from "@/app/(landing)/data";
import { Tag, price, shortDate, triggerOf } from "./Pieces";

// A setup on its chart, the reels' live chart (design/keyframes-2026-11-02):
// the stock's real closes, the levels drawn from the morning it published
// (its trigger, entry and target as axis chips), the reward zone between entry
// and target, the trade's own path lit green and the price tag on the head.
// The line is SVG in a 0–100 box (strokes don't scale); every label, chip and
// dot is HTML placed in percent, so the chart fits any width.

const TOP = 9; // % of the height above the highest price
const FOOT = 14; // % below the lowest price, for the dates

type Props = {
  closes: Close[];
  setup: ClosedSetup;
  /** Sessions shown before the setup's morning. */
  history: number;
  /** The last session drawn (default: the session the target was hit, else the last on file). */
  until?: string;
  /** Light the trade's own path green (false: the whole line stays white). */
  trade?: boolean;
  /** Lock a crosshair on this session's close. */
  crosshair?: string | null;
  /** The last price in a tag on the axis. */
  headTag?: boolean;
  /** The result in its price tag, top right, with how long it took. */
  result?: boolean;
  /** "Published Oct 29, before the open" beside the morning's hairline. */
  published?: boolean;
  /** A short id, unique on the page, for the chart's gradients. */
  id: string;
  label: string;
};

export function hitIndex(closes: Close[], setup: ClosedSetup, entryIdx: number) {
  const short = setup.direction.toLowerCase() === "short";
  for (let i = entryIdx + 1; i < closes.length; i++) {
    if (short ? closes[i].close <= setup.target : closes[i].close >= setup.target) return i;
  }
  return -1;
}

export function entryIndexOf(closes: Close[], setup: ClosedSetup) {
  let idx = -1;
  closes.forEach((p, i) => {
    if (p.date < setup.reportDate) idx = i;
  });
  return idx;
}

export default function SetupChart({ closes, setup, history, until, trade = true, crosshair = null, headTag = false, result = false, published = false, id, label }: Props) {
  const entryIdx = entryIndexOf(closes, setup);
  if (entryIdx < 0) return null;
  const hit = hitIndex(closes, setup, entryIdx);
  const untilIdx = until ? closes.findIndex((p) => p.date === until) : -1;
  const end = untilIdx >= 0 ? untilIdx : hit >= 0 ? hit : Math.min(closes.length - 1, entryIdx + 5);
  const start = Math.max(0, entryIdx - history);
  const pts = closes.slice(start, end + 1);
  const e = entryIdx - start; // the entry's index in pts
  const last = pts.length - 1;

  const short = setup.direction.toLowerCase() === "short";
  const trigger = triggerOf(setup.criteria);
  const values = pts.map((p) => p.close).concat([setup.entry, setup.target], trigger ? [trigger] : []);
  const pad = (Math.max(...values) - Math.min(...values)) * 0.06;
  const lo = Math.min(...values) - pad;
  const hi = Math.max(...values) + pad;

  const X = (i: number) => 1.5 + (i / Math.max(1, last)) * 97;
  const Y = (v: number) => TOP + ((hi - v) / (hi - lo)) * (100 - TOP - FOOT);
  const path = (a: number, b: number) => pts.slice(a, b + 1).map((p, k) => `${k ? "L" : "M"}${X(a + k).toFixed(2)} ${Y(p.close).toFixed(2)}`).join(" ");
  const floor = 100 - FOOT;

  // A whisper of a line every round step, its price at the axis.
  const span = hi - lo;
  const step = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500].find((s) => span / s <= 5) ?? 1000;
  const ticks: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v);

  // One date a week along the foot.
  const dates = pts
    .map((p, i) => ({ p, i }))
    .filter(({ p, i }) => i > 0 && i < last - 1 && new Date(`${p.date}T12:00:00Z`).getUTCDay() === 1);

  const ci = crosshair ? pts.findIndex((p) => p.date === crosshair) : -1;
  const tradeOn = trade && last > e;

  // Axis chips, pushed apart so none overlaps (in % of the height).
  type Chip = { v: number; cls: string; key: string; body: React.ReactNode; y?: number };
  const chips: Chip[] = [];
  if (trigger) chips.push({ v: trigger, cls: "ghost", key: "trigger", body: <><span className="k">{short ? "Below" : "Above"}</span>{price(trigger)}</> });
  chips.push({ v: setup.entry, cls: "ink", key: "entry", body: <><span className="k">Entry</span>{price(setup.entry)}</> });
  chips.push({ v: setup.target, cls: "green", key: "target", body: <><span className="k">Target</span>{price(setup.target)}</> });
  if (headTag && tradeOn) chips.push({ v: pts[last].close, cls: "green", key: "head", body: price(pts[last].close) });
  if (ci >= 0) chips.push({ v: pts[ci].close, cls: "ink", key: "cross", body: price(pts[ci].close) });
  chips.sort((a, b) => Y(a.v) - Y(b.v));
  let prev = -100;
  for (const c of chips) {
    c.y = Math.max(Y(c.v), prev + 10.5);
    prev = c.y;
  }
  const over = prev - (floor + 2);
  if (over > 0) for (const c of chips) c.y = (c.y ?? 0) - over;

  const sessions = hit >= 0 ? hit - entryIdx : null;

  return (
    <figure className="hs-chart" data-draw="" aria-label={label}>
      <div className="hs-chart__plot">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id={`fade-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
            </linearGradient>
            <linearGradient id={`gain-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1FBF86" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#1FBF86" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {ticks.map((t) => (
            <line key={t} x1="0" x2="100" y1={Y(t)} y2={Y(t)} className="hs-chart__grid" vectorEffect="non-scaling-stroke" />
          ))}
          <rect x={X(e)} width={100 - X(e)} y={Math.min(Y(setup.entry), Y(setup.target))} height={Math.abs(Y(setup.entry) - Y(setup.target))} className="hs-chart__zone" />
          {trigger && <line x1={X(e)} x2="100" y1={Y(trigger)} y2={Y(trigger)} className="hs-chart__lvl hs-chart__lvl--trigger" vectorEffect="non-scaling-stroke" />}
          <line x1={X(e)} x2="100" y1={Y(setup.entry)} y2={Y(setup.entry)} className="hs-chart__lvl hs-chart__lvl--entry" vectorEffect="non-scaling-stroke" />
          <line x1={X(e)} x2="100" y1={Y(setup.target)} y2={Y(setup.target)} className="hs-chart__lvl hs-chart__lvl--target" vectorEffect="non-scaling-stroke" />
          <line x1={X(e)} x2={X(e)} y1={TOP - 4} y2={floor} className="hs-chart__pub" vectorEffect="non-scaling-stroke" />
          <g className="hs-chart__ink">
            <path d={`${path(0, last)} L${X(last)} ${floor} L${X(0)} ${floor} Z`} fill={`url(#fade-${id})`} />
            <path d={path(0, tradeOn ? e : last)} className="hs-chart__line" vectorEffect="non-scaling-stroke" />
            {tradeOn && (
              <>
                <path d={`${path(e, last)} L${X(last)} ${Y(setup.entry)} L${X(e)} ${Y(setup.entry)} Z`} fill={`url(#gain-${id})`} />
                <path d={path(e, last)} className="hs-chart__trade-glow" vectorEffect="non-scaling-stroke" />
                <path d={path(e, last)} className="hs-chart__trade" vectorEffect="non-scaling-stroke" />
              </>
            )}
          </g>
          {ci >= 0 && (
            <g className="hs-chart__cross">
              <line x1="0" x2="100" y1={Y(pts[ci].close)} y2={Y(pts[ci].close)} vectorEffect="non-scaling-stroke" />
              <line x1={X(ci)} x2={X(ci)} y1={TOP - 2} y2={floor} vectorEffect="non-scaling-stroke" />
            </g>
          )}
        </svg>

        {dates.map(({ p, i }) => (
          <span key={p.date} className="hs-chart__date" style={{ left: `${X(i)}%` }}>
            {shortDate(p.date)}
          </span>
        ))}
        {published && (
          <span className="hs-chart__note" style={{ right: `${100 - X(e) + 1.5}%` }}>
            Published {shortDate(setup.reportDate)},<br />
            before the open
          </span>
        )}
        {ci >= 0 ? (
          <>
            <span className="hs-chart__lock" style={{ left: `${X(ci)}%`, top: `${Y(pts[ci].close)}%` }} />
            <span className={`hs-axchip hs-axchip--ink hs-chart__when${X(ci) > 80 ? " hs-chart__when--end" : ""}`} style={{ left: `${X(ci)}%` }}>
              {shortDate(pts[ci].date).toUpperCase()}
            </span>
          </>
        ) : (
          <span className={`hs-chart__head${tradeOn ? " is-lit" : ""}`} style={{ left: `${X(last)}%`, top: `${Y(pts[last].close)}%` }} />
        )}
        {result && setup.resultPct != null && (
          <div className="hs-chart__result">
            <Tag tone={setup.resultPct >= 0 ? "gain" : "loss"} className="hs-tag--land">
              {setup.resultPct >= 0 ? "+" : "−"}
              {Math.abs(setup.resultPct).toFixed(2)}%
            </Tag>
            <span>{sessions != null ? `Target hit in ${sessions} session${sessions === 1 ? "" : "s"}` : `Graded at the ${shortDate(pts[last].date)} close`}</span>
          </div>
        )}
      </div>

      <div className="hs-chart__axis" aria-hidden="true">
        {ticks.map((t) => (
          <span key={t} className="hs-chart__tick" style={{ top: `${Y(t)}%` }}>
            {step < 1 ? price(t) : t.toLocaleString("en-US")}
          </span>
        ))}
        {chips.map((c) => (
          <span key={c.key} className={`hs-axchip hs-axchip--${c.cls}`} style={{ top: `${c.y}%` }}>
            {c.body}
          </span>
        ))}
      </div>
    </figure>
  );
}
