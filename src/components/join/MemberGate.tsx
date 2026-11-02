"use client";

import { useEffect, useState } from "react";
import { LIFETIME_PRICE, type Library } from "@/lib/offer";
import LifetimeCheckout from "./LifetimeCheckout";

/**
 * The paywall over the app (Ben, 2026-11-02: "Nobody gets access until they become a 397 member"), as getripping.com
 * draws its own over the dashboard: an account without the membership gets it over the dashboard, where every member
 * page sends it (src/lib/membership.ts). No close button, no Escape, no click-away; the app behind it is inert. The ways
 * on are paying (the same checkout as the homepage's popup) and Sign out. The page renders it beside AppShell, not in
 * it, so it stays live while the shell goes inert.
 */
export default function MemberGate({ email, library }: { email: string; library: Library | null }) {
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    const shell = document.querySelector("[data-app-shell]");
    shell?.setAttribute("inert", "");
    return () => shell?.removeAttribute("inert");
  }, []);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="hs-gate-title" className="fixed inset-0 z-50 overflow-y-auto bg-bg/80 backdrop-blur-md">
      <div className="flex min-h-full items-center justify-center px-4 py-10">
        <div className="w-full max-w-[28rem]">
          <h2 id="hs-gate-title" className="text-balance text-center font-display text-3xl font-bold tracking-tight">
            Unlock HighStrike
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-pretty text-center text-[15px] leading-relaxed text-ink-2">
            Your account is ready. One payment of {LIFETIME_PRICE} opens the daily trades, the tools and the Alpha Mastermind, for life.
          </p>
          <div className="mt-6 rounded-2xl border border-line-strong bg-panel p-5 shadow-2xl">
            <LifetimeCheckout library={library} back="/dashboard" onPaying={setPaying} />
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
