"use client";

import { useEffect } from "react";
import { BUTTON_PRIMARY } from "@/components/ui";
import { reportError } from "@/lib/reportError";

/** A page that broke: says so, offers to try again, and tells Admin → Errors (src/lib/reportError.ts). */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => reportError(error), [error]);
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-5 text-center">
      <h1 className="font-display text-2xl text-ink">Something went wrong</h1>
      <p className="mt-2 text-sm text-ink-2">We&apos;ve been told about it. Try again, or come back in a minute.</p>
      <button
        type="button"
        onClick={reset}
        className={`mt-6 ${BUTTON_PRIMARY}`}
      >
        Try again
      </button>
    </main>
  );
}
