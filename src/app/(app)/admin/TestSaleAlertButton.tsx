"use client";

import { useState } from "react";
import { sendTestSaleAlert } from "./saleAlert";

/** Sends the sale alert with a made-up buyer, so the email can be checked without a purchase (./saleAlert.ts). */
export default function TestSaleAlertButton({ to }: { to: string }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function run() {
    if (busy) return;
    setBusy(true);
    setResult(null);
    setResult(await sendTestSaleAlert().catch(() => ({ ok: false, message: "Couldn't reach the server. Try again." })));
    setBusy(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="rounded-lg border border-line-strong bg-panel-2 px-4 py-2 text-sm font-medium text-ink transition hover:bg-panel-3 disabled:opacity-60"
      >
        {busy ? "Sending…" : "Send a test sale alert"}
      </button>
      <span className={`text-sm ${result ? (result.ok ? "text-up" : "text-down") : "text-ink-3"}`}>
        {result ? result.message : `Every new $14 week emails ${to}.`}
      </span>
    </div>
  );
}
