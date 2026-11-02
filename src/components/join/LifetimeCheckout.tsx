"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { loadStripe, type Appearance, type Stripe as StripeJs } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { LIFETIME, dollars, lifetimeIncludes, type Library } from "@/lib/offer";
import { STRIPE_FONTS, appearanceFrom } from "./stripeLook";

/** What /api/billing/lifetime made (src/lib/lifetime.ts → Start). */
type Start =
  | { member: true }
  | { member: false; mode: "embedded"; clientSecret: string; paymentIntent: string; publishableKey: string; cents: number }
  | { member: false; mode: "hosted"; url: string; cents: number };

type Asked = { start: Start } | { error: string };

/** Asks the server for the checkout: the card form's payment, or Stripe's own page (`hosted`). */
async function ask(back: string, hosted: boolean): Promise<Asked> {
  try {
    const r = await fetch("/api/billing/lifetime", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ back, hosted }) });
    const j = (await r.json().catch(() => ({}))) as Partial<Start> & { error?: string };
    if (!r.ok || !("member" in j)) return { error: j.error ?? "Checkout couldn't start. Nothing was charged." };
    return { start: j as Start };
  } catch {
    return { error: "Checkout couldn't start. Check your connection and try again." };
  }
}

const stripes = new Map<string, Promise<StripeJs | null>>();
/** Stripe.js for a key, loaded once per page. */
function stripeFor(key: string) {
  let s = stripes.get(key);
  if (!s) {
    s = loadStripe(key);
    stripes.set(key, s);
  }
  return s;
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={`size-4 animate-spin ${className}`}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function Tick() {
  return (
    <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
      <svg viewBox="0 0 12 12" fill="none" aria-hidden="true" className="size-2.5">
        <path d="M2.5 6.2 5 8.5 9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function Lock() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="mr-1 inline size-3 align-[-1px]">
      <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export const PAY_BUTTON =
  "flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 font-display text-[15px] font-semibold text-bg transition hover:bg-accent-2 disabled:cursor-not-allowed disabled:opacity-60";

/** The membership as a card: what it is, the price, what it includes. */
export function OfferCard({ library }: { library: Library | null }) {
  return (
    <div className="rounded-xl border border-line-strong bg-panel-2/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 flex-1 text-[15px] font-semibold text-ink">{LIFETIME.name}</p>
        <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent">One payment</span>
      </div>
      <p className="mt-1.5 flex items-baseline gap-2">
        <span className="font-display text-[28px] font-bold leading-none tracking-tight text-ink">{dollars(LIFETIME.cents)}</span>
        <span className="text-sm text-ink-2">once, for life</span>
      </p>
      <ul className="mt-3 grid gap-2">
        {lifetimeIncludes(library).map((x) => (
          <li key={x} className="flex items-start gap-2 text-sm leading-snug text-ink-2">
            <Tick />
            {x}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The $397 checkout, in the popup on the homepage (JoinDialog) and in the paywall over the app (MemberGate), as
 * getripping.com's one-time checkout draws it: the membership's card, then Stripe's Payment Element in the page's colours,
 * Due today and Pay. Paid, the browser goes to /welcome with the payment's id, which turns access on before the page
 * draws. Without Stripe's publishable key on the server the card form can't be embedded, so Pay opens Stripe's own
 * checkout page, which comes back to /welcome the same way; so it does if the card form fails to load (a key from
 * another Stripe account, Stripe unreachable), so nobody is ever left without a way to pay. `back` is where that page
 * returns if they leave it.
 */
export default function LifetimeCheckout({ library, back, onPaying }: { library: Library | null; back: string; onPaying?: (on: boolean) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [start, setStart] = useState<{ ready: Start; appearance: Appearance } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const apply = useCallback((asked: Asked) => {
    if ("error" in asked) return setFailed(asked.error);
    if (asked.start.member) return window.location.assign(new URL("/dashboard", window.location.origin).href);
    setStart({ ready: asked.start, appearance: appearanceFrom(box.current) });
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const asked = await ask(back, false);
      if (alive) apply(asked);
    })();
    return () => {
      alive = false;
    };
  }, [back, apply]);

  /** The card form couldn't load: Stripe's own page instead. */
  const unavailable = useCallback(() => {
    setStart(null);
    void ask(back, true).then(apply);
  }, [back, apply]);

  const ready = start?.ready;
  return (
    <div ref={box}>
      <OfferCard library={library} />
      <div className="mt-5">
        {failed ? (
          <p role="alert" className="rounded-lg border border-down/30 bg-down/10 px-3 py-2.5 text-sm text-down">
            {failed}
          </p>
        ) : !ready || ready.member ? (
          <p className="flex items-center justify-center gap-2 py-10 text-sm text-ink-2">
            <Spinner />
            {ready?.member ? "You're a member already. Opening HighStrike" : "Getting checkout ready"}
          </p>
        ) : ready.mode === "embedded" ? (
          <Elements
            key={ready.clientSecret}
            stripe={stripeFor(ready.publishableKey)}
            options={{ clientSecret: ready.clientSecret, appearance: start.appearance, fonts: STRIPE_FONTS }}
          >
            <PayForm paymentIntent={ready.paymentIntent} cents={ready.cents} onPaying={(on) => onPaying?.(on)} onUnavailable={unavailable} />
          </Elements>
        ) : (
          <HostedPay url={ready.url} cents={ready.cents} />
        )}
      </div>
      <p className="mt-4 text-balance text-center text-xs text-ink-3">
        <Lock />
        Secure checkout by Stripe. Your card details never touch our servers.
      </p>
    </div>
  );
}

function DueToday({ cents }: { cents: number }) {
  return (
    <>
      <div className="flex items-baseline justify-between border-t border-line pt-4 text-[15px] text-ink">
        <span className="font-medium">Due today</span>
        <span className="text-lg font-bold tabular-nums">{(cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })}</span>
      </div>
      <p className="mt-1 text-[13px] text-ink-3">One payment. No subscription, and nothing renews.</p>
    </>
  );
}

const FINE = "mt-3 text-center text-xs leading-relaxed text-ink-3";
const LIFE = "Lifetime means for as long as HighStrike runs.";

/** The checkout's pointer to the Terms, which it agrees to; a new tab, so the popup stays where it is. */
function TermsLine() {
  return (
    <>
      {" "}All sales are final under our{" "}
      <a href="/terms-of-service" target="_blank" rel="noopener" className="underline transition hover:text-ink">
        Terms of Service
      </a>
      .
    </>
  );
}

function PayForm({ paymentIntent, cents, onPaying, onUnavailable }: { paymentIntent: string; cents: number; onPaying: (on: boolean) => void; onUnavailable: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fail = (message: string) => {
    setError(message);
    setBusy(false);
    onPaying(false);
  };
  const pay = async (e: FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || busy) return;
    setBusy(true);
    setError(null);
    onPaying(true);
    // The card's details first, while the press still counts as the buyer's (a wallet's sheet needs that).
    const { error: invalid } = await elements.submit();
    if (invalid) return fail(invalid.message ?? "Check the card details.");
    // A card that clears stays here; one whose bank asks for 3-D Secure comes back to /welcome with the payment's id.
    const { error: declined, paymentIntent: paid } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/welcome` },
      redirect: "if_required",
    });
    if (declined) return fail(declined.message ?? "That payment didn't go through. Nothing was charged.");
    // A full load, so the app draws fresh for a member.
    window.location.assign(new URL(`/welcome?payment_intent=${encodeURIComponent(paid?.id ?? paymentIntent)}`, window.location.origin).href);
  };

  return (
    <form onSubmit={(e) => void pay(e)}>
      <PaymentElement
        onReady={() => setShown(true)}
        onLoadError={(e) => {
          console.error("card form didn't load:", e.error.message);
          onUnavailable();
        }}
        options={{ layout: "tabs" }}
      />
      {!shown && (
        <p className="flex items-center justify-center gap-2 py-8 text-sm text-ink-2">
          <Spinner />
          Loading the card form
        </p>
      )}
      <div className="mt-5">
        <DueToday cents={cents} />
      </div>
      {error && (
        <p role="alert" className="mt-3 rounded-lg border border-down/30 bg-down/10 px-3 py-2.5 text-sm text-down">
          {error}
        </p>
      )}
      <button type="submit" disabled={!shown || busy || !stripe} className={`mt-4 ${PAY_BUTTON}`}>
        {busy && <Spinner />}
        {busy ? "Paying…" : `Pay ${dollars(cents)}`}
      </button>
      <p className={FINE}>
        {LIFE}
        <TermsLine />
      </p>
    </form>
  );
}

function HostedPay({ url, cents }: { url: string; cents: number }) {
  const [going, setGoing] = useState(false);
  return (
    <div>
      <DueToday cents={cents} />
      <a
        href={url}
        onClick={() => setGoing(true)}
        aria-disabled={going}
        className={`mt-4 ${PAY_BUTTON} ${going ? "pointer-events-none opacity-60" : ""}`}
      >
        {going && <Spinner />}
        {going ? "Opening Stripe…" : `Pay ${dollars(cents)}`}
      </a>
      <p className={FINE}>
        You&apos;ll pay on Stripe&apos;s secure page and come straight back with access. {LIFE}
        <TermsLine />
      </p>
    </div>
  );
}
