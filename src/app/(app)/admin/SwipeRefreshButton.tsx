"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BUTTON_SECONDARY } from "@/components/ui";

/** Starts the swipe deck's refresh now (it keeps going in the background until every stock is priced). */
export default function SwipeRefreshButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  async function run() {
    if (busy) return;
    setBusy(true);
    setMsg("Pricing the first batch, about four minutes…");
    try {
      const res = await fetch("/api/cron/swipe-refresh", { method: "POST" });
      const d = (await res.json().catch(() => ({}))) as { priced?: number; cards?: number; left?: number; error?: string };
      if (!res.ok) throw new Error(d.error ?? "The refresh failed.");
      setMsg(`Priced ${d.priced} stocks, built ${d.cards} cards.${d.left ? ` ${d.left} more are being priced in the background.` : ""}`);
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "The refresh failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-col items-end gap-1.5">
      <button type="button" onClick={run} disabled={busy} className={BUTTON_SECONDARY}>
        {busy ? "Refreshing…" : "Refresh the deck"}
      </button>
      {msg && <span className="max-w-xs text-right text-xs text-ink-2">{msg}</span>}
    </div>
  );
}
