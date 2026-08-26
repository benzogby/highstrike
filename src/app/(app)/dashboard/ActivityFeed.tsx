"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type Event = {
  id: string;
  kind: string;
  message: string;
  ticker: string | null;
  user_id: string | null;
  created_at: string;
};

const REFRESH_MS = 60_000;

function relTime(iso: string) {
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function ActivityFeed() {
  const [events, setEvents] = useState<Event[] | null>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      const { data } = await supabaseBrowser()
        .from("activity_events")
        .select("id, kind, message, ticker, user_id, created_at")
        .order("created_at", { ascending: false })
        .limit(8);
      if (alive) setEvents((data ?? []) as Event[]);
    }
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  return (
    <div className="mt-3 rounded-2xl border border-line bg-panel">
      {events == null && (
        <p className="px-5 py-8 text-center text-sm text-ink-3">Loading…</p>
      )}
      {events != null && events.length === 0 && (
        <p className="px-5 py-8 text-center text-sm text-ink-3">
          Nothing yet — reports, setup closes, and your fired alerts land here.
        </p>
      )}
      {events != null && events.length > 0 && (
        <ul className="divide-y divide-line">
          {events.map((e) => (
            <li key={e.id} className="flex items-start gap-3 px-5 py-3.5">
              <span
                className={`mt-1.5 h-1.5 w-1.5 flex-none rounded-full ${
                  e.kind === "alert_fired" || e.kind === "report_published"
                    ? "bg-accent"
                    : "bg-line-strong"
                }`}
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className="text-sm text-ink">
                  {e.user_id && (
                    <span className="mr-1.5 rounded bg-panel-2 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-ink-3">
                      you
                    </span>
                  )}
                  {e.ticker ? (
                    <Link
                      href={`/symbol/${e.ticker}`}
                      className="transition hover:text-accent"
                    >
                      {e.message}
                    </Link>
                  ) : (
                    e.message
                  )}
                </p>
                <p className="mt-0.5 font-mono-nums text-xs text-ink-3">
                  {relTime(e.created_at)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
