"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/reportError";

/** The root layout itself broke: a bare page of its own (it replaces <html>), and a note to Admin → Errors. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => reportError(error), [error]);
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "system-ui, sans-serif", background: "#0b0f0e", color: "#f2f6f4" }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 22, margin: 0 }}>Something went wrong</h1>
          <p style={{ color: "#b4bfba", fontSize: 14 }}>We&apos;ve been told about it. Try again in a minute.</p>
          <button type="button" onClick={reset} style={{ marginTop: 12, padding: "8px 16px", borderRadius: 8, border: 0, background: "#1fbf86", color: "#04070a", fontWeight: 600, cursor: "pointer" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
