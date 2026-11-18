"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { BUTTON_PRIMARY } from "@/components/ui";
import { toastSuccess } from "@/lib/toastBus";

/** One tap: price alerts at the idea's target and its stop (public.price_alerts, the member's own rows). */
export default function AlertMe({ userId, ticker, long, target, stop }: { userId: string; ticker: string; long: boolean; target: number | null; stop: number | null }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const rows = [
    target != null ? { user_id: userId, ticker, condition: long ? "above" : "below", threshold: target } : null,
    stop != null ? { user_id: userId, ticker, condition: long ? "below" : "above", threshold: stop } : null,
  ].filter((r) => r !== null);
  if (!rows.length) return null;

  async function set() {
    setState("busy");
    const { error } = await supabaseBrowser().from("price_alerts").insert(rows);
    if (error) return setState("error");
    setState("done");
    toastSuccess(`Alerts set for ${ticker}: the target and the stop`);
  }

  if (state === "done") return <p className="rounded-lg bg-accent-soft px-3 py-2 text-center text-sm text-accent-ink">Alerts set ✓ — you&apos;ll hear when {ticker} reaches the target or the stop</p>;
  return (
    <>
      <button type="button" onClick={set} disabled={state === "busy"} className={BUTTON_PRIMARY}>
        {state === "busy" ? "Setting alerts…" : "Alert me at the target and the stop"}
      </button>
      {state === "error" && <p className="text-xs text-down">The alerts couldn&apos;t be set. Try again.</p>}
    </>
  );
}
