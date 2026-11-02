"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import type { Library } from "@/lib/offer";
import { JOIN_EVENT, JOIN_LINK } from "./events";
import LifetimeCheckout, { Spinner, type Buyer } from "./LifetimeCheckout";

/** What GET /api/billing/lifetime says about this browser. */
type Where = { signedIn?: boolean; email?: string; member?: boolean; termsOnRecord?: boolean; publishableKey?: string | null };

type Step =
  | { at: "closed" }
  /** Asking where this browser stands (/api/billing/lifetime). */
  | { at: "checking" }
  | { at: "pay"; buyer: Buyer; publishableKey: string | null }
  | { at: "unreachable" }
  /** On to the app. */
  | { at: "leaving"; title: string };

const NO_SUBSCRIBE = () => () => {};

/**
 * The homepage's payment popup (Ben, 2026-11-02: "Lifetime access should just open to the payment popup. Account is
 * created upon payment"). Get lifetime access opens it straight to the $397 checkout (LifetimeCheckout): a visitor types
 * the email their account opens under when the payment goes through; a signed-in account pays for itself; a member goes
 * on to the app. Members who are signed out have Sign in under it. /?join=1 opens it on arrival (the rest of the site's
 * links, and Stripe's page when someone leaves it). Mounted once per page; JoinButton opens it. It's drawn on <body>,
 * outside the homepage's [data-landing] frame, whose element resets would undo its spacing; landing.css → .hs-join gives
 * it the homepage's colours.
 */
export default function JoinDialog({ library }: { library: Library | null }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState<Step>({ at: "closed" });
  const [paying, setPaying] = useState(false);
  // On <body> once there is one (not while the server renders or the page hydrates).
  const mounted = useSyncExternalStore(NO_SUBSCRIBE, () => true, () => false);

  /** Where the browser stands, and the step that follows. */
  const decide = useCallback(async () => {
    setStep({ at: "checking" });
    const response = await fetch("/api/billing/lifetime", { cache: "no-store" }).catch(() => null);
    const a = (await response?.json().catch(() => null)) as Where | null;
    if (!response?.ok || !a) return setStep({ at: "unreachable" });
    if (a.member) {
      setStep({ at: "leaving", title: "You're a member. Opening HighStrike" });
      return window.location.assign(new URL("/dashboard", window.location.origin).href);
    }
    const buyer: Buyer = a.signedIn ? { email: a.email || null, termsOnRecord: Boolean(a.termsOnRecord) } : { email: null, termsOnRecord: false };
    setStep({ at: "pay", buyer, publishableKey: a.publishableKey ?? null });
  }, []);

  const open = useCallback(() => {
    if (!dialog.current?.open) dialog.current?.showModal();
    void decide();
  }, [decide]);

  // The buttons' event, and ?join=1 on arrival (taken off the address after, so a reload doesn't open it again).
  useEffect(() => {
    if (!mounted) return;
    window.addEventListener(JOIN_EVENT, open);
    const q = new URLSearchParams(window.location.search);
    let t: number | undefined;
    if (q.get("join") === "1") {
      q.delete("join");
      const rest = q.toString();
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${rest ? `?${rest}` : ""}${window.location.hash}`);
      t = window.setTimeout(open, 0);
    }
    return () => {
      window.removeEventListener(JOIN_EVENT, open);
      window.clearTimeout(t);
    };
  }, [open, mounted]);

  const close = () => {
    if (!paying) dialog.current?.close();
  };

  if (!mounted) return null;
  return createPortal(
    <dialog
      ref={dialog}
      aria-labelledby="hs-join-title"
      className="hs-join m-auto max-h-[92svh] w-[min(100%-2rem,28rem)] overflow-y-auto rounded-2xl border border-line-strong bg-panel p-0 text-ink outline-none shadow-2xl backdrop:bg-black/70 backdrop:backdrop-blur-sm"
      onCancel={(e) => {
        if (paying) e.preventDefault();
      }}
      onClose={() => setStep({ at: "closed" })}
      onClick={(e) => {
        if (e.target === dialog.current) close();
      }}
    >
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
        <h2 id="hs-join-title" className="font-display text-lg font-semibold">
          {step.at === "leaving" ? step.title : "Get lifetime access"}
        </h2>
        <button
          type="button"
          onClick={close}
          disabled={paying}
          aria-label="Close"
          className="grid size-8 place-items-center rounded-lg text-ink-2 transition hover:bg-panel-2 hover:text-ink disabled:opacity-40"
        >
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="size-4">
            <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {(step.at === "checking" || step.at === "closed" || step.at === "leaving") && (
        <div className="px-6 py-14 text-center text-accent">
          <Spinner className="mx-auto size-5" />
        </div>
      )}

      {step.at === "unreachable" && (
        <div className="px-5 py-6">
          <p role="alert" className="rounded-lg border border-down/30 bg-down/10 px-3 py-2.5 text-sm text-down">
            We couldn&apos;t reach HighStrike just now. Check your connection and try again.
          </p>
          <button type="button" onClick={() => void decide()} className="mt-4 text-sm font-semibold text-ink underline-offset-2 hover:underline">
            Try again
          </button>
        </div>
      )}

      {step.at === "pay" && (
        <div className="px-5 py-5">
          <LifetimeCheckout library={library} back={JOIN_LINK} buyer={step.buyer} publishableKey={step.publishableKey} onPaying={setPaying} />
          {!step.buyer.email && (
            <p className="mt-4 text-center text-xs text-ink-3">
              Already a member?{" "}
              <a href="/signin?next=/dashboard" className="font-semibold text-ink underline-offset-2 hover:underline">
                Sign in
              </a>
            </p>
          )}
        </div>
      )}
    </dialog>,
    document.body
  );
}
