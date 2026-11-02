"use client";

import { useCallback, useState, type FormEvent, type ReactNode } from "react";
import { loadStripe, type Appearance, type Stripe as StripeJs } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { LIFETIME, dollars, lifetimeIncludes, type Library } from "@/lib/offer";
import AgreeTerms from "@/components/AgreeTerms";
import { STRIPE_FONTS, appearanceFrom } from "./stripeLook";

/** What POST /api/billing/lifetime answers (src/lib/lifetime.ts → Start), or why it couldn't. */
type Start = { alreadyMember: true; email: string } | { clientSecret: string; paymentIntent: string } | { url: string } | { error: string };

/** What Pay sends: the email to open (null: the signed-in account's) and the Terms tick. */
type Order = { email: string | null; agreed: boolean };

/** The checkout for this order, made as Pay is pressed: the card form's payment, Stripe's own page (`hosted`), or nothing to pay. */
async function begin(order: Order, back: string, hosted: boolean): Promise<Start> {
  try {
    const r = await fetch("/api/billing/lifetime", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...order, back, hosted }),
    });
    const j = (await r.json().catch(() => ({}))) as Partial<Start> & { error?: string };
    if (!r.ok) return { error: j.error ?? "Checkout couldn't start. Nothing was charged." };
    return j as Start;
  } catch {
    return { error: "Checkout couldn't start. Check your connection and try again. Nothing was charged." };
  }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Why Pay can't go yet, or null. */
