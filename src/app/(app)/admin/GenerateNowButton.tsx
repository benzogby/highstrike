"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function GenerateNowButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function run() {
    if (busy) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/cron/generate-setups?force=1", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setMsg(
        `Generated ${data.setups ?? 0} setups for ${data.date} (${data.model ?? "?"}).`
      );
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="rounded-lg bg-accent px-4 py-2 font-display text-sm font-semibold text-bg transition hover:bg-accent-2 disabled:opacity-60"
      >
        {busy ? "Generating…" : "Generate today's report"}
      </button>
      {msg && <span className="text-sm text-ink-2">{msg}</span>}
    </div>
  );
}
