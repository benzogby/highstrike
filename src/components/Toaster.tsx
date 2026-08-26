"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { subscribeToToasts, type ToastEvent } from "@/lib/toastBus";

const SHOW_MS = 3500;
const EXIT_MS = 220;

type Item = ToastEvent & { leaving?: boolean };

export default function Toaster() {
  const [items, setItems] = useState<Item[]>([]);
  const [mounted, setMounted] = useState(false);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    setMounted(true);
    const unsub = subscribeToToasts((t) => {
      setItems((cur) => [...cur.slice(-3), t]);
      timers.current.set(
        t.id,
        setTimeout(() => dismiss(t.id), SHOW_MS)
      );
    });
    const map = timers.current;
    return () => {
      unsub();
      map.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function dismiss(id: string) {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setItems((cur) => cur.map((i) => (i.id === id ? { ...i, leaving: true } : i)));
    setTimeout(() => {
      setItems((cur) => cur.filter((i) => i.id !== id));
    }, EXIT_MS);
  }

  if (!mounted) return null;

  return createPortal(
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-5 right-5 z-[60] flex w-[min(92vw,22rem)] flex-col gap-2"
    >
      {items.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`pointer-events-auto flex items-start gap-3 rounded-xl border bg-panel px-4 py-3 shadow-xl ${
            t.leaving ? "toast-out" : "toast-in"
          } ${t.kind === "success" ? "border-accent/40" : "border-down/40"}`}
        >
          <span
            className={`mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full font-display text-[11px] font-bold ${
              t.kind === "success" ? "bg-accent text-bg" : "bg-down text-bg"
            }`}
            aria-hidden="true"
          >
            {t.kind === "success" ? "✓" : "!"}
          </span>
          <p className="min-w-0 flex-1 text-sm leading-snug text-ink">{t.message}</p>
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            aria-label="Dismiss notification"
            className="flex-none text-xs text-ink-3 transition hover:text-ink"
          >
            ✕
          </button>
        </div>
      ))}
    </div>,
    document.body
  );
}
