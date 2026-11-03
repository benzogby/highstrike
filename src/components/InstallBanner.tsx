"use client";

import { useEffect, useState } from "react";

const KEY = "hs-install-dismissed";

/** Chrome's install prompt, kept for the Install button (Android). */
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

/**
 * "Add HighStrike to your home screen" (Ben, 2026-11-03: "Yes, one small banner"): for a member on a phone's browser,
 * once, so HighStrike opens like an app (src/app/manifest.ts). Android gets Chrome's own Install button when it offers
 * one; iPhone gets Safari's two steps. Gone for good once dismissed or installed, and never shown in the installed app.
 */
export default function InstallBanner() {
  const [show, setShow] = useState<"ios" | "android" | null>(null);
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem(KEY)) return;
    } catch {
      return;
    }
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const phone = window.matchMedia("(max-width: 1023px) and (pointer: coarse)").matches;
    if (standalone || !phone) return;
    const ua = navigator.userAgent;
    const ios = /iPhone|iPad|iPod/.test(ua);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPrompt);
      setShow("android");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    // Shown after a moment, so it never jumps in while the page draws.
    const t = window.setTimeout(() => setShow((s) => s ?? (ios ? "ios" : /Android/.test(ua) ? "android" : null)), 1500);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.clearTimeout(t);
    };
  }, []);

  const dismiss = () => {
    setShow(null);
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* shown again next time, which is fine */
    }
  };

  if (!show) return null;
  return (
    <div role="region" aria-label="Add HighStrike to your home screen" className="anim-rise mb-5 flex items-start gap-3 rounded-xl border border-line-strong bg-panel-2 px-4 py-3 lg:hidden">
      <img src="/app-icons/icon-192.png" alt="" width={36} height={36} className="mt-0.5 size-9 flex-none rounded-lg" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">Add HighStrike to your home screen</p>
        <p className="mt-0.5 text-[13px] leading-snug text-ink-2">
          {show === "ios" ? (
            <>
              Tap <b className="font-medium text-ink">Share</b> at the bottom of Safari, then <b className="font-medium text-ink">Add to Home Screen</b>. It opens like an app.
            </>
          ) : prompt ? (
            "One tap and it opens like an app, full screen."
          ) : (
            <>
              Tap <b className="font-medium text-ink">⋮</b> in Chrome, then <b className="font-medium text-ink">Install app</b>. It opens like an app.
            </>
          )}
        </p>
        {show === "android" && prompt && (
          <button
            type="button"
            onClick={async () => {
              await prompt.prompt().catch(() => {});
              const choice = await prompt.userChoice.catch(() => null);
              if (choice?.outcome === "accepted") dismiss();
            }}
            className="mt-2 h-8 rounded-lg bg-accent px-3 text-sm font-semibold text-on-accent transition hover:bg-accent-2"
          >
            Install
          </button>
        )}
      </div>
      <button type="button" onClick={dismiss} aria-label="Dismiss" className="grid size-7 flex-none place-items-center rounded-md text-ink-3 transition hover:bg-panel-3 hover:text-ink">
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="size-3.5">
          <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
