"use client";

import { useSyncExternalStore } from "react";
import { CONSENT_EVENT, readConsent, saveConsent } from "@/lib/consent";

// The cookie banner, on every page until this browser answers (src/lib/consent.ts). Pinned to the bottom corner, above
// everything but the join popup, which is a modal <dialog> on top of it. .hs-join is the popup's dark palette, defined
// only by the homepage's landing.css, so the banner is dark there and in the site's own theme everywhere else.
function subscribe(changed: () => void) {
  window.addEventListener(CONSENT_EVENT, changed);
  return () => window.removeEventListener(CONSENT_EVENT, changed);
}

export default function CookieBanner() {
  // Closed on the server and in the first paint; opens once the browser shows it hasn't answered.
  const open = useSyncExternalStore(subscribe, () => readConsent() === null, () => false);

  if (!open) return null;
  return (
    <div
      role="region"
      aria-label="Cookies"
      className="hs-join fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-xl border border-line-strong bg-panel p-4 text-ink shadow-2xl sm:inset-x-auto sm:right-4 sm:bottom-4"
    >
      <p className="text-sm leading-relaxed text-ink-2">
        We use essential cookies to keep you signed in. With your OK, we also keep a random ID in your browser to count
        visits. No ads, no cross-site tracking.{" "}
        <a href="/privacy-policy#cookies" className="text-ink underline underline-offset-2">
          Privacy Policy
        </a>
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => saveConsent("all")}
          className="h-9 flex-1 rounded-lg bg-accent px-3 font-display text-sm font-semibold text-bg transition hover:bg-accent-2"
        >
          Accept
        </button>
        <button
          type="button"
          onClick={() => saveConsent("essential")}
          className="h-9 flex-1 rounded-lg border border-line-strong px-3 font-display text-sm font-semibold text-ink transition hover:border-accent/50"
        >
          Essential only
        </button>
      </div>
    </div>
  );
}
