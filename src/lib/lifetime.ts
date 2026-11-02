import type Stripe from "stripe";
import { getStripe, supabaseService } from "@/lib/stripe";
import { LIFETIME } from "@/lib/offer";

// The $397 lifetime membership's payments (Ben, 2026-11-02: "One time payment, instant access"), on the server only.
// The popup and the paywall start one here (/api/billing/lifetime); paid, the browser comes back to /welcome, which asks
// Stripe and turns the membership on there and then. The webhook does the same for a browser that never came back
// (api/billing/webhook), and so does the paywall the next time that account opens the app, so a payment that went
// through always ends in access. Only the service key writes profiles.plan
// (supabase/migrations/20260819170000_stripe_plan_lockdown.sql).

type Buyer = { id: string; email: string | null };

/** The server can charge: Stripe's secret key is set. */
export function billingReady() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/** Whether payments are real: the secret key's mode, or null without one. */
export function liveMode(): boolean | null {
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  if (!key) return null;
  return /^(sk|rk)_live_/.test(key);
}

/**
 * Stripe's publishable key, which lets the popup take the card itself (Stripe's Payment Element). Read on each request,
 * so adding it on Vercel takes a redeploy and no code. One from the other mode than the secret key's would only fail at
 * Pay, so it counts as missing. Without it the popup sends people to Stripe's own checkout page instead.
 */
export function publishableKey(): string | null {
  const key = (process.env.STRIPE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "").trim();
  const m = /^pk_(live|test)_[A-Za-z0-9]+$/.exec(key);
  if (!m) return null;
  const live = liveMode();
  return live === null || live === (m[1] === "live") ? key : null;
}

/** A payment that bought the membership for this account: ours, for `userId`, the full price, and through. */
export function boughtLifetime(pi: Stripe.PaymentIntent, userId: string) {
  return (
    pi.status === "succeeded" &&
    pi.metadata?.product === LIFETIME.plan &&
    pi.metadata?.user_id === userId &&
    pi.currency === "usd" &&
    pi.amount_received >= LIFETIME.cents
  );
}

function idOf(x: string | { id: string } | null | undefined) {
  return typeof x === "string" ? x : x?.id ?? null;
}

/** Turns the membership on for `userId` (and keeps the Stripe customer it paid as). */
export async function grantLifetime(userId: string, customerId: string | null) {
  const { error } = await supabaseService()
    .from("profiles")
    .update({ plan: LIFETIME.plan, ...(customerId ? { stripe_customer_id: customerId } : {}) })
    .eq("id", userId);
  if (error) throw new Error(`Couldn't turn the membership on: ${error.message}`);
}

/** The account's Stripe customer: the one on file while Stripe still has it, or a new one. */
async function customerFor(stripe: Stripe, buyer: Buyer, known: string | null) {
  if (known) {
    const c = await stripe.customers.retrieve(known).catch(() => null);
    if (c && !c.deleted) return known;
  }
  const c = await stripe.customers.create({ email: buyer.email ?? undefined, metadata: { user_id: buyer.id } });
  await supabaseService().from("profiles").update({ stripe_customer_id: c.id }).eq("id", buyer.id);
  return c.id;
}

/** The customer's recent membership payments: one that went through, and one still waiting to be paid. */
async function lifetimePayments(stripe: Stripe, customerId: string, userId: string) {
  const { data } = await stripe.paymentIntents.list({ customer: customerId, limit: 20 });
  const ours = data.filter((pi) => pi.metadata?.product === LIFETIME.plan && pi.metadata?.user_id === userId);
  return {
    paid: ours.find((pi) => boughtLifetime(pi, userId)) ?? null,
    open:
      ours.find(
        (pi) =>
          pi.amount === LIFETIME.cents &&
          pi.currency === "usd" &&
          ["requires_payment_method", "requires_confirmation", "requires_action"].includes(pi.status)
      ) ?? null,
  };
}

async function profileOf(userId: string) {
  const { data } = await supabaseService()
    .from("profiles")
    .select("plan, is_admin, stripe_customer_id")
    .eq("id", userId)
    .maybeSingle();
  return data as { plan: string | null; is_admin: boolean | null; stripe_customer_id: string | null } | null;
}

const walletHosts = new Set<string>();

/**
 * Apple Pay (and Google Pay) in the popup's card form, which Stripe shows only on a domain registered with it
 * (Ben, 2026-11-02: "add apple pay as a payment option"). Registers and validates this host once per server; Stripe's
 * own checkout page needs none of it. Never in the way of a payment: a failure is logged and the card form opens as ever.
 */
async function walletDomain(stripe: Stripe, origin: string) {
  let host: string;
  try {
    host = new URL(origin).hostname;
  } catch {
    return;
  }
  if (walletHosts.has(host) || host === "localhost" || /^[\d.]+$|:/.test(host)) return;
  try {
    const { data } = await stripe.paymentMethodDomains.list({ domain_name: host, limit: 1 });
    let domain = data[0] ?? (await stripe.paymentMethodDomains.create({ domain_name: host, enabled: true }));
    if (!domain.enabled) domain = await stripe.paymentMethodDomains.update(domain.id, { enabled: true });
    if (domain.apple_pay.status !== "active") domain = await stripe.paymentMethodDomains.validate(domain.id);
    walletHosts.add(host);
    if (domain.apple_pay.status !== "active") {
      console.error(`Apple Pay isn't active on ${host}:`, domain.apple_pay.status_details?.error_message ?? domain.apple_pay.status);
    }
  } catch (e) {
    console.error(`Couldn't register ${host} for Apple Pay:`, e instanceof Error ? e.message : e);
  }
}

