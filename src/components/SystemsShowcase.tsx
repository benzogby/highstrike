"use client";

import { useEffect, useRef, useState } from "react";

const AUTO_ADVANCE_MS = 3600;

type Stage = {
  title: string;
  kicker: string;
  body: string;
  vignette: React.ReactNode;
};

const stages: Stage[] = [
  {
    title: "Dashboard Terminal",
    kicker: "Your morning, assembled",
    body: "Every idea, read, and flag in one keyboard-fast workspace — the first tab you open and the only one you need.",
    vignette: (
      <div>
        <div className="sys-row">
          <span>Weather report</span>
          <span className="font-mono-nums text-accent">Ready</span>
        </div>
        <div className="sys-row">
          <span>Setups published</span>
          <span className="font-mono-nums">4</span>
        </div>
        <div className="sys-row">
          <span>Alerts armed</span>
          <span className="font-mono-nums">12</span>
        </div>
      </div>
    ),
  },
  {
    title: "AI Weather Report",
    kicker: "Conditions before trades",
    body: "Volatility, opportunity, and direction scored before the open — every setup framed by the day's actual conditions.",
    vignette: (
      <div className="flex items-center justify-between gap-3">
        <svg width="92" height="56" viewBox="0 0 92 56" aria-hidden="true">
          <path
            d="M 8 50 A 38 38 0 0 1 84 50"
            fill="none"
            stroke="var(--color-line-strong)"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <path
            className="sys-arc"
            d="M 8 50 A 38 38 0 0 1 84 50"
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="6"
            strokeLinecap="round"
          />
        </svg>
        <div className="text-right">
          <p className="font-mono-nums text-2xl text-ink">82</p>
          <p className="text-[10px] uppercase tracking-wider text-ink-3">Volatility</p>
        </div>
      </div>
    ),
  },
  {
    title: "Setup Engine",
    kicker: "Finished trade cards",
    body: "Entries, targets, time frames, and the reasoning in plain English. If it can't be explained, it doesn't publish.",
    vignette: (
      <div>
        <div className="sys-row">
          <span className="font-display font-semibold text-ink">$MCD · Long</span>
          <span className="font-mono-nums text-up">▲</span>
        </div>
        <div className="sys-row">
          <span>Price target</span>
          <span className="font-mono-nums text-accent">$345.00</span>
        </div>
        <div className="sys-row">
          <span>Time frame</span>
          <span className="font-mono-nums">3–4 days</span>
        </div>
      </div>
    ),
  },
  {
    title: "Flow Scanner",
    kicker: "5,400+ symbols, ranked",
    body: "Unusual options activity, relative volume, and momentum distilled into one flow score across the scan universe.",
    vignette: (
      <div className="space-y-2.5">
        {[
          { t: "NVDA", w: "91%", v: "91" },
          { t: "DELL", w: "87%", v: "87" },
          { t: "XOM", w: "41%", v: "41" },
        ].map((r, i) => (
          <div key={r.t} className="flex items-center gap-2.5 text-[0.78rem]">
            <span className="w-11 font-display font-semibold">{r.t}</span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel-2">
              <span
                className={`sys-bar block b${i + 1}`}
                style={{ "--bar-w": r.w } as React.CSSProperties}
              />
            </span>
            <span className="w-6 text-right font-mono-nums text-ink-2">{r.v}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    title: "Insider Monitor",
    kicker: "Filings that matter",
    body: "Open-market insider buying scored for size, clustering, and pattern breaks — separated from the administrative noise.",
    vignette: (
      <div>
        <div className="sys-row">
          <span>CEO open-market buy</span>
          <span className="font-mono-nums text-up">$1.2M</span>
        </div>
        <div className="sys-row">
          <span>Cluster detected</span>
          <span className="font-mono-nums">3 insiders</span>
        </div>
        <div className="sys-row">
          <span>Pattern break</span>
          <span className="font-mono-nums text-accent">Flagged</span>
        </div>
      </div>
    ),
  },
  {
    title: "Chatter Engine",
    kicker: "Crowd positioning, read",
    body: "X and Reddit monitored at scale, reduced to a sentiment read per ticker — without the doomscrolling.",
    vignette: (
      <div>
        <div className="sys-row">
          <span>X mentions (24h)</span>
          <span className="font-mono-nums text-up">+240%</span>
        </div>
        <div className="sys-row">
          <span>Reddit sentiment</span>
          <span className="font-mono-nums">71% bullish</span>
        </div>
        <div className="sys-row">
          <span>Read</span>
          <span className="font-mono-nums text-accent">Crowded long</span>
        </div>
      </div>
    ),
  },
];

export default function SystemsShowcase() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [inView, setInView] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.25 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (paused || !inView) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(
      () => setActive((a) => (a + 1) % stages.length),
      AUTO_ADVANCE_MS
    );
    return () => clearInterval(id);
  }, [paused, inView]);

  return (
    <div ref={rootRef} className="sys-grid">
      {stages.map((s, i) => (
        <button
          key={s.title}
          type="button"
          onClick={() => {
            setActive(i);
            setPaused(true);
          }}
          aria-current={i === active}
          className={`sys-stage ${i <= active ? "on" : ""} ${i === active ? "now" : ""}`}
        >
          <span className="sys-node">
            <span className="sys-dot">{String(i + 1).padStart(2, "0")}</span>
            <span className="sys-label">{s.title}</span>
          </span>
          <span className="sys-card block">
            <span className="sys-kicker block">{s.kicker}</span>
            {s.vignette}
            <span className="sys-body block">{s.body}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
