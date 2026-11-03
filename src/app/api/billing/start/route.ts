import { NextResponse, after } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { isMember } from "@/lib/membership";
import { getStripe } from "@/lib/stripe";
import { Declined, billingReady, cleanEmail, liveMode, publishableKey, startMembership, walletDomain, weekUsedFor } from "@/lib/billing";
import { MEMBERSHIP } from "@/lib/offer";

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
 * account's email, whether it's a member already, and whether its $14 week was used (it starts at $99 then).
 */
export async function GET(request: Request) {
  const key = publishableKey();
  const base = {
    ready: billingReady(),
    embedded: Boolean(key),
    publishableKey: key,
    live: liveMode(),
    trialCents: MEMBERSHIP.trialCents,
    monthlyCents: MEMBERSHIP.monthlyCents,
  };
  // Apple Pay's domain registration, after the answer so it never slows the popup (once per server).
  if (base.ready && key) after(() => walletDomain(getStripe(), new URL(request.url).origin));
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ...base, signedIn: false, weekUsed: false }, { headers: PRIVATE });
  const { data: profile } = await supabase.from("profiles").select("plan, is_admin").eq("id", user.id).maybeSingle();
  const member = isMember(profile);
  return NextResponse.json(
    {
      ...base,
      signedIn: true,
      email: user.email ?? "",
      member,
      weekUsed: member ? false : await weekUsedFor(user),
    },
    { headers: PRIVATE }
  );
}

/**
 * POST { email, agreed, back, hosted, confirmationToken, full }: the checkout, made as Pay is pressed
 * (src/lib/billing.ts → startMembership). Nobody needs an account to pay: a signed-in browser pays for its own account,
 * anyone else for the email they typed, and the account is made (or upgraded) once the payment goes through. Pay always
 * needs the Terms ticked, signed in or not, since the tick is also their yes to the $99 a month after the first payment.
 * Answers the payment's outcome, Stripe's page, `weekUsed` (nothing charged; the popup asks to start at $99),
 * `alreadyMember` or `owes` (nothing charged), or a card's decline in Stripe's words (402).
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Open checkout from highstrike.com." }, { status: 403 });
  if (!billingReady()) return NextResponse.json({ error: "Checkout isn't set up yet. Nothing was charged." }, { status: 503 });
  const body = (await request.json().catch(() => ({}))) as {
    email?: unknown;
    agreed?: unknown;
    back?: unknown;
    hosted?: unknown;
    confirmationToken?: unknown;
    full?: unknown;
  };
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user ? cleanEmail(user.email) : cleanEmail(body.email);
  if (!email) return NextResponse.json({ error: "Enter the email for your account. Nothing was charged." }, { status: 400 });
  const ticked = body.agreed === true;
  if (!ticked) return NextResponse.json({ error: "Tick the box to agree to the Terms first. Nothing was charged." }, { status: 400 });
  const token = typeof body.confirmationToken === "string" && /^ctoken_[A-Za-z0-9_]+$/.test(body.confirmationToken) ? body.confirmationToken : null;
  try {
    const start = await startMembership({
      email,
      userId: user?.id ?? null,
      ticked,
      origin: new URL(request.url).origin,
      back: backPath(body.back),
      hosted: body.hosted === true,
      confirmationToken: token,
      full: body.full === true,
    });
    return NextResponse.json(start, { headers: PRIVATE });
  } catch (e) {
    if (e instanceof Declined) return NextResponse.json({ error: e.message }, { status: 402, headers: PRIVATE });
    console.error("billing checkout:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Checkout couldn't start. Nothing was charged. Try again in a minute." }, { status: 502 });
  }
}
