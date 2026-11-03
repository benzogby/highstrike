"use client";

import { useEffect, useState } from "react";
import { MONTHLY_PRICE, TRIAL_PRICE, type Library } from "@/lib/offer";
import MembershipCheckout, { PAY_BUTTON, Spinner } from "./MembershipCheckout";

/** Why the account is behind the paywall. */
export type Gate =
  /** Never joined: the $14 week. */
  | "new"
  /** Its week was used, or its membership ended: $99/month from today. */
  | "full"
  /** A $99 failed: locked until it's paid (Ben, 2026-11-03: "Lock until paid"). */
  | "owed";

/**
 * The paywall over the app, as getripping.com draws its own over the dashboard: an account that isn't a member gets it
 * over the dashboard, where every member page sends it (src/lib/membership.ts). No close button, no Escape, no
 * click-away; the app behind it is inert. The ways on are paying (the same checkout as the homepage's popup: the $14
 * week, or $99/month for someone whose week was used) or, for an account whose $99 failed, paying that invoice on
 * Stripe's page (a new tab; this page checks every few seconds and opens the app the moment it's paid), and Sign out.
 * The page renders it beside AppShell, not in it, so it stays live while the shell goes inert.
 */
export default function MemberGate({
  email,
  gate,
  publishableKey,
  library,
}: {
  email: string;
  gate: Gate;
  publishableKey: string | null;
  library: Library | null;
}) {
  const [paying, setPaying] = useState(false);
  const [full, setFull] = useState(gate === "full");

  useEffect(() => {
    const shell = document.querySelector("[data-app-shell]");
    shell?.setAttribute("inert", "");
    return () => shell?.removeAttribute("inert");
  }, []);

  const title = gate === "owed" ? "Your payment didn't go through" : full ? "Unlock HighStrike" : "Try HighStrike for a week";
  const lead =
    gate === "owed"
      ? `We couldn't charge ${MONTHLY_PRICE} for your membership, so HighStrike is paused. Pay it with any card and everything opens again right away.`
      : full
        ? `Your account is ready. ${MONTHLY_PRICE}/month opens the daily ideas, every tool and all of HighStrike Trading School. Cancel anytime.`
        : `Your account is ready. ${TRIAL_PRICE} opens everything for 7 days: the daily ideas, every tool and all of HighStrike Trading School. Then ${MONTHLY_PRICE}/month, cancel anytime.`;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="hs-gate-title" className="fixed inset-0 z-50 overflow-y-auto bg-bg/80 backdrop-blur-md">
      <div className="flex min-h-full items-center justify-center px-4 py-10">
        <div className="w-full max-w-[28rem]">
          <h2 id="hs-gate-title" className="text-balance text-center font-display text-[28px] leading-tight text-ink">
            {title}
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-pretty text-center text-[15px] leading-relaxed text-ink-2">{lead}</p>
          <div className="mt-6 rounded-xl border border-line bg-panel p-5 shadow-lg">
            {gate === "owed" ? (
              <Owed />
            ) : (
              <MembershipCheckout
                library={library}
                back="/dashboard"
                buyer={{ email }}
                publishableKey={publishableKey}
                weekUsed={gate === "full"}
                onPaying={setPaying}
                onFull={setFull}
              />
            )}
          </div>
          <form action="/auth/signout" method="post" className="mt-5 text-center text-sm text-ink-3">
            Signed in as {email} ·{" "}
            <button type="submit" disabled={paying} className="font-medium text-ink underline-offset-2 hover:underline disabled:opacity-50">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

/** Pay the failed invoice on Stripe's page (a new tab), then this page opens the app as soon as it's paid. */
function Owed() {
  const [waiting, setWaiting] = useState(false);

  useEffect(() => {
    if (!waiting) return;
    const started = Date.now();
    const timer = window.setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - started > 15 * 60_000) return window.clearInterval(timer);
      const r = await fetch("/api/billing/state", { cache: "no-store" }).catch(() => null);
      const j = (await r?.json().catch(() => null)) as { member?: boolean } | null;
      if (j?.member) {
        window.clearInterval(timer);
        window.location.reload();
      }
    }, 5000);
    return () => window.clearInterval(timer);
  }, [waiting]);

  return (
    <div>
      <a href="/api/billing/pay" target="_blank" rel="noopener" onClick={() => setWaiting(true)} className={PAY_BUTTON}>
        Pay {MONTHLY_PRICE} now
      </a>
      {waiting && (
        <p role="status" className="mt-3 flex items-center justify-center gap-2 text-sm text-ink-2">
          <Spinner />
          Waiting for the payment. This page opens HighStrike once it&apos;s through.
        </p>
      )}
      <form action="/api/billing/portal" method="post" className="mt-4 text-center text-sm text-ink-3">
        Rather change your card or cancel?{" "}
        <button type="submit" className="font-medium text-ink underline-offset-2 hover:underline">
          Manage billing
        </button>
      </form>
    </div>
  );
}
