"use client";

// Semicircular meter with a satisfying mount animation: the arc sweeps in,
// the needle rotates from zero, and the value counts up. Reduced-motion
// users get the final state immediately.

import { useEffect, useRef, useState } from "react";

const R = 44;
const CX = 56;
const CY = 56;
const CIRC = Math.PI * R;
const SWEEP_MS = 850;

export default function Gauge({ label, value }: { label: string; value: number }) {
  const [mounted, setMounted] = useState(false);
  const [display, setDisplay] = useState(0);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced.current) {
      setMounted(true);
      setDisplay(value);
      return;
    }

    const raf = requestAnimationFrame(() => setMounted(true));
    const start = performance.now();
    let frame: number;
    const tick = (now: number) => {
      const t = Math.min((now - start) / SWEEP_MS, 1);
      // ease-out cubic to match the needle
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(eased * value));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(frame);
    };
  }, [value]);

  const filled = (value / 100) * CIRC;
  const angleDeg = (value / 100) * 180;

  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-line bg-panel-2 px-4 pb-4 pt-3">
      <div className="flex w-full items-center justify-between gap-4">
        <span className="text-[10px] uppercase tracking-wider text-ink-3">{label}</span>
        <span className="font-mono-nums text-sm text-accent">{display}</span>
      </div>
      <svg width="112" height="64" viewBox="0 0 112 64" aria-hidden="true">
        <path
          d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
          fill="none"
          stroke="var(--color-line-strong)"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <path
          d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${mounted ? filled : 0} ${CIRC}`}
          style={{
            transition: `stroke-dasharray ${SWEEP_MS}ms cubic-bezier(0.33, 1, 0.68, 1)`,
          }}
        />
        {/* Needle drawn at value 0 (pointing left), rotated to the value */}
        <g
          style={{
            transform: `rotate(${mounted ? angleDeg : 0}deg)`,
            transformOrigin: `${CX}px ${CY}px`,
            transition: `transform ${SWEEP_MS}ms cubic-bezier(0.33, 1, 0.68, 1)`,
          }}
        >
          <line
            x1={CX}
            y1={CY}
            x2={CX - (R - 10)}
            y2={CY}
            stroke="var(--color-ink)"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>
        <circle cx={CX} cy={CY} r="3.5" fill="var(--color-ink)" />
      </svg>
    </div>
  );
}
