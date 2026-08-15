"use client";

import { useState } from "react";

type Status = "idle" | "loading" | "done" | "error";

export default function WaitlistForm({ compact = false }: { compact?: boolean }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "loading") return;
    setStatus("loading");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      setStatus("done");
      setMessage(data.message ?? "You're on the list.");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  if (status === "done") {
    return (
      <p className="rounded-lg border border-line bg-panel px-4 py-3 text-sm text-ink-2">
        <span className="mr-2 text-up">✓</span>
        {message}
      </p>
    );
  }

  return (
    <form
      onSubmit={submit}
      className={`flex w-full ${compact ? "max-w-md" : "max-w-lg"} flex-col gap-3 sm:flex-row`}
    >
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        aria-label="Email address"
        className="h-12 flex-1 rounded-lg border border-line bg-panel px-4 text-sm text-ink placeholder:text-ink-3 outline-none transition focus:border-accent/60 focus:ring-2 focus:ring-accent/20"
      />
      <button
        type="submit"
        disabled={status === "loading"}
        className="h-12 shrink-0 rounded-lg bg-accent px-6 font-display text-sm font-semibold text-bg transition hover:bg-accent-2 disabled:opacity-60"
      >
        {status === "loading" ? "Joining…" : "Get Access Now"}
      </button>
      {status === "error" && (
        <p className="text-sm text-down sm:absolute sm:mt-14">{message}</p>
      )}
    </form>
  );
}
