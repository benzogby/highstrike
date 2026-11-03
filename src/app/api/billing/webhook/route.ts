import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { settleCheckout, settleMembership, syncSubscription } from "@/lib/billing";

export const dynamic = "force-dynamic";

/** The subscription an invoice belongs to, if it's a subscription's. */
function invoiceSubscription(invoice: Stripe.Invoice) {
  const s = invoice.parent?.subscription_details?.subscription;
  return typeof s === "string" ? s : s?.id ?? null;
}

/**
 * Stripe's webhook: word of every change to the membership (src/lib/billing.ts), checked against Stripe's signature on
 * the raw body. A first payment settles (account, subscription, emails); anything about a subscription or its invoices
 * re-reads that subscription from Stripe and brings our copy and the account's plan in step, so events arriving out of
 * order can't leave an old state behind. A $99 that fails turns access off here (Ben: "Lock until paid") and a payment
 * that goes through turns it back on.
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  const stripe = getStripe();
  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, secret);
  } catch (e) {
    console.error("stripe webhook: bad signature:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  /** The subscription as Stripe has it now, kept in step. */
  const resync = async (id: string | null) => {
    if (!id) return;
    const sub = await stripe.subscriptions.retrieve(id, { expand: ["latest_invoice"] });
    if (sub.metadata?.app === "highstrike" || sub.metadata?.product === "membership" || sub.metadata?.user_id) await syncSubscription(sub);
  };

  try {
    switch (event.type) {
      // A first payment in the popup: the account under its email gets the membership (made if there's none), for a
      // browser that never came back.
      case "payment_intent.succeeded":
        await settleMembership(event.data.object);
        break;

      // Stripe's own checkout page (the popup's fallback).
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        await settleCheckout(event.data.object);
        break;

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
      case "customer.subscription.paused":
      case "customer.subscription.resumed":
        await resync(event.data.object.id);
        break;

      case "invoice.paid":
      case "invoice.payment_failed":
      case "invoice.payment_action_required":
      case "invoice.marked_uncollectible":
        await resync(invoiceSubscription(event.data.object));
        break;

      default:
        break;
    }
  } catch (e) {
    console.error(`stripe webhook: ${event.type} failed:`, e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
