import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/supabaseConfig";

// Server-only billing helpers. Everything is env-gated: with no Stripe keys
// configured the app falls back to the beta direct-plan-set behavior.

export function stripeEnabled() {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
      process.env.STRIPE_PRICE_TRADING_ROOM &&
      process.env.STRIPE_PRICE_TRADING_SCHOOL &&
      process.env.STRIPE_PRICE_ALPHA_MASTERMIND
  );
}

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
  return new Stripe(key);
}

// room = monthly subscription; school & mastermind = one-time purchases.
export const PAID_PLANS = ["room", "school", "mastermind"] as const;
export type PaidPlan = (typeof PAID_PLANS)[number];

export const SUBSCRIPTION_PLANS: readonly PaidPlan[] = ["room"];

export function priceIdFor(plan: PaidPlan): string {
  const id = {
    room: process.env.STRIPE_PRICE_TRADING_ROOM,
    school: process.env.STRIPE_PRICE_TRADING_SCHOOL,
    mastermind: process.env.STRIPE_PRICE_ALPHA_MASTERMIND,
  }[plan];
  if (!id) throw new Error(`Price id for plan "${plan}" not configured`);
  return id;
}

export function planForPriceId(priceId: string): PaidPlan | null {
  if (priceId === process.env.STRIPE_PRICE_TRADING_ROOM) return "room";
  if (priceId === process.env.STRIPE_PRICE_TRADING_SCHOOL) return "school";
  if (priceId === process.env.STRIPE_PRICE_ALPHA_MASTERMIND) return "mastermind";
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