function problemWith(order: Order) {
  if (order.email !== null && !EMAIL.test(order.email)) return "Enter the email for your account.";
  if (!order.agreed) return "Tick the box to agree to the Terms and Privacy Policy first.";
  return null;
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

/** The email field's label and box (the popup's own, so the sign-in pages' styles can change without it). */
const EMAIL_LABEL = "mb-1.5 block text-xs uppercase tracking-wider text-ink-3";
const EMAIL_INPUT =
  "h-12 w-full rounded-lg border border-line bg-panel-2 px-4 text-sm text-ink placeholder:text-ink-3 outline-none transition focus:border-accent/60 focus:ring-2 focus:ring-accent/20";

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

export type Buyer = {
  /** The signed-in account's email, which the payment is for; null for a visitor, who types one. */
  email: string | null;
  /** The signed-in account agreed to the Terms already, so the box isn't asked again. */
  termsOnRecord: boolean;
};

/**
 * The $397 checkout, as getripping.com's one-time checkout draws it: the membership's card, the email, the Terms box,
 * Stripe's card form in the page's colours (Apple Pay and Google Pay beside it), Due today and Pay. Ben, 2026-11-02:
 * "Lifetime access should just open to the payment popup. Account is created upon payment". A visitor types the email
 * their account is made with (or upgraded under, if it has one); a signed-in account pays for itself. The card form needs
 * no payment to draw: Pay makes it (begin), then confirms it. Paid, the browser goes to
 * /api/billing/lifetime/complete, which opens the membership, signs a brand-new account in, and goes on to /welcome.
 * Without Stripe's publishable key, or when the card form can't load, Pay opens Stripe's own checkout page instead, which
 * comes back the same way, so nobody is ever left without a way to pay. `back` is where that page returns if they leave.
 */
export default function LifetimeCheckout({
  library,
  back,
  buyer,
  publishableKey,
  onPaying,
}: {
  library: Library | null;
  back: string;
  buyer: Buyer;
  publishableKey: string | null;
  onPaying?: (on: boolean) => void;
}) {
  const [appearance, setAppearance] = useState<Appearance | null>(null);
  const [hosted, setHosted] = useState(!publishableKey);
  const [email, setEmail] = useState("");
  const [agreed, setAgreed] = useState(false);
  // Stripe's fields take the colours around them, read once the box is on the page.
  const measure = useCallback((el: HTMLDivElement | null) => {
    if (el) setAppearance((a) => a ?? appearanceFrom(el));
  }, []);
  const order: Order = { email: buyer.email ? null : email.trim().toLowerCase(), agreed: buyer.termsOnRecord || agreed };
  const agreement = buyer.termsOnRecord ? null : <AgreeTerms id="hs-pay-agree" checked={agreed} onChange={setAgreed} />;
  const paying = (on: boolean) => onPaying?.(on);

  return (
    <div ref={measure}>
      <OfferCard library={library} />
      <div className="mt-5">
        {buyer.email ? (
          <p className="text-sm text-ink-2">
            For your account, <b className="font-semibold text-ink">{buyer.email}</b>
          </p>
        ) : (
          <div>
            <label htmlFor="hs-pay-email" className={EMAIL_LABEL}>
              Email
            </label>
            <input
              id="hs-pay-email"
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={EMAIL_INPUT}
            />
            <p className="mt-1.5 text-xs leading-relaxed text-ink-3">Your account opens under this email the moment you pay. Already have one? It&apos;s upgraded.</p>
          </div>
        )}
      </div>
      <div className="mt-5">
        {hosted || !publishableKey ? (
          <HostedPay order={order} back={back} agreement={agreement} />
        ) : !appearance ? (
          <Loading text="Loading the card form" />
        ) : (
          <Elements
            stripe={stripeFor(publishableKey)}
            options={{ mode: "payment", amount: LIFETIME.cents, currency: "usd", paymentMethodTypes: ["card"], appearance, fonts: STRIPE_FONTS }}
          >
            <PayForm order={order} back={back} agreement={agreement} onPaying={paying} onUnavailable={() => setHosted(true)} />
          </Elements>
        )}
      </div>
      <p className="mt-4 text-balance text-center text-xs text-ink-3">
        <Lock />
        Secure checkout by Stripe. Your card details never touch our servers.
      </p>
    </div>
  );
}

function Loading({ text }: { text: string }) {
  return (
    <p className="flex items-center justify-center gap-2 py-8 text-sm text-ink-2">
      <Spinner />
      {text}
    </p>
  );
}

function DueToday() {
  return (
    <>
      <div className="flex items-baseline justify-between border-t border-line pt-4 text-[15px] text-ink">
        <span className="font-medium">Due today</span>
        <span className="text-lg font-bold tabular-nums">{(LIFETIME.cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })}</span>
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

/** A problem, in the red box; "already a member" comes with the way to sign in. */
type Problem = { text: string } | { member: string } | null;

function ProblemBox({ problem }: { problem: Problem }) {
  if (!problem) return null;
  return (
    <p role="alert" className="mt-3 rounded-lg border border-down/30 bg-down/10 px-3 py-2.5 text-sm text-down">
      {"member" in problem ? (
        <>
          {problem.member} already has lifetime access, so nothing was charged.{" "}
          <a href="/signin?next=/dashboard" className="font-semibold underline underline-offset-2">
            Sign in
          </a>{" "}
          to open HighStrike.
        </>
      ) : (
        problem.text
      )}
    </p>
  );
}

function PayForm({
  order,
  back,
  agreement,
  onPaying,
  onUnavailable,
}: {
  order: Order;
  back: string;
  agreement: ReactNode;
  onPaying: (on: boolean) => void;
  onUnavailable: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem>(null);

  const fail = (p: Problem) => {
    setProblem(p);
    setBusy(false);
    onPaying(false);
  };
  const pay = async (e: FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || busy) return;
    const wrong = problemWith(order);
    if (wrong) return setProblem({ text: wrong });
    setBusy(true);
    setProblem(null);
    onPaying(true);
    // The card's details first, while the press still counts as the buyer's (a wallet's sheet needs that).
    const { error: invalid } = await elements.submit();
    if (invalid) return fail({ text: invalid.message ?? "Check the card details." });
    const start = await begin(order, back, false);
    if ("error" in start) return fail({ text: start.error });
    if ("alreadyMember" in start) return fail({ member: start.email });
    if ("url" in start) return window.location.assign(start.url);
    // A card that clears stays here; one whose bank asks for 3-D Secure comes back to the same place with the payment.
    const done = `${window.location.origin}/api/billing/lifetime/complete`;
    const { error: declined, paymentIntent } = await stripe.confirmPayment({
      elements,
      clientSecret: start.clientSecret,
      confirmParams: { return_url: done },
      redirect: "if_required",
    });
    if (declined) return fail({ text: declined.message ?? "That payment didn't go through. Nothing was charged." });
    const q = new URLSearchParams({ payment_intent: paymentIntent?.id ?? start.paymentIntent, payment_intent_client_secret: start.clientSecret });
    // A full load, so the app draws fresh for a member.
    window.location.assign(new URL(`/api/billing/lifetime/complete?${q}`, window.location.origin).href);
  };

  return (
    <form onSubmit={(e) => void pay(e)} noValidate>
      <PaymentElement
        onReady={() => setShown(true)}
        onLoadError={(e) => {
          console.error("card form didn't load:", e.error.message);
          onUnavailable();
        }}
        // Apple Pay in Safari and Google Pay in Chrome, as tabs beside the card (the site's domain is registered with
        // Stripe by the popup's first look, GET /api/billing/lifetime). Not Link: it adds its own Bank and Klarna tabs,
        // which this card-only payment would turn down at Pay.
        options={{ layout: "tabs", wallets: { applePay: "auto", googlePay: "auto", link: "never" } }}
      />
      {!shown && <Loading text="Loading the card form" />}
      {agreement && <div className="mt-5">{agreement}</div>}
      <div className="mt-5">
        <DueToday />
      </div>
      <ProblemBox problem={problem} />
      <button type="submit" disabled={!shown || busy || !stripe} className={`mt-4 ${PAY_BUTTON}`}>
        {busy && <Spinner />}
        {busy ? "Paying…" : `Pay ${dollars(LIFETIME.cents)}`}
      </button>
      <p className={FINE}>
        {LIFE}
        <TermsLine />
      </p>
    </form>
  );
}

function HostedPay({ order, back, agreement }: { order: Order; back: string; agreement: ReactNode }) {
  const [going, setGoing] = useState(false);
  const [problem, setProblem] = useState<Problem>(null);
  const go = async (e: FormEvent) => {
    e.preventDefault();
    if (going) return;
    const wrong = problemWith(order);
    if (wrong) return setProblem({ text: wrong });
    setGoing(true);
    setProblem(null);
    const start = await begin(order, back, true);
    if ("url" in start) return window.location.assign(start.url);
    setGoing(false);
    setProblem("alreadyMember" in start ? { member: start.email } : "error" in start ? { text: start.error } : { text: "Checkout couldn't start. Nothing was charged." });
  };
  return (
    <form onSubmit={(e) => void go(e)} noValidate>
      {agreement && <div className="mb-5">{agreement}</div>}
      <DueToday />
      <ProblemBox problem={problem} />
      <button type="submit" disabled={going} className={`mt-4 ${PAY_BUTTON}`}>
        {going && <Spinner />}
        {going ? "Opening Stripe…" : `Pay ${dollars(LIFETIME.cents)}`}
      </button>
      <p className={FINE}>
        You&apos;ll pay on Stripe&apos;s secure page and come straight back with access. {LIFE}
        <TermsLine />
      </p>
    </form>
  );
}
