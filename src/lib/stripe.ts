import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/supabaseConfig";

// Server-only billing helpers. Everything is env-gated: with no Stripe keys
// configured the app falls back to the beta direct-plan-set behavior.

export function stripeEnabled() {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
      process.env.STRIPE_PRICE_MONTHLY &&
      process.env.STRIPE_PRICE_ANNUAL &&
      process.env.STRIPE_PRICE_LIFETIME
  );
}

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
  return new Stripe(key);
}

export const PAID_PLANS = ["monthly", "annual", "lifetime"] as const;
export type PaidPlan = (typeof PAID_PLANS)[number];

export function priceIdFor(plan: PaidPlan): string {
  const id = {
    monthly: process.env.STRIPE_PRICE_MONTHLY,
    annual: process.env.STRIPE_PRICE_ANNUAL,
    lifetime: process.env.STRIPE_PRICE_LIFETIME,
  }[plan];
  if (!id) throw new Error(`Price id for plan "${plan}" not configured`);
  return id;
}

export function planForPriceId(priceId: string): PaidPlan | null {
  if (priceId === process.env.STRIPE_PRICE_MONTHLY) return "monthly";
  if (priceId === process.env.STRIPE_PRICE_ANNUAL) return "annual";
  if (priceId === process.env.STRIPE_PRICE_LIFETIME) return "lifetime";
  return null;
}

/**
 * Service-role Supabase client for billing writes (webhook, customer linking).
 * Bypasses RLS — server only, never expose. Requires SUPABASE_SERVICE_ROLE_KEY.
 */
export function supabaseService() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY not configured");
  return createClient(SUPABASE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
