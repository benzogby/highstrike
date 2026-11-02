"use client";

import { resetConsent } from "@/lib/consent";

/** The footer's Cookie settings: opens the cookie banner again to change the answer. */
export default function CookieSettings() {
  return (
    <button type="button" onClick={resetConsent}>
      Cookie settings
    </button>
  );
}
