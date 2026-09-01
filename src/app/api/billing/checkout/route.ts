import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import {
  getStripe,
  stripeEnabled,
  priceIdFor,
  supabaseService,
  PAID_PLANS,
  SUBSCRIPTION_PLANS,
  type PaidPlan,
} from "@/lib/stripe";

export const dynamic = "force-dynamic";

// Creates a Stripe Checkout session for the signed-in user and returns its URL.
export async function POST(req: Request) {
  if (!stripeEnabled()) {
    return NextResponse.json({ error: "Billing is not configured" }, { status: 503 });
  }

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let plan: unknown;
  try {
    ({ plan } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (typeof plan !== "string" || !PAID_PLANS.includes(plan as PaidPlan)) {
    return NextResponse.json({ error: "Unknown plan" }, { status: 400 });
  }
  const paidPlan = plan as PaidPlan;

  const origin = new URL(req.url).origin;
  const stripe = getStripe();
  const service = supabaseService();

  // Reuse the linked Stripe customer or create one.
  const { data: profile } = await service
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single();

  let customerId = profile?.stripe_customer_id ?? null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { user_id: user.id },
    });
    customerId = customer.id;
    await service
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("id", user.id);
  }

  const isSubscription = SUBSCRIPTION_PLANS.includes(paidPlan);
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: isSubscription ? "subscription" : "payment",
    line_items: [{ price: priceIdFor(paidPlan), quantity: 1 }],
    success_url: `${origin}/settings?billing=success`,
    cancel_url: `${origin}/settings?billing=cancelled`,
    metadata: { user_id: user.id, plan: paidPlan },
    ...(isSubscription
      ? { subscription_data: { metadata: { user_id: user.id, plan: paidPlan } } }
      : {}),
  });

  return NextResponse.json({ url: session.url });
}
