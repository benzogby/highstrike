"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import NavIcon from "@/components/NavIcon";
import Sheet from "@/components/Sheet";
import { BELL_ICON } from "@/components/appNav";

type Item = { id: string; kind: string; title: string; body: string | null; href: string | null; created_at: string; read_at: string | null };

const MINUTE = 60_000;

function ago(iso: string) {
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return "Just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 7 * 86_400) return `${Math.floor(s / 86_400)}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const markRead = (body: { all: true } | { id: string }) =>
  fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), keepalive: true })
    .then((r) => (r.ok ? (r.json() as Promise<{ unread?: number }>) : null))
    .catch(() => null);

/**
 * The top bar's bell (Ben, 2026-11-03: alerts by email and an in-app bell): the unread count, and on a tap the latest 20
 * (a dropdown from sm up, a sheet on a phone) with Mark all read. Data from /api/notifications, never Supabase's
 * library, since the frame loads this on every page. The count is asked once when the frame loads and when the bell
 * opens, then at most once a minute and only while the tab is in view.
 */
export default function NotificationBell() {
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<Item[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const asked = useRef(0);

  useEffect(() => {
    let alive = true;
    async function count() {
      asked.current = Date.now();
      try {
        const r = await fetch("/api/notifications?count", { cache: "no-store" });
        const d = r.ok ? ((await r.json()) as { unread?: number }) : null;
        if (alive && d) setUnread(d.unread ?? 0);
      } catch {
        // keep the last count
      }
    }
    void count();
    const tick = () => {
      if (document.visibilityState === "visible" && Date.now() - asked.current >= MINUTE) void count();
    };
    const timer = setInterval(tick, MINUTE);
    document.addEventListener("visibilitychange", tick);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);

  const show = async () => {
    setOpen(true);
    setFailed(false);
    asked.current = Date.now();
    try {
      const r = await fetch("/api/notifications", { cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      const d = (await r.json()) as { unread?: number; items?: Item[] };
      setItems(d.items ?? []);
      setUnread(d.unread ?? 0);
    } catch {
      setFailed(true);
    }
  };

  const readAll = async () => {
    const now = new Date().toISOString();
    setUnread(0);
    setItems((list) => list?.map((i) => (i.read_at ? i : { ...i, read_at: now })) ?? list);
    const d = await markRead({ all: true });
    if (d?.unread != null) setUnread(d.unread);
  };

  const readOne = (item: Item) => {
    setOpen(false);
    if (item.read_at) return;
    setUnread((n) => Math.max(0, n - 1));
    setItems((list) => list?.map((i) => (i.id === item.id ? { ...i, read_at: new Date().toISOString() } : i)) ?? list);
    void markRead({ id: item.id });
  };

  const label = unread > 0 ? `Notifications, ${unread} unread` : "Notifications";
  return (
    <>
      <button
        type="button"
        onClick={show}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Notifications"
        className="relative grid h-9 w-9 place-items-center rounded-lg border border-line-strong bg-panel-2 text-ink-2 transition hover:bg-panel-3 hover:text-ink lg:h-8 lg:w-8 lg:border-line lg:bg-panel"
      >
        <NavIcon d={BELL_ICON} />
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-1.5 -top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-accent px-1 font-mono-nums text-[10px] font-semibold leading-none text-on-accent ring-2 ring-bg"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} label="Notifications" menu>
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <p className="font-display text-base text-ink">Notifications</p>
          <button
            type="button"
            onClick={readAll}
            disabled={unread === 0}
            className="rounded-md px-2 py-1 text-[13px] font-medium text-accent transition hover:bg-accent-soft disabled:cursor-default disabled:text-ink-3 disabled:hover:bg-transparent"
          >
            Mark all read
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" aria-live="polite">
          {failed ? (
            <p className="px-4 py-10 text-center text-sm text-ink-3">Couldn&apos;t load your notifications. Try again in a moment.</p>
          ) : items === null ? (
            <ul aria-label="Loading notifications" className="divide-y divide-line">
              {[0, 1, 2].map((i) => (
                <li key={i} className="px-4 py-3">
                  <span className="skeleton block h-3.5 w-3/5 rounded" />
                  <span className="skeleton mt-2 block h-3 w-2/5 rounded" />
                </li>
              ))}
            </ul>
          ) : items.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-panel-2 text-ink-3 ring-1 ring-inset ring-line-strong">
                <NavIcon d={BELL_ICON} size={18} />
              </span>
              <p className="mt-3 text-sm font-medium text-ink">Nothing yet</p>
              <p className="mt-1 text-[13px] text-ink-3">When a price alert you set goes off, it shows up here and in your email.</p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {items.map((item) => {
                const row = (
                  <>
                    <span aria-hidden="true" className={`mt-1.5 h-2 w-2 flex-none rounded-full ${item.read_at ? "bg-transparent" : "bg-accent"}`} />
                    <span className="min-w-0 flex-1">
                      <span className={`block text-sm leading-snug ${item.read_at ? "text-ink-2" : "font-medium text-ink"}`}>
                        {!item.read_at && <span className="sr-only">Unread: </span>}
                        {item.title}
                      </span>
                      {item.body && <span className="mt-0.5 block text-[13px] leading-snug text-ink-3">{item.body}</span>}
                      <time dateTime={item.created_at} className="mt-1 block text-xs text-ink-3">
                        {ago(item.created_at)}
                      </time>
                    </span>
                  </>
                );
                return (
                  <li key={item.id}>
                    {item.href ? (
                      <Link href={item.href} onClick={() => readOne(item)} className="flex gap-3 px-4 py-3 transition-colors hover:bg-panel-2">
                        {row}
                      </Link>
                    ) : (
                      <button type="button" onClick={() => readOne(item)} className="flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-panel-2">
                        {row}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <Link href="/settings" onClick={() => setOpen(false)} className="block border-t border-line px-4 py-2.5 text-center text-[13px] text-ink-2 transition hover:bg-panel-2 hover:text-ink">
          Manage price alerts
        </Link>
      </Sheet>
    </>
  );
}
