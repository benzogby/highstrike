import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type Stripe from "stripe";
import type { EmailOtpType } from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabaseConfig";
import { getStripe } from "@/lib/stripe";
import { billingReady, claimFirstSignIn, paidLifetime, settleLifetime, signInToken } from "@/lib/lifetime";

export const dynamic = "force-dynamic";

/**
 * Where a paid checkout lands, on its way to /welcome: from the popup's card form (with the payment's id and secret),
 * from a bank's 3-D Secure page (Stripe adds both), or from Stripe's own checkout page (its session's id). It asks Stripe,
 * settles the payment (src/lib/lifetime.ts → settleLifetime: the account under its email gets the membership, made now if
 * there was none, and the confirmation email goes out), and when the payment made a new account, signs this browser in
 * to it, once, since this browser is the one that paid (it holds the payment's secret). An account that was there
 * before is only upgraded; its owner signs in, and /welcome says so. Session cookies go on the redirect itself, as in
 * /auth/callback.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const home = NextResponse.redirect(new URL("/", url.origin));
  if (!billingReady()) return home;
  const stripe = getStripe();
  const pid = url.searchParams.get("payment_intent");
  const secret = url.searchParams.get("payment_intent_client_secret");
  const sid = url.searchParams.get("session_id");

  let pi: Stripe.PaymentIntent | null = null;
  /** This browser is the one that paid. */
  let paidHere = false;
  if (pid && /^pi_[A-Za-z0-9]+$/.test(pid)) {
    pi = await stripe.paymentIntents.retrieve(pid).catch(() => null);
    paidHere = Boolean(pi?.client_secret && secret && pi.client_secret === secret);
  } else if (sid && /^cs_[A-Za-z0-9_]+$/.test(sid)) {
    const session = await stripe.checkout.sessions.retrieve(sid, { expand: ["payment_intent"] }).catch(() => null);
    pi = session && session.payment_intent && typeof session.payment_intent === "object" ? session.payment_intent : null;
    paidHere = session?.status === "complete";
  }
  if (!pi) return home;

  const welcome = NextResponse.redirect(new URL(`/welcome?payment_intent=${pi.id}`, url.origin));
  if (!paidLifetime(pi)) {
    // Still clearing: /welcome says so. Turned down (a bank said no on its own page): back to the popup to try again.
    return pi.status === "processing" ? welcome : NextResponse.redirect(new URL("/?join=1", url.origin));
  }
  const settled = await settleLifetime(pi).catch((e) => {
    console.error(`lifetime: couldn't settle ${pi.id}:`, e instanceof Error ? e.message : e);
    return null;
  });
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
  if (settled.created && paidHere && (await claimFirstSignIn(pi.id))) {
    try {
      const { tokenHash, type } = await signInToken(settled.email);
      const { error } = await supabase.auth.verifyOtp({ type: type as EmailOtpType, token_hash: tokenHash });
      if (error) console.error("lifetime: couldn't sign the new account in:", error.message);
    } catch (e) {
      console.error("lifetime: couldn't sign the new account in:", e instanceof Error ? e.message : e);
    }
  }
  return welcome;
}
