import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabaseConfig";
import { getStripe } from "@/lib/stripe";
import { billingReady, claimFirstSignIn, paidMembership, settleCheckout, settleMembership, signInToken, type Settled } from "@/lib/billing";

export const dynamic = "force-dynamic";

/**
 * Where a paid checkout lands, on its way to /welcome: from the popup (with the payment's id and secret), from a bank's
 * 3-D Secure page (Stripe adds both), or from Stripe's own checkout page (its session's id). It asks Stripe, settles the
 * payment (src/lib/billing.ts: the account under its email gets the membership, made now if there was none, the
 * subscription starts and the confirmation email goes out), and when the payment made a new account, signs this
 * browser in to it, once, since this browser is the one that paid (it holds the payment's secret, or came back from
 * Stripe's page with the session). An account that was there before is only upgraded; its owner signs in, and /welcome
 * says so. Session cookies go on the redirect itself, as in /auth/callback.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const home = NextResponse.redirect(new URL("/", url.origin));
  if (!billingReady()) return home;
  const stripe = getStripe();
  const pid = url.searchParams.get("payment_intent");
  const secret = url.searchParams.get("payment_intent_client_secret");
  const sid = url.searchParams.get("session_id");

  let ref: string | null = null;
  let settled: Settled | null = null;
  /** This browser is the one that paid. */
  let paidHere = false;
  const failed = (e: unknown) => {
    console.error(`billing: couldn't settle ${ref}:`, e instanceof Error ? e.message : e);
    return null;
  };

  if (pid && /^pi_[A-Za-z0-9]+$/.test(pid)) {
    const pi = await stripe.paymentIntents.retrieve(pid).catch(() => null);
    if (!pi) return home;
    ref = pi.id;
    paidHere = Boolean(pi.client_secret && secret && pi.client_secret === secret);
    if (!paidMembership(pi)) {
      // Still clearing: /welcome says so. Turned down (a bank said no on its own page): back to the popup to try again.
      return pi.status === "processing" ? NextResponse.redirect(new URL(`/welcome?ref=${pi.id}`, url.origin)) : NextResponse.redirect(new URL("/?join=1", url.origin));
    }
    settled = await settleMembership(pi).catch(failed);
  } else if (sid && /^cs_[A-Za-z0-9_]+$/.test(sid)) {
    const session = await stripe.checkout.sessions.retrieve(sid).catch(() => null);
    if (!session) return home;
    ref = session.id;
    paidHere = session.status === "complete";
    if (!paidHere) return NextResponse.redirect(new URL("/?join=1", url.origin));
    settled = await settleCheckout(session).catch(failed);
  }
  if (!ref) return home;

  const welcome = NextResponse.redirect(new URL(`/welcome?ref=${ref}`, url.origin));
  // The webhook and the paywall settle it too; /welcome says what it can meanwhile.
  if (!settled) return welcome;

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => welcome.cookies.set(name, value, options));
      },
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Signed in as that account already (it paid from the app's paywall), or as someone else (never switched silently).
  if (user) return welcome;
  if (settled.created && paidHere && (await claimFirstSignIn(ref))) {
    try {
      const { tokenHash, type } = await signInToken(settled.email);
      const { error } = await supabase.auth.verifyOtp({ type: type as EmailOtpType, token_hash: tokenHash });
      if (error) console.error("billing: couldn't sign the new account in:", error.message);
    } catch (e) {
      console.error("billing: couldn't sign the new account in:", e instanceof Error ? e.message : e);
    }
  }
  return welcome;
}
