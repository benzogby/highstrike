"use server";

import { supabaseServer } from "@/lib/supabase/server";
import { liveMode } from "@/lib/lifetime";
import { LIFETIME } from "@/lib/offer";
import { SALE_ALERT_TO, sendSaleAlert } from "@/lib/saleAlert";

/**
 * Admin → Overview's "Send a test sale alert": the real sale email (src/lib/saleAlert.ts) with a made-up buyer, marked as
 * a test, so Ben can see it in his inbox without anyone paying. Admins only.
 */
export async function sendTestSaleAlert(): Promise<{ ok: boolean; message: string }> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sign in first." };
  const { data: me } = await supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
  if (!me?.is_admin) return { ok: false, message: "Admins only." };
  const sent = await sendSaleAlert({
    email: "jordan@example.com",
    created: true,
    cents: LIFETIME.cents,
    at: new Date(),
    paymentIntent: "pi_test_alert",
    live: liveMode() ?? true,
    test: true,
  });
  return sent.ok ? { ok: true, message: `Sent to ${SALE_ALERT_TO}. Check your inbox (and spam).` } : { ok: false, message: sent.error };
}
