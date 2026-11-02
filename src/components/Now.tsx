"use client";

// Client-rendered current-date/time snippets. Each renders empty on the server
// and fills in after hydration, so statically generated pages never ship a
// frozen build-time date.

import { useEffect, useState, useSyncExternalStore } from "react";
import { nextBell } from "@/lib/marketCalendar";

const ET = "America/New_York";

function useNowText(format: (d: Date) => string) {
  const [text, setText] = useState("");
  useEffect(() => {
    setText(format(new Date()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return text;
}

/** e.g. "Monday, August 18" */
export function NowDateLong() {
  const text = useNowText((d) =>
    d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      timeZone: ET,
    })
  );
  return <span suppressHydrationWarning>{text}</span>;
}

/** e.g. "August" */
export function NowMonth() {
  const text = useNowText((d) =>
    d.toLocaleDateString("en-US", { month: "long", timeZone: ET })
  );
  return <span suppressHydrationWarning>{text}</span>;
}

/** e.g. "09:42 ET" */
export function NowTimeET() {
  const text = useNowText(
    (d) =>
      `${d.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: ET,
      })} ET`
  );
  return <span suppressHydrationWarning>{text}</span>;
}

/** Date `days` from today (negative = past), e.g. "Aug 15" */
export function DateOffset({ days }: { days: number }) {
  const text = useNowText((d) => {
    const t = new Date(d);
    t.setDate(t.getDate() + days);
    return t.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: ET,
    });
  });
  return <span suppressHydrationWarning>{text}</span>;
}

/** "Good morning" / "Good afternoon" / "Good evening" by ET hour */
export function NowGreeting() {
  const text = useNowText((d) => {
    const hour = Number(
      d.toLocaleTimeString("en-US", {
        hour: "2-digit",
        hour12: false,
        timeZone: ET,
      })
    );
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  });
  return <span suppressHydrationWarning>{text || "Welcome back"}</span>;
}

/** Upcoming Friday `weeks` out (0 = this/next Friday), e.g. "Aug 22" */
export function UpcomingFriday({ weeks = 0 }: { weeks?: number }) {
  const text = useNowText((d) => {
    const t = new Date(d);
    const day = t.getDay();
    let ahead = (5 - day + 7) % 7;
    if (ahead === 0) ahead = 7;
    t.setDate(t.getDate() + ahead + weeks * 7);
    return t.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: ET,
    });
  });
  return <span suppressHydrationWarning>{text}</span>;
}

const everyHalfMinute = (tick: () => void) => {
  const t = setInterval(tick, 30_000);
  return () => clearInterval(t);
};

/**
 * The top bar's market line: a dot and "Market open" while the NYSE session runs (the next bell is its close), else
 * "Market closed", from the market calendar's holidays and early closes, and the time in New York. It ticks every half
 * minute; nothing renders on the server or before hydration.
 */
export function MarketClock() {
  const tick = useSyncExternalStore(everyHalfMinute, () => Math.floor(Date.now() / 30_000), () => null);
  if (tick === null) return null;
  const at = tick * 30_000;
  const open = nextBell(at).kind === "close";
  const time = new Date(at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: ET });
  return (
    <span className="hidden h-8 items-center gap-2 rounded-lg border border-line bg-panel px-2.5 text-xs sm:inline-flex">
      <span
        className={`h-1.5 w-1.5 rounded-full ${open ? "bg-accent shadow-[0_0_0_3px_rgb(31_191_134/0.18)]" : "bg-ink-3"}`}
        aria-hidden="true"
      />
      <span className="font-medium text-ink">{open ? "Market open" : "Market closed"}</span>
      <span className="font-mono-nums text-ink-3">{time} ET</span>
    </span>
  );
}
