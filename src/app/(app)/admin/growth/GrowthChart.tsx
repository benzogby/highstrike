"use client";

import { useState } from "react";
import { CARD } from "@/components/ui";
import type { Day } from "@/lib/adminGrowth";

const money = (cents: number) => `$${Math.round(cents / 100).toLocaleString("en-US")}`;
const TABS = [
  { key: "revenue", label: "Revenue", fmt: money },
  { key: "sales", label: "Sales", fmt: (n: number) => n.toLocaleString("en-US") },
  { key: "signups", label: "New accounts", fmt: (n: number) => n.toLocaleString("en-US") },
] as const;
type Key = (typeof TABS)[number]["key"];

const LABEL = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" });
const TICK = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" });
const noon = (day: string) => new Date(`${day}T12:00:00Z`);

/**
 * Admin → Growth's chart, as getripping.com's: a card per figure with its 30-day total, the picked one drawn a day at a
 * time underneath (Revenue first, as Ben had MRR first on Ripping).
 */
export default function GrowthChart({ days }: { days: Day[] }) {
  const [pick, setPick] = useState<Key>("revenue");
  const [hover, setHover] = useState<number | null>(null);
  const tab = TABS.find((t) => t.key === pick)!;
  const values = days.map((d) => d[pick]);
  const max = Math.max(1, ...values);
  const W = 720;
  const H = 180;
  const bw = W / days.length;
  const shown = hover ?? days.length - 1;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-3" role="tablist" aria-label="Figure">
        {TABS.map((t) => {
          const total = days.reduce((s, d) => s + d[t.key], 0);
          const on = t.key === pick;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setPick(t.key)}
              className={`${CARD} px-4 py-3 text-left transition ${on ? "ring-2 ring-accent/60" : "hover:bg-panel-2"}`}
            >
              <span className="block text-[13px] text-ink-3">{t.label}, 30 days</span>
              <span className="mt-1 block font-display text-2xl leading-none text-ink">{t.fmt(total)}</span>
            </button>
          );
        })}
      </div>
      <section className={`${CARD} p-4`}>
        <div className="mb-2 flex items-baseline justify-between text-sm">
          <span className="text-ink-2">{LABEL.format(noon(days[shown].day))}</span>
          <span className="font-medium font-mono-nums text-ink">{tab.fmt(values[shown])}</span>
        </div>
        <svg viewBox={`0 0 ${W} ${H + 20}`} className="h-auto w-full" onMouseLeave={() => setHover(null)} role="img" aria-label={`${tab.label} by day`}>
          {values.map((v, i) => {
            const h = (v / max) * H;
            return (
              <g key={days[i].day} onMouseEnter={() => setHover(i)}>
                <rect x={i * bw} y={0} width={bw} height={H} fill="transparent" />
                <rect
                  x={i * bw + bw * 0.15}
                  y={H - Math.max(h, v > 0 ? 2 : 0)}
                  width={bw * 0.7}
                  height={Math.max(h, v > 0 ? 2 : 0)}
                  rx={2}
                  className={i === shown ? "fill-accent" : "fill-accent/45"}
                />
              </g>
            );
          })}
          <line x1={0} x2={W} y1={H} y2={H} className="stroke-line-strong" />
          {days.map((d, i) =>
            i % 7 === 0 || i === days.length - 1 ? (
              <text key={d.day} x={i * bw + bw / 2} y={H + 15} textAnchor="middle" className="fill-ink-3 text-[11px]">
                {TICK.format(noon(d.day))}
              </text>
            ) : null
          )}
        </svg>
      </section>
    </div>
  );
}
