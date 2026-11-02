"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

/**
 * `next`: where Google's way back lands once signed in (the homepage's popup passes "/?join=1" to reopen at checkout).
 * `agreed`: they ticked the Terms box, so the callback records it on the account (src/lib/terms.ts); `disabled` until then.
 */
export default function GoogleAuthButton({
  label,
  next = "/dashboard",
  agreed = false,
  disabled = false,
}: {
  label: string;
  next?: string;
  agreed?: boolean;
  disabled?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function signIn() {
    if (loading || disabled) return;
    setError("");
    setLoading(true);
    const supabase = supabaseBrowser();
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}${agreed ? "&terms=1" : ""}`,
      },
    });
    // On success the browser navigates away; we only get here on failure.
    setLoading(false);
    if (err) {
      setError(
        /not enabled|provider/i.test(err.message)
          ? "Google sign-in isn't available right now — use email instead."
          : err.message
      );
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={signIn}
        disabled={loading || disabled}
        className="flex h-12 w-full items-center justify-center gap-3 rounded-lg border border-line-strong bg-panel font-display text-sm font-semibold text-ink transition hover:border-accent/50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M23.52 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.46a5.52 5.52 0 01-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3.01c-1.07.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.95H1.27v3.11A12 12 0 0012 24z"
          />
          <path
            fill="#FBBC05"
            d="M5.28 14.28A7.21 7.21 0 014.9 12c0-.79.14-1.56.38-2.28V6.61H1.27a12 12 0 000 10.78l4.01-3.11z"
          />
          <path
            fill="#EA4335"
            d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44A11.98 11.98 0 0012 0 12 12 0 001.27 6.61l4.01 3.11C6.22 6.88 8.87 4.77 12 4.77z"
          />
        </svg>
        {loading ? "Redirecting…" : label}
      </button>
      {error && <p className="mt-2 text-sm text-down">{error}</p>}
    </div>
  );
}

export function AuthDivider() {
  return (
    <div className="flex items-center gap-3 py-1" aria-hidden="true">
      <span className="h-px flex-1 bg-line" />
      <span className="text-xs uppercase tracking-wider text-ink-3">or</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
