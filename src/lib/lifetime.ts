import type Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { getStripe, supabaseService } from "@/lib/stripe";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabaseConfig";
import { LIFETIME } from "@/lib/offer";
import { TERMS_VERSION, agreedToTerms } from "@/lib/terms";
import { sendSaleAlert } from "@/lib/saleAlert";

// The $397 lifetime membership's payments, on the server only. Ben, 2026-11-02: "Lifetime access should just open to
// the payment popup. Account is created upon payment, with a confirmation email sent to their email. If they already
// have an account under that email, they get upgraded when they pay."
//
// So a payment needs no account: the popup sends the email typed (or the signed-in account's) and the Terms tick when Pay
// is pressed (startLifetime), and once Stripe says it went through, settleLifetime opens the membership on the account
// under that email, making the account first if there's none, and sends the confirmation email. The browser's way back
// (/api/billing/lifetime/complete), the webhook and the paywall all settle through it; lifetime_purchases holds one row
// per payment, so it happens once. Only the service key writes profiles.plan
// (supabase/migrations/20260819170000_stripe_plan_lockdown.sql).

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

/** A plausible email, lower-cased as Supabase keeps them; null for anything else. */
export function cleanEmail(raw: unknown) {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  return email.length <= 254 && /^[^\s@,;()<>]+@[^\s@,;()<>]+\.[^\s@,;()<>]+$/.test(email) ? email : null;
}

/** A payment for the membership that went through: ours, the full price, in dollars. */
export function paidLifetime(pi: Stripe.PaymentIntent) {
  return pi.status === "succeeded" && pi.metadata?.product === LIFETIME.plan && pi.currency === "usd" && pi.amount_received >= LIFETIME.cents;
}

function idOf(x: string | { id: string } | null | undefined) {
  return typeof x === "string" ? x : x?.id ?? null;
}

type Account = { id: string; email: string | null; plan: string | null; is_admin: boolean | null; stripe_customer_id: string | null; created_at: string };

const ACCOUNT = "id, email, plan, is_admin, stripe_customer_id, created_at";

async function accountById(id: string) {
  const { data } = await supabaseService().from("profiles").select(ACCOUNT).eq("id", id).maybeSingle();
  return (data as Account | null) ?? null;
}

/** The account under an email (profiles.email is auth's, which Supabase keeps lower-cased). */
async function accountByEmail(email: string) {
  const { data } = await supabaseService().from("profiles").select(ACCOUNT).eq("email", email).limit(1).maybeSingle();
  return (data as Account | null) ?? null;
}

const isMemberAccount = (a: Account | null) => Boolean(a && (a.is_admin || a.plan === LIFETIME.plan));

/** Turns the membership on for `userId` (and keeps the Stripe customer it paid as). */
async function grantLifetime(userId: string, customerId: string | null) {
  const { error } = await supabaseService()
    .from("profiles")
    .update({ plan: LIFETIME.plan, ...(customerId ? { stripe_customer_id: customerId } : {}) })
    .eq("id", userId);
  if (error) throw new Error(`Couldn't turn the membership on: ${error.message}`);
}

/** The buyer's Stripe customer: their account's while Stripe still has it, one Stripe has under the email, or a new one. */
async function customerFor(stripe: Stripe, email: string, account: Account | null) {
  if (account?.stripe_customer_id) {
    const c = await stripe.customers.retrieve(account.stripe_customer_id).catch(() => null);
    if (c && !c.deleted) return c.id;
  }
  const found = (await stripe.customers.list({ email, limit: 1 })).data[0];
  const id = found?.id ?? (await stripe.customers.create({ email, metadata: account ? { user_id: account.id } : {} })).id;
  if (account) await supabaseService().from("profiles").update({ stripe_customer_id: id }).eq("id", account.id);
  return id;
}

