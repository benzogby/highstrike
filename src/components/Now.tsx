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
 * The NYSE session as the top bar shows it: "Markets open" while the session runs (the next bell is its close), else
 * "Markets closed", from the market calendar's holidays and early closes. Nothing on the server or before hydration.
 */
export function MarketStatus() {
  const open = useSyncExternalStore(everyHalfMinute, () => nextBell(Date.now()).kind === "close", () => null);
  if (open === null) return null;
  return (
    <span
      className={`hidden items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium sm:inline-flex ${
        open ? "bg-accent-soft text-accent-ink" : "bg-panel-2 text-ink-2"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${open ? "bg-accent" : "bg-ink-3"}`} aria-hidden="true" />
      {open ? "Markets open" : "Markets closed"}
    </span>
  );
}
