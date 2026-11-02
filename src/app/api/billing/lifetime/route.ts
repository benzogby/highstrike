import { NextResponse, after } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { isMember } from "@/lib/membership";
import { getStripe } from "@/lib/stripe";
import { billingReady, cleanEmail, liveMode, publishableKey, startLifetime, walletDomain } from "@/lib/lifetime";
import { LIFETIME } from "@/lib/offer";
import { agreedToTerms } from "@/lib/terms";

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
 * GET: what the payment popup needs before it draws (components/join/JoinDialog): whether checkout can take the card in
 * the popup (Stripe's publishable key, public by design) or goes to Stripe's page, and for a signed-in browser its
 * account's email, whether it's a member already, and whether it has agreed to the Terms.
 */
export async function GET(request: Request) {
  const key = publishableKey();
  const base = { ready: billingReady(), embedded: Boolean(key), publishableKey: key, live: liveMode(), cents: LIFETIME.cents };
  // Apple Pay's domain registration, after the answer so it never slows the popup (once per server).
  if (base.ready && key) after(() => walletDomain(getStripe(), new URL(request.url).origin));
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ...base, signedIn: false }, { headers: PRIVATE });
  const { data: profile } = await supabase.from("profiles").select("plan, is_admin").eq("id", user.id).maybeSingle();
  return NextResponse.json(
    { ...base, signedIn: true, email: user.email ?? "", member: isMember(profile), termsOnRecord: agreedToTerms(user) },
    { headers: PRIVATE }
  );
}

/**
 * POST { email, agreed, back, hosted }: the $397 checkout, made as Pay is pressed (src/lib/lifetime.ts → startLifetime).
 * Nobody needs an account to pay: a signed-in browser pays for its own account, anyone else for the email they typed, and
 * the account is made (or upgraded) once the payment goes through. Pay needs the Terms ticked, unless the signed-in
 * account agreed already. Answers the card form's payment, Stripe's page, or `alreadyMember` (nothing charged).
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Open checkout from highstrike.com." }, { status: 403 });
  if (!billingReady()) return NextResponse.json({ error: "Checkout isn't set up yet. Nothing was charged." }, { status: 503 });
  const body = (await request.json().catch(() => ({}))) as { email?: unknown; agreed?: unknown; back?: unknown; hosted?: unknown };
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user ? cleanEmail(user.email) : cleanEmail(body.email);
  if (!email) return NextResponse.json({ error: "Enter the email for your account. Nothing was charged." }, { status: 400 });
  const ticked = body.agreed === true;
  if (!ticked && !(user && agreedToTerms(user))) {
    return NextResponse.json({ error: "Tick the box to agree to the Terms and Privacy Policy first. Nothing was charged." }, { status: 400 });
  }
  try {
    const start = await startLifetime({
      email,
      userId: user?.id ?? null,
      ticked,
      origin: new URL(request.url).origin,
      back: backPath(body.back),
      hosted: body.hosted === true,
    });
    return NextResponse.json(start, { headers: PRIVATE });
  } catch (e) {
    console.error("lifetime checkout:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Checkout couldn't start. Nothing was charged. Try again in a minute." }, { status: 502 });
  }
}