/** The customer's recent membership payments for this email: one that went through, and one still waiting to be paid. */
async function customerPayments(stripe: Stripe, customerId: string, email: string) {
  const { data } = await stripe.paymentIntents.list({ customer: customerId, limit: 20 });
  const ours = data.filter((pi) => pi.metadata?.product === LIFETIME.plan && (!pi.metadata.email || pi.metadata.email === email));
  return {
    paid: ours.find(paidLifetime) ?? null,
    open:
      ours.find(
        (pi) =>
          pi.amount === LIFETIME.cents &&
          pi.currency === "usd" &&
          ["requires_payment_method", "requires_confirmation", "requires_action"].includes(pi.status)
      ) ?? null,
  };
}

const walletHosts = new Set<string>();

/**
 * Apple Pay (and Google Pay) in the popup's card form, which Stripe shows only on a domain registered with it
 * (Ben, 2026-11-02: "add apple pay as a payment option"). Registers and validates this host once per server; Stripe's
 * own checkout page needs none of it. Never in the way of a payment: a failure is logged and the card form opens as ever.
 * The popup's first look (GET /api/billing/lifetime) starts it too, so it's done before anyone reaches Pay.
 */
export async function walletDomain(stripe: Stripe, origin: string) {
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
  /** The email's account has the membership already: nothing to pay. */
  | { alreadyMember: true; email: string }
  /** The payment for the popup's card form. */
  | { clientSecret: string; paymentIntent: string }
  /** Stripe's own checkout page. */
  | { url: string };

/**
 * The checkout, made as Pay is pressed: for the signed-in account (`userId`), or for whoever types `email`, account or
 * not. Nothing to pay when that account is a member already, or when an earlier payment of theirs went through (which
 * this settles). Otherwise the payment for the popup's card form (one still waiting is reused), or Stripe's own page when
 * there's no publishable key or the popup asks for it (`hosted`: its card form couldn't load). The email, the account if
 * there is one and the Terms tick ride on the payment, for settleLifetime. Cards only, so access never waits on a bank.
 * `back` is where Stripe's page returns to if they leave it.
 */
export async function startLifetime(input: {
  email: string;
  userId: string | null;
  /** They ticked the Terms box just now: its time and version go on the payment, and from there on the account. */
  ticked: boolean;
  origin: string;
  back: string;
  hosted: boolean;
}): Promise<Start> {
  const stripe = getStripe();
  const account = input.userId ? await accountById(input.userId) : await accountByEmail(input.email);
  if (isMemberAccount(account)) return { alreadyMember: true, email: input.email };
  const customer = await customerFor(stripe, input.email, account);
  const { paid, open } = await customerPayments(stripe, customer, input.email);
  if (paid && (await settleLifetime(paid))) return { alreadyMember: true, email: input.email };
  const metadata: Record<string, string> = {
    product: LIFETIME.plan,
    email: input.email,
    user_id: account?.id ?? "",
    ...(input.ticked ? { terms_accepted_at: new Date().toISOString(), terms_version: TERMS_VERSION } : {}),
  };
  if (input.hosted || !publishableKey()) {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: LIFETIME.cents,
            product_data: { name: LIFETIME.name, description: "The daily trades, the tools and HighStrike Trading School, for life. One payment." },
          },
        },
      ],
      payment_method_types: ["card"],
      metadata,
      payment_intent_data: { description: LIFETIME.name, metadata, receipt_email: input.email },
      success_url: `${input.origin}/api/billing/lifetime/complete?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${input.origin}${input.back}`,
    });
    if (!session.url) throw new Error("Stripe didn't return a checkout page.");
    return { url: session.url };
  }
  await walletDomain(stripe, input.origin);
  const pi = open
    ? await stripe.paymentIntents.update(open.id, { metadata, receipt_email: input.email })
    : await stripe.paymentIntents.create({
        amount: LIFETIME.cents,
        currency: "usd",
        customer,
        description: LIFETIME.name,
        metadata,
        payment_method_types: ["card"],
        receipt_email: input.email,
      });
  if (!pi.client_secret) throw new Error("Stripe didn't return the payment's secret.");
  return { clientSecret: pi.client_secret, paymentIntent: pi.id };
}

