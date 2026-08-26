"use client";

// One-time guided tour on a member's first dashboard visit. Spotlights each
// dashboard region above a dimmed backdrop with a floating step card;
// completion (or skip) is stored on the member's profile, so it never
// repeats across devices.

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { supabaseBrowser } from "@/lib/supabase/client";
import { toastSuccess } from "@/lib/toastBus";

const STEPS: { target: string | null; title: string; body: string }[] = [
  {
    target: "tour-weather",
    title: "Your morning weather report",
    body: "Every market day before the open, the AI scores volatility, opportunity, and direction — so every idea you see is framed by the day's actual conditions.",
  },
  {
    target: "tour-setups",
    title: "Daily setups, graded in public",
    body: "Curated trade setups with entries, targets, and written reasoning. Every card is tracked to target, stop, or expiry — wins and losses land on the public scoreboard.",
  },
  {
    target: "watchlist",
    title: "Your watchlist, live",
    body: "Add any US ticker and watch it live — prices refresh automatically, trends fill in, and every row links to a full symbol page with charts, news, and insider activity.",
  },
  {
    target: "tour-activity",
    title: "The terminal taps you on the shoulder",
    body: "Reports publishing, setups closing, and your price alerts firing all land here the moment they happen.",
  },
  {
    target: null,
    title: "Six systems, two keystrokes away",
    body: "Scanner, Insider Feed, and Chatter live in the sidebar — and pressing / opens the command bar from anywhere: type any ticker or page name and hit enter.",
  },
];

export default function FirstRunTour({ userId, show }: { userId: string; show: boolean }) {
  const [open, setOpen] = useState(show);
  const [idx, setIdx] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Spotlight the current step's target.
  useEffect(() => {
    if (!open) return;
    document.querySelectorAll(".tour-highlight").forEach((el) =>
      el.classList.remove("tour-highlight")
    );
    const target = STEPS[idx]?.target;
    if (target) {
      const el = document.getElementById(target);
      if (el) {
        el.classList.add("tour-highlight");
        el.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    }
    return () => {
      document.querySelectorAll(".tour-highlight").forEach((el) =>
        el.classList.remove("tour-highlight")
      );
    };
  }, [open, idx]);

  const finish = useCallback(
    async (completed: boolean) => {
      setOpen(false);
      document.querySelectorAll(".tour-highlight").forEach((el) =>
        el.classList.remove("tour-highlight")
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
      if (completed) {
        toastSuccess("You're all set — add your first symbols to the watchlist");
      }
      await supabaseBrowser()
        .from("profiles")
        .update({ tour_done: true })
        .eq("id", userId);
    },
    [userId]
  );

  // Escape skips.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && finish(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, finish]);

  if (!open || !mounted) return null;

  const step = STEPS[idx];
  const last = idx === STEPS.length - 1;

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div className="anim-fade absolute inset-0 bg-bg/70 backdrop-blur-[2px]" />
      <div
        key={idx}
        role="dialog"
        aria-label={`Tour step ${idx + 1} of ${STEPS.length}`}
        className="anim-pop fixed bottom-6 left-1/2 z-[52] w-[min(92vw,26rem)] -translate-x-1/2 rounded-2xl border border-line bg-panel p-5 shadow-2xl"
      >
        <p className="text-[10px] uppercase tracking-wider text-ink-3">
          {idx + 1} of {STEPS.length}
        </p>
        <h2 className="mt-1 font-display text-lg font-bold">{step.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">{step.body}</p>
        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => finish(false)}
            className="text-xs text-ink-3 transition hover:text-ink"
          >
            Skip tour
          </button>
          <div className="flex items-center gap-2">
            {idx > 0 && (
              <button
                type="button"
                onClick={() => setIdx(idx - 1)}
                className="press rounded-lg border border-line-strong px-4 py-2 font-display text-sm font-semibold text-ink-2 transition hover:text-ink"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={() => (last ? finish(true) : setIdx(idx + 1))}
              className="press rounded-lg bg-accent px-5 py-2 font-display text-sm font-semibold text-bg transition hover:bg-accent-2"
            >
              {last ? "Finish" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
