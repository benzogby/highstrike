"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Point = { date: string; close: number };
const RANGES = [
  { key: "1M", days: 22 },
  { key: "3M", days: 66 },
  { key: "6M", days: 130 },
  { key: "1Y", days: 260 },
] as const;

const W = 720;
const H = 300;
const PAD = { top: 14, right: 56, bottom: 26, left: 10 };

export default function PriceChart({ ticker }: { ticker: string }) {
  const [points, setPoints] = useState<Point[] | null>(null);
  const [live, setLive] = useState(true);
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("6M");
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/history?symbol=${ticker}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        setPoints(d.points ?? []);
        setLive(Boolean(d.live));
      })
      .catch(() => alive && setPoints([]));
    return () => {
      alive = false;
    };
  }, [ticker]);

  const view = useMemo(() => {
    if (!points || points.length === 0) return null;
    const days = RANGES.find((r) => r.key === range)!.days;
    const data = points.slice(-days);
    if (data.length < 2) return null;
    const closes = data.map((p) => p.close);
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const span = max - min || 1;
    const x = (i: number) => PAD.left + (i / (data.length - 1)) * (W - PAD.left - PAD.right);
    const y = (v: number) => PAD.top + (1 - (v - min) / span) * (H - PAD.top - PAD.bottom);
    const line = data
      .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.close).toFixed(1)}`)
      .join("");
    const area = `${line}L${x(data.length - 1).toFixed(1)},${H - PAD.bottom}L${PAD.left},${
      H - PAD.bottom
    }Z`;
    const first = data[0].close;
    const last = data[data.length - 1].close;
    const changePct = ((last - first) / first) * 100;
    const gridVals = [0.25, 0.5, 0.75].map((f) => min + span * (1 - f));
    return { data, x, y, line, area, min, max, first, last, changePct, gridVals };
  }, [points, range]);

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!view || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const frac = (px - PAD.left) / (W - PAD.left - PAD.right);
    const idx = Math.round(frac * (view.data.length - 1));
    setHover(Math.max(0, Math.min(view.data.length - 1, idx)));
  }

  const up = (view?.changePct ?? 0) >= 0;
  const hoverPt = view && hover != null ? view.data[hover] : null;

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-panel">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
        <div className="flex items-baseline gap-3">
          {view && (
            <>
              <span className="font-mono-nums text-lg text-ink">
                {view.last.toFixed(2)}
              </span>
              <span className={`font-mono-nums text-sm ${up ? "text-up" : "text-down"}`}>
                {up ? "▲" : "▼"} {Math.abs(view.changePct).toFixed(2)}% ({range})
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!live && (
            <span className="rounded bg-panel-2 px-2 py-0.5 text-[10px] uppercase tracking-wider text-ink-3">
              sample
            </span>
          )}
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRange(r.key)}
              className={`rounded-md px-2.5 py-1 font-display text-xs font-semibold transition ${
                range === r.key
                  ? "bg-accent text-bg"
                  : "text-ink-2 hover:bg-panel-2 hover:text-ink"
              }`}
            >
              {r.key}
            </button>
          ))}
        </div>
      </div>

      {!points && (
        <div className="flex h-64 items-end gap-1 px-6 pb-8" aria-label="Loading chart">
          {[38, 52, 44, 60, 50, 66, 58, 72, 62, 78, 70, 84].map((h, i) => (
            <span
              key={i}
              className="skeleton w-full rounded-t"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      )}
      {points && !view && (
        <div className="flex h-64 items-center justify-center text-sm text-ink-3">
          No price history available.
        </div>
      )}
      {view && (
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="block w-full cursor-crosshair"
          role="img"
          aria-label={`${ticker} price chart, ${up ? "up" : "down"} ${Math.abs(view.changePct).toFixed(1)} percent over ${range}`}
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        >
          {view.gridVals.map((v) => (
            <g key={v}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={view.y(v)}
                y2={view.y(v)}
                stroke="var(--color-line)"
                strokeWidth="1"
              />
              <text
                x={W - PAD.right + 6}
                y={view.y(v) + 3.5}
                fontSize="11"
                fill="var(--color-ink-3)"
                className="font-mono-nums"
              >
                {v >= 1000 ? v.toFixed(0) : v.toFixed(1)}
              </text>
            </g>
          ))}
          <path
            key={`area-${range}`}
            className="chart-area-fade"
            d={view.area}
            fill="var(--color-accent)"
            opacity="0.1"
          />
          <path
            key={`line-${range}`}
            className="chart-draw"
            d={view.line}
            pathLength={1}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <circle
            cx={view.x(view.data.length - 1)}
            cy={view.y(view.last)}
            r="6"
            fill="var(--color-panel)"
          />
          <circle
            cx={view.x(view.data.length - 1)}
            cy={view.y(view.last)}
            r="4"
            fill="var(--color-accent)"
          />
          {hoverPt && hover != null && (
            <g>
              {/* Crosshair glides between points instead of snapping */}
              <g
                style={{
                  transform: `translateX(${view.x(hover)}px)`,
                  transition: "transform 70ms ease-out",
                }}
              >
                <line
                  x1={0}
                  x2={0}
                  y1={PAD.top}
                  y2={H - PAD.bottom}
                  stroke="var(--color-line-strong)"
                  strokeWidth="1"
                />
              </g>
              <g
                style={{
                  transform: `translate(${view.x(hover)}px, ${view.y(hoverPt.close)}px)`,
                  transition: "transform 70ms ease-out",
                }}
              >
                <circle r="6" fill="var(--color-panel)" />
                <circle r="4" fill="var(--color-accent)" />
              </g>
              <g
                style={{
                  transform: `translate(${Math.min(view.x(hover) + 10, W - 150)}px, ${PAD.top + 4}px)`,
                  transition: "transform 90ms ease-out",
                }}
              >
                <rect width="132" height="40" rx="8" fill="var(--color-panel-2)" stroke="var(--color-line)" />
                <text x="10" y="17" fontSize="11" fill="var(--color-ink-3)" className="font-mono-nums">
                  {hoverPt.date}
                </text>
                <text x="10" y="32" fontSize="12" fill="var(--color-ink)" className="font-mono-nums">
                  ${hoverPt.close.toFixed(2)}
                </text>
              </g>
            </g>
          )}
        </svg>
      )}
    </div>
  );
}
