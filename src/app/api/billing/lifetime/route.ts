import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { isMember } from "@/lib/membership";
import { billingReady, liveMode, publishableKey, startLifetime } from "@/lib/lifetime";
import { LIFETIME } from "@/lib/offer";

export const dynamic = "force-dynamic";

const PRIVATE = { "cache-control": "private, no-store" };

/** Only a relative path on this site, for Stripe's page to come back to. */
function backPath(raw: unknown) {
  return typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//") && raw.length < 200 ? raw : "/";
}

/** The request came from a page on this site (a browser sends Origin with every POST). */
function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

/**
 * GET: where this browser stands, for the homepage's popup (components/join/JoinDialog): signed in or not, a member or
 * not, and whether checkout can take the card in the popup (`embedded`) or goes to Stripe's page.
 */
export async function GET() {
  const base = { ready: billingReady(), embedded: Boolean(publishableKey()), live: liveMode(), cents: LIFETIME.cents };
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ...base, signedIn: false }, { headers: PRIVATE });
  const { data: profile } = await supabase.from("profiles").select("plan, is_admin").eq("id", user.id).maybeSingle();
  return NextResponse.json({ ...base, signedIn: true, email: user.email ?? "", member: isMember(profile) }, { headers: PRIVATE });
}

/**
 * POST { back }: the $397 checkout for the signed-in account (src/lib/lifetime.ts → startLifetime): the payment for the
 * popup's card form, Stripe's checkout page, or `member: true` when there's nothing to pay.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Open checkout from highstrike.com." }, { status: 403 });
  if (!billingReady()) return NextResponse.json({ error: "Checkout isn't set up yet. Nothing was charged." }, { status: 503 });
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first, then check out." }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { back?: unknown };
  try {
    const start = await startLifetime({ id: user.id, email: user.email ?? null }, new URL(request.url).origin, backPath(body.back));
    return NextResponse.json(start, { headers: PRIVATE });
  } catch (e) {
    console.error("lifetime checkout:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Checkout couldn't start. Nothing was charged. Try again in a minute." }, { status: 502 });
  }
}
