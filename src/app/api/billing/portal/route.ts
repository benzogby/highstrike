import { NextResponse } from "next/server";
import { viewer } from "@/lib/membership";
import { getStripe, supabaseService } from "@/lib/stripe";
import { billingReady, portalConfiguration } from "@/lib/billing";

export const dynamic = "force-dynamic";

/**
 * Settings → Billing → Manage billing (Ben, 2026-11-03: "Settings -> Billing -> Link to Stripe billing portal"): Stripe's
 * billing page for this account's customer, where a member changes the card, sees invoices or cancels (at the end of
 * what they've paid for). A form POST, answered with a redirect there; the paywall's owing account uses it too.
 */
export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  const settings = new URL("/settings?billing=unavailable", origin);
  if (!billingReady()) return NextResponse.redirect(settings, 303);
  const me = await viewer();
  if (!me) return NextResponse.redirect(new URL("/signin?next=/settings", origin), 303);
  const { data: profile } = await supabaseService().from("profiles").select("stripe_customer_id").eq("id", me.user.id).maybeSingle();
  if (!profile?.stripe_customer_id) return NextResponse.redirect(settings, 303);
  try {
    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      configuration: await portalConfiguration(stripe),
      // Back on Settings, the page asks Stripe what changed (a cancellation shows at once, webhook or not).
      return_url: `${origin}/settings?billing=back`,
    });
    return NextResponse.redirect(session.url, 303);
  } catch (e) {
    console.error("billing portal:", e instanceof Error ? e.message : e);
    return NextResponse.redirect(settings, 303);
  }
}
