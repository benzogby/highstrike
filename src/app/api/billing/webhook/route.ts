import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, planForPriceId, supabaseService } from "@/lib/stripe";

export const dynamic = "force-dynamic";

// Stripe webhook: the single source of truth for plan changes once billing is
// live. Verifies the signature against the raw body, then applies the change
// with the service-role client (RLS bypass — users can't write plan/customer
// columns themselves once billing is enabled).
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = await getStripe().webhooks.constructEventAsync(rawBody, signature, secret);
  } catch (e) {
    console.error("stripe webhook: bad signature:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const service = supabaseService();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.metadata?.user_id;
        const plan = session.metadata?.plan;
        if (userId && plan) {
          await service
            .from("profiles")
            .update({
              plan,
              ...(typeof session.customer === "string"
                ? { stripe_customer_id: session.customer }
                : {}),
            })
            .eq("id", userId);
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object;
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        if (sub.status === "active" || sub.status === "trialing") {
          const priceId = sub.items.data[0]?.price?.id;
          const plan = priceId ? planForPriceId(priceId) : null;
          if (plan) {
            await service
              .from("profiles")
              .update({ plan })
              .eq("stripe_customer_id", customerId);
          }
        } else if (["canceled", "unpaid", "incomplete_expired"].includes(sub.status)) {
          await service
            .from("profiles")
            .update({ plan: "free" })
            .eq("stripe_customer_id", customerId)
            .neq("plan", "lifetime");
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        await service
          .from("profiles")
          .update({ plan: "free" })
          .eq("stripe_customer_id", customerId)
          .neq("plan", "lifetime");
        break;
      }

      default:
        break;
    }
  } catch (e) {
    console.error("stripe webhook: handler failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
