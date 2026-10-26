"use client";

import { useEffect, useState } from "react";
import { nextBell, newYorkDate } from "@/lib/marketCalendar";

// The headline's promise, live: how long until the next NYSE bell, ticking
// once a second in tabular figures. Without script it reads as a plain line.

function pad(n: number) {
  return String(n).padStart(2, "0"); // taste-skill-ignore: a clock's two-digit fields
}

function countdown(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const clock = `${pad(Math.floor((total % 86400) / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
  return days > 0 ? `${days}d ${clock}` : clock;
}

function weekday(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
}

export default function BellClock({ className = "" }: { className?: string }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    let timer = 0;
    const tick = () => {
      setNow(Date.now());
      timer = window.setTimeout(tick, 1000 - (Date.now() % 1000));
    };
    tick();
    return () => window.clearTimeout(timer);
  }, []);

  if (now == null) {
    return (
      <p className={`hs-bell ${className}`}>
        <span className="hs-bell__time">9:30</span>
        <span className="hs-bell__note">ET, the opening bell. Setups publish before it.</span>
      </p>
    );
  }

  const bell = nextBell(now);
  const which = bell.day === newYorkDate(now) ? "today's" : `${weekday(bell.day)}'s`;
  return (
    <p className={`hs-bell ${className}`} role="timer" aria-live="off">
      <span className="hs-bell__time">{countdown(bell.at - now)}</span>
      <span className="hs-bell__note">
        until {which} {bell.kind === "open" ? "opening" : "closing"} bell, {bell.time} ET.
        {bell.kind === "open" ? " Setups publish before it." : ""}
      </span>
    </p>
  );
}
