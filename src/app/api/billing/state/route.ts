import { NextResponse } from "next/server";
import { isMember, viewer } from "@/lib/membership";
import { billingReady, recheckMember } from "@/lib/billing";
import { throttle } from "@/lib/security";

export const dynamic = "force-dynamic";

/**
 * Whether the signed-in account is a member now, asking Stripe first: the paywall's owing account polls it after
 * opening Stripe's page to pay its failed invoice, so the app opens the moment the payment lands, webhook or not.
 */
export async function GET(request: Request) {
  const limited = await throttle(request, "billing-state", { max: 120, windowSec: 60 });
  if (limited) return limited;
  const me = await viewer();
  if (!me) return NextResponse.json({ member: false }, { status: 401 });
  if (me.member) return NextResponse.json({ member: true });
  if (billingReady()) await recheckMember(me.user.id).catch(() => null);
  const { data: profile } = await me.supabase.from("profiles").select("plan, is_admin").eq("id", me.user.id).maybeSingle();
  return NextResponse.json({ member: isMember(profile) }, { headers: { "cache-control": "private, no-store" } });
}
