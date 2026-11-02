"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * The scroll box around a module's lesson list on the lesson page. A module can stack 128 lessons, so on wide screens
 * the list scrolls inside the panel; this scrolls it to the lesson being watched (the row marked aria-current) when the
 * lesson changes. It moves only the box, never the page: where the list isn't a scroll box (phones), nothing moves.
 */
export default function KeepInView({ current, className, children }: { current: string; className?: string; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current;
    const row = el?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!el || !row || el.scrollHeight <= el.clientHeight) return;
    el.scrollTop = Math.max(0, row.offsetTop - (el.clientHeight - row.offsetHeight) / 2);
  }, [current]);
  return (
    <div ref={box} className={`relative ${className ?? ""}`}>
      {children}
    </div>
  );
}
