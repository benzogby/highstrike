import type { CSSProperties, ReactNode } from "react";

// The homepage's small shared pieces in the HighStrike reels system
// (design/keyframes-2026-11-02): number formats, the ▲/▼ triangle, the price
// tag, pills, toasts and the bull. Styles in src/app/(landing)/landing.css.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function shortDate(iso: string) {
  const [, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}`;
}

export function weekdayDate(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

export function signedPct(n: number, digits = 2) {
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(digits)}%`;
}

export function price(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function compact(n: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function sideLabel(direction: string) {
  return direction.toLowerCase() === "short" ? "Short" : "Long";
}

export function statusLabel(status: string) {
  if (status === "target_hit") return "Target hit";
  if (status === "stopped") return "Stopped";
  if (status === "expired") return "Expired";
  return status;
}

// The price a setup's first entry rule names ("Price fails below $96.00 on a
// 15-minute close"), or null.
export function triggerOf(criteria: string[]) {
  const m = criteria[0]?.match(/\$([\d,]+(?:\.\d+)?)/);
  return m ? Number(m[1].replace(/,/g, "")) : null;
}

// ▲ / ▼ drawn, so every face shows the same triangle.
export function Tri({ up, className = "hs-tri" }: { up: boolean; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 12 10" aria-hidden="true">
      <path d={up ? "M6 0.6 L11.4 9.4 L0.6 9.4 Z" : "M6 9.4 L11.4 0.6 L0.6 0.6 Z"} fill="currentColor" />
    </svg>
  );
}

// The key word inside an axis label: green with ▲ for a gain, red with ▼ for a
// loss, plain green (no arrow) for the one accent phrase.
export function Tag({ children, tone = "accent", className = "", style }: { children: ReactNode; tone?: "accent" | "gain" | "loss"; className?: string; style?: CSSProperties }) {
  return (
    <span className={`hs-tag${tone === "loss" ? " hs-tag--loss" : ""}${className ? ` ${className}` : ""}`} style={style}>
      {tone !== "accent" && <Tri up={tone === "gain"} />}
      <span>{children}</span>
    </span>
  );
}

export function Pill({ children, tone = "green" }: { children: ReactNode; tone?: "green" | "red" | "mute" }) {
  return (
    <span className={`hs-pill hs-pill--${tone}`}>
      <i aria-hidden="true" />
      {children}
    </span>
  );
}

export function Bull({ className = "" }: { className?: string }) {
  return <i className={`hs-bull ${className}`} aria-hidden="true" />;
}

export function Toast({ icon, title, sub, side, sideNote, className = "", style }: { icon: "check" | "bell"; title: string; sub: string; side: ReactNode; sideNote: string; className?: string; style?: CSSProperties }) {
  return (
    <div className={`hs-toast ${className}`} style={style} data-ui="">
      <span className="hs-toast__ic" aria-hidden="true">
        {icon === "check" ? (
          <svg viewBox="0 0 20 20">
            <path d="M4.5 10.5 L8.3 14.2 L15.6 5.8" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg viewBox="0 0 20 20">
            <path d="M10 3.2 a4.6 4.6 0 0 1 4.6 4.6 v3.1 l1.5 2.4 H3.9 l1.5 -2.4 V7.8 A4.6 4.6 0 0 1 10 3.2 Z M8.1 15.4 a1.9 1.9 0 0 0 3.8 0" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <div className="hs-toast__text">
        <p className="hs-toast__t">{title}</p>
        <p className="hs-toast__s">{sub}</p>
      </div>
      <p className="hs-toast__r">
        {side}
        <small>{sideNote}</small>
      </p>
    </div>
  );
}

// A seeded random walk for anything decorative that must render the same on
// every request (the dust in the dark room's light).
export function seeded(seed: number) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}
