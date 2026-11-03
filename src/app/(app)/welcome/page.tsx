import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import AuthShell from "@/components/AuthShell";
import { supabaseServer } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { billingReady, paidMembership, purchaseOf, settleCheckout, settleMembership } from "@/lib/billing";
import { PAYWALL, isMember } from "@/lib/membership";
import { MONTHLY_PRICE } from "@/lib/offer";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Welcome — HighStrike" };

type Props = { searchParams: Promise<{ ref?: string; payment_intent?: string }> };

const BUTTON = "inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-medium transition";

/** "Nov 10" from a timestamp, in New York. */
function day(at: string | null) {
  return at ? new Date(at).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" }) : null;
}

/**
 * After paying (via /api/billing/complete, which settles the first payment and signs a brand-new account in). Signed in
 * as a member: you're in, when the week ends and the $99 starts, and a nudge to set a password when the payment made the
 * account. Signed out (the payment upgraded an account that was already there, whose owner signs in): what the payment
 * did and where to sign in. A payment still clearing says so. It settles the payment again first, which changes nothing
 * once done, in case the way back didn't get to.
 */
export default async function WelcomePage({ searchParams }: Props) {
  const q = await searchParams;
  const ref = q.ref ?? q.payment_intent;
  const stripe = billingReady() ? getStripe() : null;
  let paid = false;
  let clearing = false;
  if (stripe && ref && /^pi_[A-Za-z0-9]+$/.test(ref)) {
    const pi = await stripe.paymentIntents.retrieve(ref).catch(() => null);
    paid = Boolean(pi && paidMembership(pi));
    clearing = pi?.status === "processing";
    if (pi && paid) await settleMembership(pi).catch((e) => console.error(`welcome: couldn't settle ${ref}:`, e instanceof Error ? e.message : e));
  } else if (stripe && ref && /^cs_[A-Za-z0-9_]+$/.test(ref)) {
    const session = await stripe.checkout.sessions.retrieve(ref).catch(() => null);
    paid = session?.status === "complete" && session.payment_status !== "unpaid";
    if (session && paid) await settleCheckout(session).catch((e) => console.error(`welcome: couldn't settle ${ref}:`, e instanceof Error ? e.message : e));
  }
  const purchase = ref && (paid || clearing) ? await purchaseOf(ref) : null;
  const trial = purchase?.kind !== "month";
  const next = day(purchase?.nextCharge ?? null);
  const terms = trial
    ? `Your week runs until ${next ?? "7 days from today"}, then it's ${MONTHLY_PRICE}/month until you cancel in Settings → Billing.`
    : `It's ${MONTHLY_PRICE}/month${next ? `, next on ${next}` : ""}, until you cancel in Settings → Billing.`;

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (clearing) return <Clearing />;
    if (!paid) redirect("/");
    const email = purchase?.email ?? "your email";
    // Paid, but the account isn't open yet (the webhook and the next look here retry it).
    if (!purchase?.user_id) {
      return (
        <AuthShell title="Payment received" subtitle={`We're opening your account under ${email}.`}>
          <p className="text-sm leading-relaxed text-ink-2">
            It takes a moment. Refresh this page in a minute; still nothing? Write to support@highstrike.com with this email and we&apos;ll get you in.
          </p>
        </AuthShell>
      );
    }
    return (
      <AuthShell title="Payment received" subtitle={`${email} is in.`}>
        <p className="text-sm leading-relaxed text-ink-2">
          {purchase.created_account
            ? "Your account is made under that email. Sign in with it: Continue with Google works for a Google address. Can't get in? Write to support@highstrike.com and we'll sort it."
            : "That email already had a HighStrike account, so the payment upgraded it. Sign in with it to open the daily ideas, the tools and HighStrike Trading School."}{" "}
          {terms}
        </p>
        <Link href="/signin?next=/dashboard" className={`mt-6 w-full ${BUTTON} bg-accent text-on-accent hover:bg-accent-2`}>
          Sign in
        </Link>
      </AuthShell>
    );
  }

  const { data: profile } = await supabase.from("profiles").select("plan, is_admin, name, avatar_url").eq("id", user.id).maybeSingle();
  if (!isMember(profile)) {
    if (clearing) return <Clearing />;
    redirect(PAYWALL);
  }
  const mine = purchase?.user_id === user.id ? purchase : null;
  return (
    <>
      <div className="anim-rise mx-auto flex max-w-xl flex-col items-center py-10 text-center sm:py-16">
        <span className="grid size-14 place-items-center rounded-full bg-accent-soft text-accent">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-7">
            <path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <h1 className="mt-5 font-display text-[28px] leading-tight text-ink sm:text-[32px]">You&apos;re in</h1>
        <p className="mt-3 text-pretty text-[15px] leading-relaxed text-ink-2">
          Today&apos;s ideas, every tool and all of HighStrike Trading School are open to you now.
        </p>
        {mine && <p className="mt-3 text-pretty text-[15px] leading-relaxed text-ink-2">{terms}</p>}
        {mine?.created_account && (
          <p className="mt-3 text-pretty text-[15px] leading-relaxed text-ink-2">
            Your account is <b className="font-semibold text-ink">{user.email}</b>. Set a password so you can sign in on any device.
          </p>
        )}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/dashboard" className={`${BUTTON} bg-accent text-on-accent hover:bg-accent-2`}>
            Open today&apos;s ideas
          </Link>
          {mine?.created_account ? (
            <Link href="/settings" className={`${BUTTON} border border-line-strong bg-panel-2 text-ink hover:bg-panel-3`}>
              Set a password
            </Link>
          ) : (
            <Link href="/education" className={`${BUTTON} border border-line-strong bg-panel-2 text-ink hover:bg-panel-3`}>
              Open Trading School
            </Link>
          )}
        </div>
        {mine && <p className="mt-6 text-sm text-ink-3">Stripe emails your receipt to {mine.email}.</p>}
      </div>
    </>
  );
}

/** A payment the bank is still confirming. */
function Clearing() {
  return (
    <AuthShell title="Your payment is clearing" subtitle="Stripe is still confirming it with your bank.">
      <p className="text-sm leading-relaxed text-ink-2">
        Access turns on the moment it does, so give it a minute and refresh. Still stuck? Write to support@highstrike.com.
      </p>
    </AuthShell>
  );
}
