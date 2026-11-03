import { NextResponse } from "next/server";
import { viewer } from "@/lib/membership";
import { billingReady, owedInvoiceUrl } from "@/lib/billing";

export const dynamic = "force-dynamic";

/**
 * The paywall's "Pay $99" for an account locked by a failed payment (Ben: "Lock until paid"): straight to Stripe's page
 * for the invoice it's waiting on, where any card pays it; the subscription goes back to active and the webhook opens the
 * app again. Nothing owed (paid meanwhile): back to the dashboard.
 */
export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const me = await viewer();
  if (!me) return NextResponse.redirect(new URL("/signin?next=/dashboard", origin));
  const url = billingReady() ? await owedInvoiceUrl(me.user.id).catch(() => null) : null;
  return NextResponse.redirect(url ?? new URL("/dashboard", origin));
}
