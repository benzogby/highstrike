import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import AuthShell from "@/components/AuthShell";
import { supabaseServer } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { billingReady, paidLifetime, purchaseOf, settleLifetime } from "@/lib/lifetime";
import { PAYWALL, isMember } from "@/lib/membership";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Welcome — HighStrike" };

type Props = { searchParams: Promise<{ payment_intent?: string }> };

const BUTTON = "inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-medium transition";

/**
 * After paying (via /api/billing/lifetime/complete, which settles the payment and signs a brand-new account in). Signed
 * in as a member: you're in, with a nudge to set a password when the payment made the account. Signed out (the payment
 * upgraded an account that was already there, whose owner signs in): what the payment did and where to sign in. A payment
 * still clearing says so. It settles the payment again first, which changes nothing once done, in case the way back
 * didn't get to.
 */
export default async function WelcomePage({ searchParams }: Props) {
  const { payment_intent: ref } = await searchParams;
  const pi = ref && /^pi_[A-Za-z0-9]+$/.test(ref) && billingReady() ? await getStripe().paymentIntents.retrieve(ref).catch(() => null) : null;
  if (pi && paidLifetime(pi)) {
    await settleLifetime(pi).catch((e) => console.error(`welcome: couldn't settle ${pi.id}:`, e instanceof Error ? e.message : e));
  }
  const purchase = pi ? await purchaseOf(pi.id) : null;
  const emailed = Boolean(purchase?.emailed_at && !purchase.email_error);

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (pi?.status === "processing") return <Clearing />;
    if (!pi || !paidLifetime(pi)) redirect("/");
    const email = purchase?.email ?? pi.metadata?.email ?? "your email";
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
      <AuthShell title="Payment received" subtitle={`${email} now has lifetime access.`}>
        <p className="text-sm leading-relaxed text-ink-2">
          {purchase.created_account
            ? "Your account is made under that email. Sign in with it: Continue with Google works for a Google address."
            : "That email already had a HighStrike account, so the payment upgraded it. Sign in with it to open the daily trades, the tools and HighStrike Trading School."}
          {emailed ? " We emailed you a sign-in link too." : purchase.created_account ? " Can't get in? Write to support@highstrike.com and we'll sort it." : ""}
        </p>
        <Link href="/signin?next=/dashboard" className={`mt-6 w-full ${BUTTON} bg-accent text-on-accent hover:bg-accent-2`}>
          Sign in
        </Link>
      </AuthShell>
    );
  }

  const { data: profile } = await supabase.from("profiles").select("plan, is_admin, name, avatar_url").eq("id", user.id).maybeSingle();
  if (!isMember(profile)) {
    if (pi?.status === "processing") return <Clearing />;
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
          Lifetime access is on. Today&apos;s trades, every tool and all of HighStrike Trading School are open to you now, with nothing more to pay.
        </p>
        {mine?.created_account && (
          <p className="mt-3 text-pretty text-[15px] leading-relaxed text-ink-2">
            Your account is <b className="font-semibold text-ink">{user.email}</b>. Set a password so you can sign in on any device
            {emailed ? "; we also emailed you a sign-in link." : "."}
          </p>
        )}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/dashboard" className={`${BUTTON} bg-accent text-on-accent hover:bg-accent-2`}>
            Open today&apos;s trades
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
