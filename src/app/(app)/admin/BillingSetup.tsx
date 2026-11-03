"use client";

import { useState } from "react";
import { addWebhookEvents, checkBillingSetup, type Setup } from "./setupActions";

/** Admin → Overview: checks the membership's Stripe setup on a click, and adds the webhook's missing events on another. */
export default function BillingSetup() {
  const [busy, setBusy] = useState(false);
  const [setup, setSetup] = useState<Setup | null>(null);

  async function run(act: () => Promise<Setup>) {
    if (busy) return;
    setBusy(true);
    setSetup(await act().catch((e) => ({ checks: [], missingEvents: [], endpoint: null, error: e instanceof Error ? e.message : "Couldn't reach the server." })));
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => run(checkBillingSetup)}
          disabled={busy}
          className="rounded-lg border border-line-strong bg-panel-2 px-4 py-2 text-sm font-medium text-ink transition hover:bg-panel-3 disabled:opacity-60"
        >
          {busy ? "Checking…" : "Check billing setup"}
        </button>
        {setup && setup.missingEvents.length > 0 && setup.endpoint && (
          <button
            type="button"
            onClick={() => run(addWebhookEvents)}
            disabled={busy}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-on-accent transition hover:bg-accent-2 disabled:opacity-60"
          >
            Add the missing events
          </button>
        )}
      </div>
      {setup && (
        <ul className="grid gap-1.5 text-sm">
          {setup.checks.map((c) => (
            <li key={c.label} className="flex items-start gap-2">
              <span className={`mt-1.5 size-1.5 flex-none rounded-full ${c.ok ? "bg-up" : "bg-warn"}`} aria-hidden="true" />
              <span>
                <b className="font-medium text-ink">{c.label}:</b> <span className="text-ink-2">{c.detail}</span>
              </span>
            </li>
          ))}
          {setup.error && <li className="text-down">{setup.error}</li>}
        </ul>
      )}
    </div>
  );
}
