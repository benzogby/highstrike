"use client";

import { useCallback, useState, type FormEvent, type ReactNode } from "react";
import { loadStripe, type Appearance, type Stripe as StripeJs } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { MEMBERSHIP, MONTHLY_PRICE, TRIAL_PRICE, dollars, membershipIncludes, type Library } from "@/lib/offer";
import AgreeTerms from "@/components/AgreeTerms";
import { STRIPE_FONTS, appearanceFrom } from "./stripeLook";

/** What POST /api/billing/start answers (src/lib/billing.ts → Start), or why it couldn't. */
type Start =
  | { alreadyMember: true; email: string }
  | { owes: true; email: string }
  | { weekUsed: true; email: string }
  | { paid: true; paymentIntent: string; clientSecret: string }
  | { action: true; paymentIntent: string; clientSecret: string }
  | { url: string }
  | { error: string };

/** What Pay sends: the email to open (null: the signed-in account's), the Terms tick, and whether it's the $99 start. */
type Order = { email: string | null; agreed: boolean; full: boolean };

/** The checkout for this order, made as Pay is pressed (`confirmationToken`: the card, from the card form). */
async function begin(order: Order, back: string, extra: { hosted?: boolean; confirmationToken?: string }): Promise<Start> {
  try {
    const r = await fetch("/api/billing/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...order, back, ...extra }),
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
  if (!order.agreed) return "Tick the box to agree to the Terms first.";
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

/** "Nov 10": when the week bought today ends (the first $99), or a month from today for a $99 start. */
function nextCharge(full: boolean) {
  const d = new Date();
  if (full) d.setMonth(d.getMonth() + 1);
  else d.setDate(d.getDate() + MEMBERSHIP.trialDays);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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

/** The membership as a card: what it is, the price (the $14 week, or $99/month for someone whose week was used), what it includes. */
export function OfferCard({ library, full }: { library: Library | null; full: boolean }) {
  return (
    <div className="rounded-xl border border-line-strong bg-panel-2/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 flex-1 text-[15px] font-semibold text-ink">{MEMBERSHIP.name}</p>
        <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent">{full ? "Monthly" : "7-day trial"}</span>
      </div>
      {full ? (
        <>
          <p className="mt-1.5 flex items-baseline gap-1.5">
            <span className="font-display text-[28px] font-bold leading-none tracking-tight text-ink">{MONTHLY_PRICE}</span>
            <span className="text-sm text-ink-2">/month</span>
          </p>
          <p className="mt-1 text-[13px] text-ink-3">Cancel anytime.</p>
        </>
      ) : (
        <>
          <p className="mt-1.5 flex items-baseline gap-2">
            <span className="font-display text-[28px] font-bold leading-none tracking-tight text-ink">{TRIAL_PRICE}</span>
            <span className="text-sm text-ink-2">for your first week</span>
          </p>
          <p className="mt-1 text-[13px] text-ink-3">Then {MONTHLY_PRICE}/month. Cancel anytime.</p>
        </>
      )}
      <ul className="mt-3 grid gap-2">
        {membershipIncludes(library, full).map((x) => (
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
};

/**
 * The checkout (Ben, 2026-11-03: "Try it for a week for $14 and then $99/month thereafter"): the membership's card, the
 * email, Stripe's card form in the page's colours (Apple Pay and Google Pay beside it), the Terms box with the renewal
 * in it, Due today and Pay. A visitor types the email their account is made with (or upgraded under, if it has one); a
 * signed-in account pays for itself. Pay sends the card (a ConfirmationToken) and the server charges it: $14 for the week,
 * or, when the email or the card had its week (`weekUsed`, or the server says so at Pay, before charging anything), $99
 * for a first month once they press Pay again under the new price. Paid, the browser goes to /api/billing/complete,
 * which opens the membership, signs a brand-new account in, and goes on to /welcome. Without Stripe's publishable key,
 * or when the card form can't load, Pay opens Stripe's own checkout page instead, which comes back the same way.
 * `back` is where that page returns if they leave it.
 */
export default function MembershipCheckout({
  library,
  back,
  buyer,
  publishableKey,
  weekUsed = false,
  onPaying,
  onFull,
}: {
  library: Library | null;
  back: string;
  buyer: Buyer;
  publishableKey: string | null;
  /** This account had its week: it starts at $99. */
  weekUsed?: boolean;
  onPaying?: (on: boolean) => void;
  /** The price became $99/month (for the popup's title). */
  onFull?: (full: boolean) => void;
}) {
  const [appearance, setAppearance] = useState<Appearance | null>(null);
  const [hosted, setHosted] = useState(!publishableKey);
  const [email, setEmail] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [full, setFull] = useState(weekUsed);
  /** Why the price changed at Pay. */
  const [notice, setNotice] = useState<string | null>(null);
  // Stripe's fields take the colours around them, read once the box is on the page.
  const measure = useCallback((el: HTMLDivElement | null) => {
    if (el) setAppearance((a) => a ?? appearanceFrom(el));
  }, []);
  const order: Order = { email: buyer.email ? null : email.trim().toLowerCase(), agreed, full };
  const renewal = full ? `${MONTHLY_PRICE}/month from today, until I cancel` : `${MONTHLY_PRICE}/month after my first week, until I cancel`;
  const agreement = <AgreeTerms id="hs-pay-agree" checked={agreed} onChange={setAgreed} renewal={renewal} />;
  const paying = (on: boolean) => onPaying?.(on);
  const toFull = (who: string) => {
    setFull(true);
    onFull?.(true);
    setNotice(`${who} already had a ${TRIAL_PRICE} week, so it's ${MONTHLY_PRICE}/month from today. Nothing was charged yet: press Pay to start.`);
  };

  return (
    <div ref={measure}>
      <OfferCard library={library} full={full} />
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
      {notice && (
        <p role="status" className="mt-4 rounded-lg border border-warn/30 bg-warn/10 px-3 py-2.5 text-sm leading-relaxed text-warn">
          {notice}
        </p>
      )}
      <div className="mt-5">
        {hosted || !publishableKey ? (
          <HostedPay order={order} back={back} agreement={agreement} onWeekUsed={toFull} />
        ) : !appearance ? (
          <Loading text="Loading the card form" />
        ) : (
          <Elements
            stripe={stripeFor(publishableKey)}
            options={{
              mode: "payment",
              amount: full ? MEMBERSHIP.monthlyCents : MEMBERSHIP.trialCents,
              currency: "usd",
              // The card stays on file for the $99 months after (the server's payment says the same).
              setupFutureUsage: "off_session",
              paymentMethodTypes: ["card"],
              appearance,
              fonts: STRIPE_FONTS,
            }}
          >
            <PayForm order={order} back={back} agreement={agreement} onPaying={paying} onUnavailable={() => setHosted(true)} onWeekUsed={toFull} />
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

const money = (cents: number) => (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

function DueToday({ full }: { full: boolean }) {
  return (
    <>
      <div className="flex items-baseline justify-between border-t border-line pt-4 text-[15px] text-ink">
        <span className="font-medium">Due today</span>
        <span className="text-lg font-bold tabular-nums">{money(full ? MEMBERSHIP.monthlyCents : MEMBERSHIP.trialCents)}</span>
      </div>
      <p className="mt-1 text-[13px] text-ink-3">
        Then {MONTHLY_PRICE}/month from {nextCharge(full)}, until you cancel.
      </p>
    </>
  );
}

const FINE = "mt-3 text-center text-xs leading-relaxed text-ink-3";

/** The small print under Pay: how cancelling works, and the Terms (a new tab, so the popup stays where it is). */
function Fine({ full }: { full: boolean }) {
  return (
    <p className={FINE}>
      {full
        ? "Cancel anytime in Settings → Billing and keep access to the end of the month you paid for."
        : `Cancel anytime in Settings → Billing before ${nextCharge(false)} and the ${MONTHLY_PRICE} never comes.`}{" "}
      No refunds, as our{" "}
      <a href="/terms-of-service" target="_blank" rel="noopener" className="underline transition hover:text-ink">
        Terms of Service
      </a>{" "}
      say.
    </p>
  );
}

/** A problem, in the red box; "already a member" and "owes a payment" come with the way to sign in. */
type Problem = { text: string } | { member: string } | { owes: string } | null;

function ProblemBox({ problem }: { problem: Problem }) {
  if (!problem) return null;
  const signIn = (
    <a href="/signin?next=/dashboard" className="font-semibold underline underline-offset-2">
      Sign in
    </a>
  );
  return (
    <p role="alert" className="mt-3 rounded-lg border border-down/30 bg-down/10 px-3 py-2.5 text-sm text-down">
      {"member" in problem ? (
        <>
          {problem.member} is already a member, so nothing was charged. {signIn} to open HighStrike.
        </>
      ) : "owes" in problem ? (
        <>
          {problem.owes} has a payment to settle first, so nothing was charged. {signIn} to pay it and get back in.
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
  onWeekUsed,
}: {
  order: Order;
  back: string;
  agreement: ReactNode;
  onPaying: (on: boolean) => void;
  onUnavailable: () => void;
  onWeekUsed: (who: string) => void;
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
    const done = `${window.location.origin}/api/billing/complete`;
    const { error: unreadable, confirmationToken } = await stripe.createConfirmationToken({ elements, params: { return_url: done } });
    if (unreadable || !confirmationToken) return fail({ text: unreadable?.message ?? "Check the card details." });
    const start = await begin(order, back, { confirmationToken: confirmationToken.id });
    if ("error" in start) return fail({ text: start.error });
    if ("alreadyMember" in start) return fail({ member: start.email });
    if ("owes" in start) return fail({ owes: start.email });
    if ("weekUsed" in start) {
      setBusy(false);
      onPaying(false);
      return onWeekUsed(order.email ? "That email" : "This account");
    }
    if ("url" in start) return window.location.assign(start.url);
    if ("action" in start) {
      // 3-D Secure, in Stripe's own window over the popup.
      const { error: declined } = await stripe.handleNextAction({ clientSecret: start.clientSecret });
      if (declined) return fail({ text: declined.message ?? "Your bank didn't confirm the payment. Nothing was charged." });
    }
    const q = new URLSearchParams({ payment_intent: start.paymentIntent, payment_intent_client_secret: start.clientSecret });
    // A full load, so the app draws fresh for a member.
    window.location.assign(new URL(`/api/billing/complete?${q}`, window.location.origin).href);
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
        // Stripe by the popup's first look, GET /api/billing/start). Not Link: it adds its own Bank and Klarna tabs,
        // which this card-only payment would turn down at Pay.
        options={{ layout: "tabs", wallets: { applePay: "auto", googlePay: "auto", link: "never" } }}
      />
      {!shown && <Loading text="Loading the card form" />}
      <div className="mt-5">{agreement}</div>
      <div className="mt-5">
        <DueToday full={order.full} />
      </div>
      <ProblemBox problem={problem} />
      <button type="submit" disabled={!shown || busy || !stripe} className={`mt-4 ${PAY_BUTTON}`}>
        {busy && <Spinner />}
        {busy ? "Paying…" : order.full ? `Pay ${MONTHLY_PRICE} and start` : `Start my week for ${dollars(MEMBERSHIP.trialCents)}`}
      </button>
      <Fine full={order.full} />
    </form>
  );
}

function HostedPay({ order, back, agreement, onWeekUsed }: { order: Order; back: string; agreement: ReactNode; onWeekUsed: (who: string) => void }) {
  const [going, setGoing] = useState(false);
  const [problem, setProblem] = useState<Problem>(null);
  const go = async (e: FormEvent) => {
    e.preventDefault();
    if (going) return;
    const wrong = problemWith(order);
    if (wrong) return setProblem({ text: wrong });
    setGoing(true);
    setProblem(null);
    const start = await begin(order, back, { hosted: true });
    if ("url" in start) return window.location.assign(start.url);
    setGoing(false);
    if ("weekUsed" in start) return onWeekUsed(order.email ? "That email" : "This account");
    setProblem(
      "alreadyMember" in start
        ? { member: start.email }
        : "owes" in start
          ? { owes: start.email }
          : "error" in start
            ? { text: start.error }
            : { text: "Checkout couldn't start. Nothing was charged." }
    );
  };
  return (
    <form onSubmit={(e) => void go(e)} noValidate>
      <div className="mb-5">{agreement}</div>
      <DueToday full={order.full} />
      <ProblemBox problem={problem} />
      <button type="submit" disabled={going} className={`mt-4 ${PAY_BUTTON}`}>
        {going && <Spinner />}
        {going ? "Opening Stripe…" : order.full ? `Pay ${MONTHLY_PRICE} and start` : `Start my week for ${TRIAL_PRICE}`}
      </button>
      <p className={FINE}>You&apos;ll pay on Stripe&apos;s secure page and come straight back with access.</p>
      <Fine full={order.full} />
    </form>
  );
}