/** The email a paid payment is for: the one typed, then Stripe's receipt address, then its customer's. */
async function paymentEmail(stripe: Stripe, pi: Stripe.PaymentIntent) {
  const typed = cleanEmail(pi.metadata?.email) ?? cleanEmail(pi.receipt_email);
  if (typed) return typed;
  const id = idOf(pi.customer);
  const c = id ? await stripe.customers.retrieve(id).catch(() => null) : null;
  return c && !c.deleted ? cleanEmail(c.email) : null;
}

/** The Terms tick the payment carries, for the account's own record (src/lib/terms.ts). */
function termsOn(pi: Stripe.PaymentIntent) {
  const at = pi.metadata?.terms_accepted_at;
  return at ? { terms_accepted_at: at, terms_version: pi.metadata?.terms_version || TERMS_VERSION } : null;
}

export type Settled = {
  userId: string;
  email: string;
  /** The payment made this account (it had none under this email before). */
  created: boolean;
};

/**
 * Turns a paid membership payment into access, once whoever asks first: the account under its email (the signed-in
 * buyer's when there was one) gets the plan and the Terms tick, and with no account under that email one is made,
 * confirmed, with nothing else to fill in. Then the confirmation email, once. Null for a payment that isn't a paid
 * membership. An account made "for this payment" is one made since the payment was, whichever settle made it.
 */
export async function settleLifetime(pi: Stripe.PaymentIntent): Promise<Settled | null> {
  if (!paidLifetime(pi)) return null;
  const stripe = getStripe();
  const service = supabaseService();
  const email = await paymentEmail(stripe, pi);
  if (!email) {
    console.error(`lifetime: payment ${pi.id} went through with no email to open an account for`);
    return null;
  }
  await service
    .from("lifetime_purchases")
    .upsert({ payment_intent: pi.id, email, amount_cents: pi.amount_received }, { onConflict: "payment_intent", ignoreDuplicates: true });

  const terms = termsOn(pi);
  let account = (pi.metadata?.user_id ? await accountById(pi.metadata.user_id) : null) ?? (await accountByEmail(email));
  if (!account) {
    const { data, error } = await service.auth.admin.createUser({ email, email_confirm: true, user_metadata: terms ?? {} });
    // Made a moment ago by another settle of this payment (the webhook, the way back), or here just now.
    account = data?.user ? await accountById(data.user.id) : await accountByEmail(email);
    if (!account) throw new Error(`Couldn't open an account for payment ${pi.id}: ${error?.message ?? "no profile"}`);
  } else if (terms) {
    // An account that hadn't agreed yet: the tick on this payment is its agreement.
    const { data } = await service.auth.admin.getUserById(account.id);
    if (data?.user && !agreedToTerms(data.user)) {
      await service.auth.admin.updateUserById(account.id, { user_metadata: { ...data.user.user_metadata, ...terms } });
    }
  }
  const created = new Date(account.created_at).getTime() >= pi.created * 1000;

  await grantLifetime(account.id, idOf(pi.customer));
  await service.from("lifetime_purchases").update({ user_id: account.id, created_account: created }).eq("payment_intent", pi.id);
  if (pi.metadata?.user_id !== account.id) {
    await stripe.paymentIntents.update(pi.id, { metadata: { user_id: account.id } }).catch(() => null);
  }
  await confirmationEmail(pi.id, email);
  await saleAlert(pi, email, created);
  return { userId: account.id, email, created };
}

/** Ben's email about the sale (src/lib/saleAlert.ts), once per payment; why it didn't go out is kept on the purchase. */
async function saleAlert(pi: Stripe.PaymentIntent, email: string, created: boolean) {
  const service = supabaseService();
  const { data: claimed } = await service
    .from("lifetime_purchases")
    .update({ alerted_at: new Date().toISOString() })
    .eq("payment_intent", pi.id)
    .is("alerted_at", null)
    .select("payment_intent");
  if (!claimed?.length) return;
  const sent = await sendSaleAlert({ email, created, cents: pi.amount_received, at: new Date(pi.created * 1000), paymentIntent: pi.id, live: pi.livemode });
  if (!sent.ok) {
    console.error(`lifetime: the sale alert for ${pi.id} didn't go out:`, sent.error);
    await service.from("lifetime_purchases").update({ alert_error: sent.error.slice(0, 300) }).eq("payment_intent", pi.id);
  }
}