export type Start =
  | { member: true }
  | { member: false; mode: "embedded"; clientSecret: string; paymentIntent: string; publishableKey: string; cents: number }
  | { member: false; mode: "hosted"; url: string; cents: number };

/**
 * Starts the checkout for a signed-in account: nothing to pay for a member (or for an account whose earlier payment went
 * through, which this turns on); otherwise the payment for the popup's card form, reusing one that's still waiting, or
 * Stripe's own checkout page when there's no publishable key, or when the popup asks for it (`hosted`: its card form
 * couldn't load). Cards only, so access never waits on a bank. `back` is where Stripe's page returns to if they leave it.
 */
export async function startLifetime(buyer: Buyer, origin: string, back: string, { hosted = false } = {}): Promise<Start> {
  const stripe = getStripe();
  const profile = await profileOf(buyer.id);
  if (profile?.plan === LIFETIME.plan || profile?.is_admin) return { member: true };
  const customer = await customerFor(stripe, buyer, profile?.stripe_customer_id ?? null);
  const { paid, open } = await lifetimePayments(stripe, customer, buyer.id);
  if (paid) {
    await grantLifetime(buyer.id, customer);
    return { member: true };
  }
  const metadata = { user_id: buyer.id, product: LIFETIME.plan };
  const key = hosted ? null : publishableKey();
  if (key) {
    await walletDomain(stripe, origin);
    const pi =
      open ??
      (await stripe.paymentIntents.create({
        amount: LIFETIME.cents,
        currency: "usd",
        customer,
        description: LIFETIME.name,
        metadata,
        payment_method_types: ["card"],
        receipt_email: buyer.email ?? undefined,
      }));
    if (!pi.client_secret) throw new Error("Stripe didn't return the payment's secret.");
    return { member: false, mode: "embedded", clientSecret: pi.client_secret, paymentIntent: pi.id, publishableKey: key, cents: LIFETIME.cents };
  }
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer,
    client_reference_id: buyer.id,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: LIFETIME.cents,
          product_data: { name: LIFETIME.name, description: "The daily trades, the tools and the Alpha Mastermind, for life. One payment." },
        },
      },
    ],
    payment_method_types: ["card"],
    metadata: { ...metadata, plan: LIFETIME.plan },
    payment_intent_data: { description: LIFETIME.name, metadata },
    success_url: `${origin}/welcome?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}${back}`,
  });
  if (!session.url) throw new Error("Stripe didn't return a checkout page.");
  return { member: false, mode: "hosted", url: session.url, cents: LIFETIME.cents };
}

/** Where a payment stands for an account: in (a member now), still clearing, or not paid. */
export type Completion = "member" | "pending" | "unpaid";

/**
 * After paying: checks with Stripe the payment (`paymentIntent`) or Stripe's checkout page (`session`) the browser came
 * back with, and turns the membership on when it went through for this account. With neither, or one that didn't, it
 * looks for any earlier membership payment of this account's.
 */
export async function completeLifetime(buyer: Buyer, ref: { paymentIntent?: string | null; session?: string | null } = {}): Promise<Completion> {
  const profile = await profileOf(buyer.id);
  if (profile?.plan === LIFETIME.plan || profile?.is_admin) return "member";
  const stripe = getStripe();
  let pending = false;
  if (ref.paymentIntent && /^pi_[A-Za-z0-9]+$/.test(ref.paymentIntent)) {
    const pi = await stripe.paymentIntents.retrieve(ref.paymentIntent).catch(() => null);
    if (pi && boughtLifetime(pi, buyer.id)) {
      await grantLifetime(buyer.id, idOf(pi.customer));
      return "member";
    }
    if (pi?.status === "processing" && pi.metadata?.user_id === buyer.id) pending = true;
  }
  if (ref.session && /^cs_[A-Za-z0-9_]+$/.test(ref.session)) {
    const s = await stripe.checkout.sessions.retrieve(ref.session).catch(() => null);
    if (s && s.metadata?.user_id === buyer.id && s.metadata?.product === LIFETIME.plan) {
      if (s.payment_status === "paid" && (s.amount_total ?? 0) >= LIFETIME.cents) {
        await grantLifetime(buyer.id, idOf(s.customer));
        return "member";
      }
      if (s.status === "complete") pending = true;
    }
  }
  if (profile?.stripe_customer_id) {
    const { paid } = await lifetimePayments(stripe, profile.stripe_customer_id, buyer.id);
    if (paid) {
      await grantLifetime(buyer.id, profile.stripe_customer_id);
      return "member";
    }
  }
  return pending ? "pending" : "unpaid";
}
