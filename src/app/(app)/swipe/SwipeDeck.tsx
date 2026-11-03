"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { DeckCard } from "@/lib/options/deck";
import SetupCard from "./SetupCard";

/** How far a card must travel to count as a swipe, in pixels. */
const THRESHOLD = 100;

type Fly = { id: string; dx: number; dy: number };

/**
 * The swipe deck (step 2 of the swipe app; Ben 2026-11-02): drag the top card right to save it to your ideas, left to
 * pass, up for the details; or use the buttons or the arrow keys. More cards load when the deck runs low.
 * `save` and `more` are the server actions (or stand-ins on the preview page).
 */
export default function SwipeDeck({
  initial,
  save,
  more,
  streak = 0,
  swipedToday = false,
  favorites = [],
}: {
  initial: DeckCard[];
  favorites?: string[];
  streak?: number;
  swipedToday?: boolean;
  save: (id: string, action: "right" | "left") => Promise<{ ok: true } | { error: string }>;
  more: (skip: string[]) => Promise<DeckCard[]>;
}) {
  const [deck, setDeck] = useState(initial);
  const [drag, setDrag] = useState({ dx: 0, dy: 0, on: false });
  const [fly, setFly] = useState<Fly | null>(null);
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(0);
  const [swiped, setSwiped] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const seen = useRef(new Set(initial.map((c) => c.id)));
  const top = deck[0];

  const refill = useCallback(
    async (current: DeckCard[]) => {
      if (loading || current.length > 4) return;
      setLoading(true);
      const next = await more([...seen.current]).catch(() => []);
      const fresh = next.filter((c) => !seen.current.has(c.id));
      fresh.forEach((c) => seen.current.add(c.id));
      setDeck((d) => [...d, ...fresh]);
      setLoading(false);
    },
    [loading, more]
  );

  const decide = useCallback(
    (action: "right" | "left") => {
      if (!top || fly) return;
      setFly({ id: top.id, dx: action === "right" ? 600 : -600, dy: drag.dy });
      setOpen(false);
      setError("");
      if (action === "right") setSaved((n) => n + 1);
      setSwiped((n) => n + 1);
      void save(top.id, action).then((r) => {
        if ("error" in r) setError(r.error);
      });
      setTimeout(() => {
        setDeck((d) => {
          const rest = d.slice(1);
          void refill(rest);
          return rest;
        });
        setFly(null);
        setDrag({ dx: 0, dy: 0, on: false });
      }, 220);
    },
    [top, fly, drag.dy, save, refill]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowRight") decide("right");
      else if (e.key === "ArrowLeft") decide("left");
      else if (e.key === "ArrowUp") setOpen(true);
      else if (e.key === "ArrowDown") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [decide]);

  const onDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button,a")) return;
    start.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ dx: 0, dy: 0, on: true });
  };
  const onMove = (e: React.PointerEvent) => {
    if (!start.current) return;
    setDrag({ dx: e.clientX - start.current.x, dy: e.clientY - start.current.y, on: true });
  };
  const onUp = () => {
    if (!start.current) return;
    start.current = null;
    if (drag.dx > THRESHOLD) decide("right");
    else if (drag.dx < -THRESHOLD) decide("left");
    else {
      if (drag.dy < -THRESHOLD) setOpen(true);
      else if (drag.dy > THRESHOLD) setOpen(false);
      setDrag({ dx: 0, dy: 0, on: false });
    }
  };

  const moving = fly && top && fly.id === top.id ? fly : drag;
  const tilt = (moving.dx / 22).toFixed(2);
  const lean = Math.max(-1, Math.min(1, moving.dx / THRESHOLD));

  return (
    <div className="mx-auto flex w-full max-w-[420px] flex-col">
      <div className="mb-3 flex items-center justify-between gap-3 text-[13px] text-ink-3">
        <span>
          {(() => {
            // The streak counts today once the first swipe of the day is in.
            const days = streak + (swiped > 0 && !swipedToday ? 1 : 0);
            return days > 0 ? <span className="mr-2 font-medium text-ink">🔥 {days}-day streak</span> : null;
          })()}
          {saved > 0 ? `${saved} saved` : "Right to save, left to pass, up for details"}
        </span>
        <span className="flex shrink-0 gap-3">
          <Link href="/swipe/board" className="font-medium text-ink-2 hover:text-ink">
            Board
          </Link>
          <Link href="/swipe/saved" className="font-medium text-ink-2 hover:text-ink">
            Saved
          </Link>
        </span>
      </div>

      <div className="relative h-[min(640px,calc(100svh-200px))] min-h-[520px] select-none">
        {!top && (
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border border-line bg-panel p-6 text-center">
            <p className="font-display text-xl text-ink">{loading ? "Dealing more cards…" : "You're through the deck"}</p>
            <p className="mt-2 text-sm text-ink-2">{loading ? "" : "New setups arrive as the market moves. Check your saved ones meanwhile."}</p>
            {!loading && (
              <Link href="/swipe/saved" className="mt-4 text-sm font-medium text-accent hover:underline">
                See what you saved
              </Link>
            )}
          </div>
        )}
        {deck.slice(0, 3).map((c, i) => {
          const isTop = i === 0;
          const style: React.CSSProperties = isTop
            ? {
                transform: `translate(${moving.dx}px, ${Math.min(0, moving.dy) / 3}px) rotate(${tilt}deg)`,
                transition: drag.on && !fly ? "none" : "transform 220ms cubic-bezier(.2,.8,.2,1)",
                zIndex: 3,
                touchAction: "none",
              }
            : { transform: `translateY(${i * 10}px) scale(${1 - i * 0.035})`, zIndex: 3 - i, transition: "transform 220ms ease" };
          return (
            <article
              key={c.id}
              aria-hidden={!isTop}
              onPointerDown={isTop ? onDown : undefined}
              onPointerMove={isTop ? onMove : undefined}
              onPointerUp={isTop ? onUp : undefined}
              onPointerCancel={isTop ? onUp : undefined}
              style={style}
              className={`absolute inset-0 overflow-y-auto rounded-2xl border border-line-strong bg-panel p-4 shadow-[0_24px_60px_-28px_rgba(0,0,0,.8)] ${isTop ? "cursor-grab active:cursor-grabbing" : ""}`}
            >
              {isTop && (
                <>
                  <span className="pointer-events-none absolute left-4 top-4 z-10 rounded-md border-2 border-up px-2 py-0.5 text-sm font-bold text-up" style={{ opacity: Math.max(0, lean) }}>
                    Save
                  </span>
                  <span className="pointer-events-none absolute right-4 top-4 z-10 rounded-md border-2 border-down px-2 py-0.5 text-sm font-bold text-down" style={{ opacity: Math.max(0, -lean) }}>
                    Pass
                  </span>
                </>
              )}
              <SetupCard c={c} open={isTop && open} />
            </article>
          );
        })}
      </div>

      {favorites.length > 0 && <p className="mt-2 text-center text-[12px] text-ink-3">Showing you more {favorites.join(" and ")}, from what you save.</p>}
      {error && <p className="mt-2 text-center text-sm text-down">{error}</p>}

      <div className="mt-4 flex items-center justify-center gap-5">
        <button type="button" onClick={() => decide("left")} disabled={!top} aria-label="Pass" className="grid size-14 place-items-center rounded-full border border-line-strong bg-panel text-2xl text-down transition hover:bg-panel-2 disabled:opacity-40">
          ✕
        </button>
        <button type="button" onClick={() => setOpen((o) => !o)} disabled={!top} aria-label={open ? "Hide details" : "Show details"} className="grid size-11 place-items-center rounded-full border border-line-strong bg-panel text-lg text-ink-2 transition hover:bg-panel-2 disabled:opacity-40">
          {open ? "↓" : "↑"}
        </button>
        <button type="button" onClick={() => decide("right")} disabled={!top} aria-label="Save" className="grid size-14 place-items-center rounded-full bg-accent text-2xl text-on-accent transition hover:bg-accent-2 disabled:opacity-40">
          ♥
        </button>
      </div>
    </div>
  );
}