/**
 * The confirmation email, once per payment: Supabase's "Magic link" email, which HighStrike's template words as the
 * welcome ("Your HighStrike lifetime access is ready") with a button that signs them in (/auth/callback). It goes out
 * through Supabase's mail; until the project has its own SMTP sender, Supabase delivers only to its own team, so for
 * anyone else this fails and the reason is kept on the purchase (email_error). Access never waits on it.
 */
async function confirmationEmail(paymentIntent: string, email: string) {
  const service = supabaseService();
  const { data: claimed } = await service
    .from("lifetime_purchases")
    .update({ emailed_at: new Date().toISOString() })
    .eq("payment_intent", paymentIntent)
    .is("emailed_at", null)
    .select("payment_intent");
  if (!claimed?.length) return;
  const mailer = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: { flowType: "implicit", persistSession: false, autoRefreshToken: false } });
  const { error } = await mailer.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
  if (error) {
    console.error(`lifetime: the confirmation email to ${email.replace(/^(.).*@/, "$1…@")} didn't go out:`, error.message);
    await service.from("lifetime_purchases").update({ email_error: error.message.slice(0, 300) }).eq("payment_intent", paymentIntent);
  }
}

/**
 * The one automatic sign-in a new account gets: in the browser that paid (the caller checks that), within the hour, for
 * an account the payment made. An account that was there before is never signed in this way; its owner signs in.
 */
export async function claimFirstSignIn(paymentIntent: string) {
  const { data } = await supabaseService()
    .from("lifetime_purchases")
    .update({ signed_in_at: new Date().toISOString() })
    .eq("payment_intent", paymentIntent)
    .eq("created_account", true)
    .is("signed_in_at", null)
    .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString())
    .select("payment_intent");
  return Boolean(data?.length);
}

/** A one-time sign-in for `email`, as an emailed link would carry it, but never emailed: for the route to verify at once. */
export async function signInToken(email: string) {
  const { data, error } = await supabaseService().auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data?.properties?.hashed_token) throw new Error(`Couldn't make a sign-in for the new account: ${error?.message ?? "no token"}`);
  return { tokenHash: data.properties.hashed_token, type: data.properties.verification_type };
}

/** What the welcome page says about a payment: its email, whether it made the account, whether the email went out. */
export async function purchaseOf(paymentIntent: string) {
  const { data } = await supabaseService()
    .from("lifetime_purchases")
    .select("email, user_id, created_account, emailed_at, email_error")
    .eq("payment_intent", paymentIntent)
    .maybeSingle();
  return data as { email: string; user_id: string | null; created_account: boolean; emailed_at: string | null; email_error: string | null } | null;
}

/**
 * For the paywall: a membership payment of this account's that never got settled (its browser never came back and the
 * webhook didn't land), found by the account or its email, settled now. True when the account is a member after it.
 */
export async function healMembership(user: { id: string; email?: string | null }) {
  const stripe = getStripe();
  const service = supabaseService();
  const email = cleanEmail(user.email);
  const refs = new Set<string>();
  const { data: mine } = await service.from("lifetime_purchases").select("payment_intent").eq("user_id", user.id).limit(5);
  mine?.forEach((r) => refs.add(r.payment_intent as string));
  if (email) {
    const { data: theirs } = await service.from("lifetime_purchases").select("payment_intent").eq("email", email).limit(5);
    theirs?.forEach((r) => refs.add(r.payment_intent as string));
  }
  const account = await accountById(user.id);
  if (account?.stripe_customer_id) {
    const { data } = await stripe.paymentIntents.list({ customer: account.stripe_customer_id, limit: 20 }).catch(() => ({ data: [] as Stripe.PaymentIntent[] }));
    data.filter((pi) => pi.metadata?.user_id === user.id || (email && pi.metadata?.email === email)).forEach((pi) => refs.add(pi.id));
  }
  for (const ref of refs) {
    const pi = await stripe.paymentIntents.retrieve(ref).catch(() => null);
    const settled = pi ? await settleLifetime(pi) : null;
    if (settled?.userId === user.id) return true;
  }
  return false;
}
