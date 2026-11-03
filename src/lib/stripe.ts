import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/supabaseConfig";

// Server-only Stripe and service-key helpers. The membership's billing is src/lib/billing.ts.

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
  return new Stripe(key);
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
