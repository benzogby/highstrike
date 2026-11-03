"use server";

import { requireAdmin } from "@/lib/adminGate";
import { getStripe } from "@/lib/stripe";
import { billingReady, liveMode, monthlyPrice, portalConfiguration, publishableKey } from "@/lib/billing";

// Admin → Overview's "Billing setup" (2026-11-03, with the $14 week then $99/month): checks what the membership needs in
// Stripe and says what's missing. The $99 price and the billing page set themselves up the first time they're used;
// the webhook is Ben's, made in Stripe's dashboard, and has to send the subscription and invoice events, or a
// cancellation or a failed $99 only reaches the app when the member next opens it. "Add the missing events" adds them
// to that webhook, on his click only.

/** What the webhook must send for the membership (src/app/api/billing/webhook/route.ts). */
const EVENTS = [
  "payment_intent.succeeded",
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
] as const;

export type Check = { label: string; ok: boolean; detail: string };
export type Setup = { checks: Check[]; missingEvents: string[]; endpoint: string | null; error?: string };

async function webhookOf() {
  const { data } = await getStripe().webhookEndpoints.list({ limit: 100 });
  return data.find((w) => /highstrike\.com\/api\/billing\/webhook\/?$/.test(w.url) && w.status === "enabled") ?? null;
}

export async function checkBillingSetup(): Promise<Setup> {
  await requireAdmin();
  if (!billingReady()) return { checks: [{ label: "Stripe", ok: false, detail: "STRIPE_SECRET_KEY isn't set on Vercel." }], missingEvents: [], endpoint: null };
  const checks: Check[] = [];
  const live = liveMode();
  checks.push({ label: "Mode", ok: live === true, detail: live ? "Live: real cards are charged." : "Test mode: no real money moves." });
  checks.push({
    label: "Card form",
    ok: Boolean(publishableKey()),
    detail: publishableKey() ? "The popup takes cards itself (Apple Pay and Google Pay included)." : "No publishable key, so the popup sends people to Stripe's page.",
  });
  try {
    const stripe = getStripe();
    const price = await monthlyPrice(stripe);
    checks.push({ label: "$99/month price", ok: true, detail: `Ready in Stripe (${price.id}).` });
    await portalConfiguration(stripe);
    checks.push({ label: "Billing page", ok: true, detail: "Members can change their card, see invoices and cancel." });
    const hook = await webhookOf();
    if (!hook) {
      checks.push({ label: "Webhook", ok: false, detail: "No enabled webhook for highstrike.com/api/billing/webhook in Stripe." });
      return { checks, missingEvents: [...EVENTS], endpoint: null };
    }
    const all = hook.enabled_events.includes("*");
    const missing = all ? [] : EVENTS.filter((e) => !hook.enabled_events.includes(e));
    checks.push({
      label: "Webhook",
      ok: missing.length === 0,
      detail: missing.length ? `Missing ${missing.length} event${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}.` : "Sends every event the membership needs.",
    });
    return { checks, missingEvents: missing, endpoint: hook.id };
  } catch (e) {
    return { checks, missingEvents: [], endpoint: null, error: e instanceof Error ? e.message : "Stripe didn't answer." };
  }
}

/** Adds the missing events to the highstrike.com webhook (its other events stay). */
export async function addWebhookEvents(): Promise<Setup> {
  await requireAdmin();
  const hook = billingReady() ? await webhookOf() : null;
  if (hook && !hook.enabled_events.includes("*")) {
    const events = [...new Set([...hook.enabled_events, ...EVENTS])] as typeof hook.enabled_events;
    await getStripe().webhookEndpoints.update(hook.id, { enabled_events: events as never });
  }
  return checkBillingSetup();
}
