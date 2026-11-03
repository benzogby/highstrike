import type Stripe from "stripe";
import { getStripe, supabaseService } from "@/lib/stripe";
import { GRANTED_PLAN, MEMBERSHIP, MEMBER_PLANS, MONTHLY_PRICE, TRIAL_PRICE, dollars } from "@/lib/offer";
import { SITE_URL, esc, sendMail } from "@/lib/mail";
import { TERMS_VERSION, agreedToTerms } from "@/lib/terms";
import { sendSaleAlert } from "@/lib/saleAlert";

// The membership's billing, on the server only. Ben, 2026-11-03: "Make the pricing Try it for a week for $14 and then
// $99/month thereafter", with the answers to the questions after it: one week per person, checked by email and by card
// (someone whose week was used starts at $99); the week opens everything; no reminder before the first $99; a $99 that
// fails locks the account until it's paid; members cancel from Settings → Billing on Stripe's billing page; Ben's alert
// email goes out for each new $14 week only.
//
// Paying needs no account (pay first, as the $397 did): the popup sends the email and the card (a ConfirmationToken,
// so the card can be checked for an earlier week before anything is charged) when Pay is pressed (startMembership).
// The first payment is a PaymentIntent of our own, $14 for the week or $99 for a first month, which saves the card;
// once it goes through, settleMembership opens the account under that email (making it if there's none), starts the
// Stripe subscription at $99/month from the end of the week (or of that first month) on the saved card, and sends the
// confirmation. The browser's way back, the webhook and the paywall all settle through it; `purchases` holds one row per
// first payment, so it happens once.
//
// After that Stripe runs the subscription, and syncSubscription keeps `subscriptions` and profiles.plan in step with
// it: trialing or active is a member ('monthly'), anything else isn't. The webhook says so the moment it changes; the
// pages ask Stripe again whenever an account's plan_until has passed, so a missed webhook can't keep a lapsed account
// open. Only the service key writes profiles.plan (20260819170000_stripe_plan_lockdown.sql).

/** The membership's payments carry this in their metadata, checkout sessions too. */
const PRODUCT = "membership";

/** Stripe's subscription states that keep the app open. */
const LIVE = ["trialing", "active"];
/** A payment failed: locked until it's paid (Ben: "Lock until paid"). */
const OWED = ["past_due", "unpaid"];

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

function idOf(x: string | { id: string } | null | undefined) {
  return typeof x === "string" ? x : x?.id ?? null;
}

const iso = (seconds?: number | null) => (seconds ? new Date(seconds * 1000).toISOString() : null);

/** "Nov 10" for a time in seconds, in New York. */
function day(seconds: number) {
  return new Date(seconds * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" });
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

const isMemberAccount = (a: Account | null) => Boolean(a && (a.is_admin || MEMBER_PLANS.includes(a.plan ?? "")));

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

let priceCache: Stripe.Price | null = null;
const PRICE_KEY = "highstrike_membership_monthly_9900";

/**
 * The $99/month price in Stripe, found by its lookup key, or made the first time (no dashboard work for Ben). A second
 * server making it at the same moment loses the lookup key and reads the first one's.
 */
export async function monthlyPrice(stripe: Stripe) {
  if (priceCache) return priceCache;
  const find = async () => (await stripe.prices.list({ lookup_keys: [PRICE_KEY], active: true, limit: 1 })).data[0] ?? null;
  let price = await find();
  if (!price) {
    price = await stripe.prices
      .create({
        currency: "usd",
        unit_amount: MEMBERSHIP.monthlyCents,
        recurring: { interval: "month" },
        lookup_key: PRICE_KEY,
        product_data: { name: MEMBERSHIP.name, statement_descriptor: "HIGHSTRIKE" },
        metadata: { app: "highstrike" },
      })
      .catch(async (e) => (await find()) ?? Promise.reject(e));
  }
  priceCache = price;
  return price;
}

const PORTAL_KEY = "highstrike-portal-v1";

/**
 * Stripe's billing page as members get it from Settings → Billing (Ben: "Settings → Billing → Link to Stripe billing
 * portal"): change the card, see invoices, cancel. Cancelling ends the membership at the end of what's paid for (the
 * week, or the month), with a reason picker. Its email stays the account's, so it can't be changed there. Made once in
 * Stripe and found again by its metadata.
 */
export async function portalConfiguration(stripe: Stripe) {
  const { data } = await stripe.billingPortal.configurations.list({ active: true, limit: 50 });
  const found = data.find((c) => c.metadata?.app === PORTAL_KEY);
  if (found) return found.id;
  const made = await stripe.billingPortal.configurations.create({
    business_profile: {
      headline: "HighStrike membership",
      privacy_policy_url: `${SITE_URL}/privacy-policy`,
      terms_of_service_url: `${SITE_URL}/terms-of-service`,
    },
    default_return_url: `${SITE_URL}/settings`,
    features: {
      customer_update: { enabled: false },
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: {
        enabled: true,
        mode: "at_period_end",
        proration_behavior: "none",
        cancellation_reason: { enabled: true, options: ["too_expensive", "missing_features", "unused", "too_complex", "other"] },
      },
      subscription_update: { enabled: false },
    },
    metadata: { app: PORTAL_KEY },
  });
  return made.id;
}

const walletHosts = new Set<string>();

/**
 * Apple Pay (and Google Pay) in the popup's card form, which Stripe shows only on a domain registered with it (Ben,
 * 2026-11-02: "add apple pay as a payment option"). Registers and validates this host once per server; Stripe's own
 * checkout page needs none of it. Never in the way of a payment: a failure is logged and the card form opens as ever.
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

/**
 * This person has had their week, or been a member before (Ben: "$99/month right away" for someone who comes back): a
 * first payment or a subscription under the email, the account or the Stripe customer. The card is checked apart, at Pay.
 */
async function weekUsedBy(stripe: Stripe, email: string, account: Account | null, customer: string | null) {
  const db = supabaseService();
  const owners = [`email.eq.${email}`, ...(account ? [`user_id.eq.${account.id}`] : [])].join(",");
  const [{ count: bought }, { count: subscribed }] = await Promise.all([
    db.from("purchases").select("payment_intent", { count: "exact", head: true }).or(owners),
    db.from("subscriptions").select("id", { count: "exact", head: true }).or(customer ? `${owners},customer.eq.${customer}` : owners),
  ]);
  if ((bought ?? 0) > 0 || (subscribed ?? 0) > 0) return true;
  if (!customer) return false;
  const { data } = await stripe.subscriptions.list({ customer, status: "all", limit: 1 });
  return data.length > 0;
}

/** The card had a week before, under any email. */
async function cardWeekUsed(fingerprint: string | null | undefined) {
  if (!fingerprint) return false;
  const { count } = await supabaseService().from("trial_cards").select("fingerprint", { count: "exact", head: true }).eq("fingerprint", fingerprint);
  return (count ?? 0) > 0;
}

/** Whether a signed-in account would start at $99 (its week was used), for the paywall's offer. */
export async function weekUsedFor(user: { id: string; email?: string | null }) {
  const email = cleanEmail(user.email);
  if (!email || !billingReady()) return false;
  const account = await accountById(user.id);
  return weekUsedBy(getStripe(), email, account, account?.stripe_customer_id ?? null).catch(() => false);
}

export type Start =
  /** The email's account is a member already: nothing to pay. */
  | { alreadyMember: true; email: string }
  /** The account has a failed payment to settle first (the paywall's Pay now). */
  | { owes: true; email: string }
  /** Nothing charged: this email or card had its week, so it's $99 a month from today; the popup asks before charging. */
  | { weekUsed: true; email: string }
  /** Charged, and settled: on to the way back. */
  | { paid: true; paymentIntent: string; clientSecret: string }
  /** The bank wants 3-D Secure first: the popup finishes it with Stripe.js, then goes on to the way back. */
  | { action: true; paymentIntent: string; clientSecret: string }
  /** Stripe's own checkout page. */
  | { url: string };

/** A card Stripe turned down (or a problem with it), in Stripe's own words, which say what happened. */
export class Declined extends Error {}

/**
 * The checkout, as Pay is pressed: for the signed-in account (`userId`), or for whoever types `email`, account or not.
 * Nothing to pay when that account is a member already. Otherwise the first payment, confirmed here with the card the
 * popup sent (`confirmationToken`): $14 for the week, or $99 for the first month when the email or the card had its
 * week, which the popup has the buyer agree to first (`full`). Stripe's own page when there's no publishable key or the
 * popup asks for it (`hosted`: its card form couldn't load). The email, the account if there is one and the Terms tick
 * ride on the payment, for settleMembership. Cards only, so access never waits on a bank. `back` is where Stripe's page
 * returns to if they leave it.
 */
export async function startMembership(input: {
  email: string;
  userId: string | null;
  /** They ticked the Terms box just now: its time and version go on the payment, and from there on the account. */
  ticked: boolean;
  origin: string;
  back: string;
  hosted: boolean;
  confirmationToken: string | null;
  /** They agreed to start at $99 a month, their week being used. */
  full: boolean;
}): Promise<Start> {
  const stripe = getStripe();
  const account = input.userId ? await accountById(input.userId) : await accountByEmail(input.email);
  if (isMemberAccount(account)) return { alreadyMember: true, email: input.email };
  if (account && (await owedSubscription(account.id))) return { owes: true, email: input.email };
  const customer = await customerFor(stripe, input.email, account);
  let week = !(await weekUsedBy(stripe, input.email, account, customer));
  const metadata: Record<string, string> = {
    product: PRODUCT,
    email: input.email,
    user_id: account?.id ?? "",
    ...(input.ticked ? { terms_accepted_at: new Date().toISOString(), terms_version: TERMS_VERSION } : {}),
  };

  if (input.hosted || !publishableKey() || !input.confirmationToken) {
    if (!week && !input.full) return { weekUsed: true, email: input.email };
    const price = await monthlyPrice(stripe);
    const kind = week ? "trial" : "month";
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer,
      line_items: [
        { price: price.id, quantity: 1 },
        ...(week
          ? [{ quantity: 1, price_data: { currency: "usd", unit_amount: MEMBERSHIP.trialCents, product_data: { name: `${MEMBERSHIP.name}: your first week` } } }]
          : []),
      ],
      subscription_data: {
        ...(week ? { trial_period_days: MEMBERSHIP.trialDays } : {}),
        description: MEMBERSHIP.name,
        metadata: { ...metadata, kind },
      },
      payment_method_types: ["card"],
      metadata: { ...metadata, kind },
      success_url: `${input.origin}/api/billing/complete?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${input.origin}${input.back}`,
    });
    if (!session.url) throw new Error("Stripe didn't return a checkout page.");
    return { url: session.url };
  }

  // The card first: one that had a week under another email starts at $99 too (Ben: "checked by email and by card").
  const token = await stripe.confirmationTokens.retrieve(input.confirmationToken);
  if (week && (await cardWeekUsed(token.payment_method_preview?.card?.fingerprint))) week = false;
  if (!week && !input.full) return { weekUsed: true, email: input.email };

  await walletDomain(stripe, input.origin);
  let pi: Stripe.PaymentIntent;
  try {
    pi = await stripe.paymentIntents.create({
      amount: week ? MEMBERSHIP.trialCents : MEMBERSHIP.monthlyCents,
      currency: "usd",
      customer,
      confirm: true,
      confirmation_token: input.confirmationToken,
      // The card stays on the customer for the $99 months after.
      setup_future_usage: "off_session",
      payment_method_types: ["card"],
      description: week ? `${MEMBERSHIP.name}: first week` : `${MEMBERSHIP.name}: first month`,
      metadata: { ...metadata, kind: week ? "trial" : "month" },
      receipt_email: input.email,
      return_url: `${input.origin}/api/billing/complete`,
    });
  } catch (e) {
    const err = e as { type?: string; message?: string };
    if (err.type === "StripeCardError") throw new Declined(err.message ?? "That card was declined. Nothing was charged.");
    if (err.type === "StripeInvalidRequestError") {
      console.error("billing: Stripe refused the payment:", err.message);
      throw new Declined("That card couldn't be used here. Try another card. Nothing was charged.");
    }
    throw e;
  }
  if (!pi.client_secret) throw new Error("Stripe didn't return the payment's secret.");
  if (pi.status === "requires_action") return { action: true, paymentIntent: pi.id, clientSecret: pi.client_secret };
  if (pi.status === "succeeded" || pi.status === "processing") {
    if (pi.status === "succeeded") {
      await settleMembership(pi).catch((e) => console.error(`billing: couldn't settle ${pi.id} at once:`, e instanceof Error ? e.message : e));
    }
    return { paid: true, paymentIntent: pi.id, clientSecret: pi.client_secret };
  }
  throw new Declined("That payment didn't go through. Nothing was charged.");
}

/** A first payment of the membership's that went through, in full, in dollars. */
export function paidMembership(pi: Stripe.PaymentIntent) {
  if (pi.status !== "succeeded" || pi.metadata?.product !== PRODUCT || pi.currency !== "usd") return false;
  return pi.amount_received >= (pi.metadata.kind === "month" ? MEMBERSHIP.monthlyCents : MEMBERSHIP.trialCents);
}

/** The email a paid payment is for: the one typed, then Stripe's receipt address, then its customer's. */
async function paymentEmail(stripe: Stripe, pi: Stripe.PaymentIntent) {
  const typed = cleanEmail(pi.metadata?.email) ?? cleanEmail(pi.receipt_email);
  if (typed) return typed;
  const id = idOf(pi.customer);
  const c = id ? await stripe.customers.retrieve(id).catch(() => null) : null;
  return c && !c.deleted ? cleanEmail(c.email) : null;
}

/** The Terms tick a payment carries, for the account's own record (src/lib/terms.ts). */
function termsOn(metadata: Stripe.Metadata | null | undefined) {
  const at = metadata?.terms_accepted_at;
  return at ? { terms_accepted_at: at, terms_version: metadata?.terms_version || TERMS_VERSION } : null;
}

/**
 * The account a first payment is for: the signed-in buyer's, else the one under the email, else a new one, confirmed,
 * with nothing else to fill in. The payment's Terms tick goes on an account that had none. `created`: the account was
 * made since the payment was (by whichever settle got there first).
 */
async function openAccount(email: string, userId: string | undefined, terms: ReturnType<typeof termsOn>, paidAt: number) {
  const service = supabaseService();
  let account = (userId ? await accountById(userId) : null) ?? (await accountByEmail(email));
  if (!account) {
    const { data, error } = await service.auth.admin.createUser({ email, email_confirm: true, user_metadata: terms ?? {} });
    account = data?.user ? await accountById(data.user.id) : await accountByEmail(email);
    if (!account) throw new Error(`Couldn't open an account for ${email.replace(/^(.).*@/, "$1…@")}: ${error?.message ?? "no profile"}`);
  } else if (terms) {
    const { data } = await service.auth.admin.getUserById(account.id);
    if (data?.user && (!agreedToTerms(data.user) || data.user.user_metadata?.terms_version !== terms.terms_version)) {
      await service.auth.admin.updateUserById(account.id, { user_metadata: { ...data.user.user_metadata, ...terms } });
    }
  }
  return { account, created: new Date(account.created_at).getTime() >= paidAt * 1000 };
}

/** One month on from `seconds`, as Stripe's next bill date. */
function monthAfter(seconds: number) {
  const d = new Date(seconds * 1000);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return Math.floor(d.getTime() / 1000);
}

/**
 * The subscription a first payment starts, made once: $99 a month on the card it saved, from the end of the week (a
 * trial in Stripe's terms) or from a month after a first $99. A customer with a live one already keeps it (a second
 * payment from another tab is logged for a refund, not turned into a second subscription).
 */
async function subscriptionFor(stripe: Stripe, pi: Stripe.PaymentIntent, userId: string, email: string) {
  const { data: row } = await supabaseService().from("purchases").select("subscription").eq("payment_intent", pi.id).maybeSingle();
  if (row?.subscription) {
    const had = await stripe.subscriptions.retrieve(row.subscription, { expand: ["latest_invoice"] }).catch(() => null);
    if (had) return had;
  }
  const customer = idOf(pi.customer);
  if (!customer) throw new Error(`Payment ${pi.id} has no customer to bill.`);
  const { data: existing } = await stripe.subscriptions.list({ customer, status: "all", limit: 20, expand: ["data.latest_invoice"] });
  const same = existing.find((s) => s.metadata?.first_payment === pi.id);
  if (same) return same;
  const live = existing.find((s) => LIVE.includes(s.status));
  if (live) {
    console.error(`billing: ${pi.id} paid while ${live.id} was already live for ${customer}; refund it in Stripe`);
    return live;
  }
  const card = idOf(pi.payment_method);
  if (card) {
    await stripe.customers.update(customer, { invoice_settings: { default_payment_method: card } }).catch((e) => console.error("billing: default card:", e instanceof Error ? e.message : e));
  }
  const now = Math.floor(Date.now() / 1000);
  const timing =
    pi.metadata?.kind === "month"
      ? { billing_cycle_anchor: Math.max(now + 3600, monthAfter(pi.created)), proration_behavior: "none" as const }
      : { trial_end: Math.max(now + 3600, pi.created + MEMBERSHIP.trialDays * 86_400) };
  const price = await monthlyPrice(stripe);
  return stripe.subscriptions.create(
    {
      customer,
      items: [{ price: price.id }],
      ...(card ? { default_payment_method: card } : {}),
      description: MEMBERSHIP.name,
      metadata: { app: "highstrike", user_id: userId, email, first_payment: pi.id },
      expand: ["latest_invoice"],
      ...timing,
    },
    { idempotencyKey: `hs-subscription-${pi.id}` }
  );
}

/** Keeps the card that had the $14 week (its fingerprint), so it can't have another under a new email. */
async function rememberCard(stripe: Stripe, pi: Stripe.PaymentIntent, email: string, userId: string) {
  const id = idOf(pi.payment_method);
  const pm = id ? await stripe.paymentMethods.retrieve(id).catch(() => null) : null;
  const fingerprint = pm?.card?.fingerprint;
  if (!fingerprint) return;
  await supabaseService()
    .from("trial_cards")
    .upsert({ fingerprint, email, user_id: userId, payment_intent: pi.id }, { onConflict: "fingerprint", ignoreDuplicates: true });
}

export type Settled = {
  userId: string;
  email: string;
  /** The payment made this account (it had none under this email before). */
  created: boolean;
};

/**
 * Turns a paid first payment into a membership, once, whoever asks first: the account (made if there's none), the
 * subscription, the plan, the card's week on record, the confirmation email and Ben's alert. Null for a payment that
 * isn't a paid first payment of the membership.
 */
export async function settleMembership(pi: Stripe.PaymentIntent): Promise<Settled | null> {
  if (!paidMembership(pi)) return null;
  const stripe = getStripe();
  const service = supabaseService();
  const email = await paymentEmail(stripe, pi);
  if (!email) {
    console.error(`billing: payment ${pi.id} went through with no email to open an account for`);
    return null;
  }
  const kind = pi.metadata?.kind === "month" ? "month" : "trial";
  await service
    .from("purchases")
    .upsert({ payment_intent: pi.id, email, amount_cents: pi.amount_received, kind }, { onConflict: "payment_intent", ignoreDuplicates: true });

  const { account, created } = await openAccount(email, pi.metadata?.user_id || undefined, termsOn(pi.metadata), pi.created);
  const customer = idOf(pi.customer);
  if (customer && account.stripe_customer_id !== customer) {
    await service.from("profiles").update({ stripe_customer_id: customer }).eq("id", account.id);
  }
  const sub = await subscriptionFor(stripe, pi, account.id, email);
  await syncSubscription(sub, { userId: account.id, email, firstPayment: pi.id });
  if (kind === "trial") await rememberCard(stripe, pi, email, account.id).catch((e) => console.error("billing: card record:", e instanceof Error ? e.message : e));
  await service.from("purchases").update({ user_id: account.id, created_account: created, subscription: sub.id }).eq("payment_intent", pi.id);
  if (pi.metadata?.user_id !== account.id) {
    await stripe.paymentIntents.update(pi.id, { metadata: { user_id: account.id } }).catch(() => null);
  }
  await confirmationEmail(pi.id, email, kind, sub);
  if (kind === "trial") await saleAlert(pi.id, { email, created, cents: pi.amount_received, at: new Date(pi.created * 1000), live: pi.livemode });
  return { userId: account.id, email, created };
}

/**
 * The same for Stripe's own checkout page (the popup's fallback): a completed subscription session, paid, settles
 * like a card-form payment, keyed by the session.
 */
export async function settleCheckout(session: Stripe.Checkout.Session): Promise<Settled | null> {
  if (session.metadata?.product !== PRODUCT || session.mode !== "subscription" || session.status !== "complete" || session.payment_status === "unpaid") return null;
  const stripe = getStripe();
  const service = supabaseService();
  const email = cleanEmail(session.metadata?.email) ?? cleanEmail(session.customer_details?.email);
  const subId = idOf(session.subscription);
  if (!email || !subId) {
    console.error(`billing: checkout ${session.id} completed with no ${email ? "subscription" : "email"}`);
    return null;
  }
  const kind = session.metadata?.kind === "month" ? "month" : "trial";
  await service
    .from("purchases")
    .upsert({ payment_intent: session.id, email, amount_cents: session.amount_total ?? 0, kind, subscription: subId }, { onConflict: "payment_intent", ignoreDuplicates: true });
  const { account, created } = await openAccount(email, session.metadata?.user_id || undefined, termsOn(session.metadata), session.created);
  const customer = idOf(session.customer);
  if (customer && account.stripe_customer_id !== customer) {
    await service.from("profiles").update({ stripe_customer_id: customer }).eq("id", account.id);
  }
  const sub = await stripe.subscriptions.retrieve(subId, { expand: ["latest_invoice"] });
  if (sub.metadata?.user_id !== account.id) await stripe.subscriptions.update(sub.id, { metadata: { user_id: account.id } }).catch(() => null);
  await syncSubscription(sub, { userId: account.id, email, firstPayment: session.id });
  await service.from("purchases").update({ user_id: account.id, created_account: created }).eq("payment_intent", session.id);
  await confirmationEmail(session.id, email, kind, sub);
  if (kind === "trial") {
    await saleAlert(session.id, { email, created, cents: session.amount_total ?? MEMBERSHIP.trialCents, at: new Date(session.created * 1000), live: session.livemode });
  }
  return { userId: account.id, email, created };
}

/** The latest invoice, when the subscription came with it expanded. */
function latestInvoice(sub: Stripe.Subscription) {
  return sub.latest_invoice && typeof sub.latest_invoice === "object" ? sub.latest_invoice : null;
}

/**
 * Keeps our copy of a subscription and the account's plan in step with Stripe. The time it holds good (`good_until`)
 * is the end of the week or month, unless its latest invoice still waits to be charged (the first $99 at the end of the
 * week, an hour or so after), when the pages ask Stripe again within two hours. A subscription that owes a payment
 * emails its member once per invoice (Ben: "Lock until paid": the plan drops to 'free' here at the same time).
 */
export async function syncSubscription(sub: Stripe.Subscription, hint: { userId?: string; email?: string; firstPayment?: string } = {}) {
  const db = supabaseService();
  const customer = idOf(sub.customer) ?? "";
  const { data: had } = await db.from("subscriptions").select("user_id, email, first_payment, failed_invoice").eq("id", sub.id).maybeSingle();
  let userId: string | null = hint.userId ?? had?.user_id ?? (sub.metadata?.user_id || null);
  if (!userId && customer) {
    const { data: p } = await db.from("profiles").select("id").eq("stripe_customer_id", customer).limit(1).maybeSingle();
    userId = p?.id ?? null;
  }
  const periodEnd = sub.items.data[0]?.current_period_end ?? sub.trial_end ?? null;
  const invoice = latestInvoice(sub);
  const waiting = invoice && invoice.status !== "paid" && invoice.status !== "void" && invoice.amount_due > 0;
  const soon = Math.floor(Date.now() / 1000) + 2 * 3600;
  const goodUntil = periodEnd ? (waiting ? Math.min(periodEnd, soon) : periodEnd) : soon;
  const email = hint.email ?? had?.email ?? (sub.metadata?.email || null);
  const row = {
    id: sub.id,
    user_id: userId,
    customer,
    email,
    status: sub.status,
    trial_end: iso(sub.trial_end),
    period_end: iso(periodEnd),
    good_until: iso(goodUntil),
    cancel_at_period_end: Boolean(sub.cancel_at_period_end || sub.cancel_at),
    canceled_at: iso(sub.canceled_at),
    ended_at: iso(sub.ended_at),
    first_payment: hint.firstPayment ?? had?.first_payment ?? (sub.metadata?.first_payment || null),
    updated_at: new Date().toISOString(),
  };
  const { error } = await db.from("subscriptions").upsert(row, { onConflict: "id" });
  if (error) throw new Error(`Couldn't keep subscription ${sub.id}: ${error.message}`);
  if (userId) await recomputePlan(userId);
  if (OWED.includes(sub.status) && email && invoice && invoice.status === "open" && had?.failed_invoice !== invoice.id) {
    await paymentFailedEmail(sub.id, email, invoice);
  }
  return row;
}

/** The account's plan from its subscriptions: 'monthly' while one is in its week or paid up, else 'free'. Granted access stays. */
export async function refreshPlan(userId: string) {
  return recomputePlan(userId);
}

async function recomputePlan(userId: string) {
  const db = supabaseService();
  const [{ data: profile }, { data: subs }] = await Promise.all([
    db.from("profiles").select("plan, plan_until").eq("id", userId).maybeSingle(),
    db.from("subscriptions").select("status, good_until").eq("user_id", userId),
  ]);
  if (!profile || profile.plan === GRANTED_PLAN) return;
  const live = (subs ?? []).filter((s) => LIVE.includes(s.status));
  const plan = live.length ? MEMBERSHIP.plan : "free";
  const until = live.map((s) => s.good_until as string | null).filter((x): x is string => Boolean(x)).sort().at(-1) ?? null;
  if (profile.plan === plan && profile.plan_until === until) return;
  const { error } = await db.from("profiles").update({ plan, plan_until: until }).eq("id", userId);
  if (error) throw new Error(`Couldn't set the plan: ${error.message}`);
}

/**
 * Asks Stripe again about an account's subscriptions (every one of its customer's, and any we have on file) and brings
 * the plan in step. The pages call it when plan_until has passed; the paywall calls it for an account that isn't a
 * member, in case a payment went through without word reaching us.
 */
export async function recheckMember(userId: string) {
  const stripe = getStripe();
  const db = supabaseService();
  const [{ data: profile }, { data: ours }] = await Promise.all([
    db.from("profiles").select("stripe_customer_id").eq("id", userId).maybeSingle(),
    db.from("subscriptions").select("id").eq("user_id", userId),
  ]);
  const seen = new Set<string>();
  if (profile?.stripe_customer_id) {
    const { data } = await stripe.subscriptions.list({ customer: profile.stripe_customer_id, status: "all", limit: 20, expand: ["data.latest_invoice"] });
    for (const s of data) {
      seen.add(s.id);
      await syncSubscription(s, { userId });
    }
  }
  for (const { id } of ours ?? []) {
    if (seen.has(id)) continue;
    const s = await stripe.subscriptions.retrieve(id, { expand: ["latest_invoice"] }).catch(() => null);
    if (s) await syncSubscription(s, { userId });
  }
  await recomputePlan(userId);
}

/** The account's subscription that owes a payment (past due or unpaid), if any. */
async function owedSubscription(userId: string) {
  const { data } = await supabaseService().from("subscriptions").select("id").eq("user_id", userId).in("status", OWED).limit(1).maybeSingle();
  return data?.id ?? null;
}

/**
 * For the paywall: a first payment of this account's that never got settled (its browser never came back and the
 * webhook didn't land), found by the account, its email or its Stripe customer, settled now; then its subscriptions
 * asked about again. True when the account is a member after it.
 */
export async function healMembership(user: { id: string; email?: string | null }) {
  const stripe = getStripe();
  const service = supabaseService();
  const email = cleanEmail(user.email);
  const refs = new Set<string>();
  const { data: rows } = await service
    .from("purchases")
    .select("payment_intent, subscription")
    .or([`user_id.eq.${user.id}`, ...(email ? [`email.eq.${email}`] : [])].join(","))
    .limit(10);
  rows?.filter((r) => !r.subscription).forEach((r) => refs.add(r.payment_intent as string));
  const account = await accountById(user.id);
  if (account?.stripe_customer_id) {
    const { data } = await stripe.paymentIntents.list({ customer: account.stripe_customer_id, limit: 20 }).catch(() => ({ data: [] as Stripe.PaymentIntent[] }));
    data.filter((pi) => paidMembership(pi) && (pi.metadata?.user_id === user.id || (email && pi.metadata?.email === email))).forEach((pi) => refs.add(pi.id));
  }
  for (const ref of refs) {
    if (ref.startsWith("cs_")) {
      const session = await stripe.checkout.sessions.retrieve(ref).catch(() => null);
      if (session) await settleCheckout(session).catch((e) => console.error(`billing: heal ${ref}:`, e instanceof Error ? e.message : e));
    } else {
      const pi = await stripe.paymentIntents.retrieve(ref).catch(() => null);
      if (pi) await settleMembership(pi).catch((e) => console.error(`billing: heal ${ref}:`, e instanceof Error ? e.message : e));
    }
  }
  await recheckMember(user.id);
  const fresh = await accountById(user.id);
  return isMemberAccount(fresh);
}

/** Where an account stands, for Settings → Billing and the paywall. */
export type BillingState =
  | { kind: "granted" }
  | { kind: "admin" }
  /** In the $14 week: it ends (and the first $99 is due) at `until`, unless cancelled. */
  | { kind: "trial"; until: string; cancels: boolean }
  /** Paid up to `until`; renews then unless cancelled. */
  | { kind: "active"; until: string; cancels: boolean }
  /** A payment failed: locked until it's paid. */
  | { kind: "owed" }
  /** Never joined, or the membership ended. */
  | { kind: "none"; ended: boolean };

export async function billingState(user: { id: string }, profile: { plan?: string | null; is_admin?: boolean | null } | null | undefined): Promise<BillingState> {
  if (profile?.plan === GRANTED_PLAN) return { kind: "granted" };
  const { data } = await supabaseService()
    .from("subscriptions")
    .select("status, period_end, trial_end, cancel_at_period_end, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(10);
  const subs = data ?? [];
  const live = subs.find((s) => LIVE.includes(s.status));
  if (live) {
    const until = (live.period_end ?? live.trial_end ?? new Date().toISOString()) as string;
    return { kind: live.status === "trialing" ? "trial" : "active", until, cancels: Boolean(live.cancel_at_period_end) };
  }
  if (profile?.is_admin) return { kind: "admin" };
  if (subs.some((s) => OWED.includes(s.status))) return { kind: "owed" };
  return { kind: "none", ended: subs.length > 0 };
}

/** Stripe's page for paying the invoice an owing account's subscription is waiting on, or null. */
export async function owedInvoiceUrl(userId: string) {
  const id = await owedSubscription(userId);
  if (!id) return null;
  const stripe = getStripe();
  const sub = await stripe.subscriptions.retrieve(id, { expand: ["latest_invoice"] }).catch(() => null);
  const invoice = sub ? latestInvoice(sub) : null;
  if (sub && (!invoice || invoice.status !== "open")) await syncSubscription(sub, { userId });
  return invoice?.status === "open" ? invoice.hosted_invoice_url ?? null : null;
}

/** Ben's email for a new $14 week (src/lib/saleAlert.ts), once per first payment; why it didn't go out is kept on the purchase. */
async function saleAlert(ref: string, sale: { email: string; created: boolean; cents: number; at: Date; live: boolean }) {
  const service = supabaseService();
  const { data: claimed } = await service
    .from("purchases")
    .update({ alerted_at: new Date().toISOString() })
    .eq("payment_intent", ref)
    .is("alerted_at", null)
    .select("payment_intent");
  if (!claimed?.length) return;
  const sent = await sendSaleAlert({ ...sale, paymentIntent: ref });
  if (!sent.ok) {
    console.error(`billing: the trial alert for ${ref} didn't go out:`, sent.error);
    await service.from("purchases").update({ alert_error: sent.error.slice(0, 300) }).eq("payment_intent", ref);
  }
}

const P = (text: string, extra = "") => `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#14161a${extra}">${text}</p>`;
const SMALL = ";font-size:13px;color:#4a5160";

function letter(heading: string, body: string, button: { href: string; label: string } | null, small: string[]) {
  return `<div style="margin:0;padding:28px 16px;background:#ffffff;font-family:Inter,Helvetica,Arial,sans-serif;color:#14161a">
<div style="max-width:480px;margin:0 auto">
<p style="margin:0 0 18px;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#009f6f">HighStrike</p>
<h1 style="margin:0 0 12px;font-size:26px;line-height:1.2">${heading}</h1>
${body}
${button ? `<p style="margin:8px 0 24px"><a href="${button.href}" style="display:inline-block;padding:13px 22px;border-radius:8px;background:#009f6f;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none">${button.label}</a></p>` : ""}
${small.map((s) => P(s, SMALL)).join("\n")}
</div>
</div>`;
}

/** The buyer's confirmation: what's open, when the $99 starts, the one line on cancelling (Ben's rule from Ripping: one short line). */
function confirmation(email: string, kind: "trial" | "month", sub: Stripe.Subscription) {
  const open = `${SITE_URL}/dashboard`;
  const next = sub.trial_end ?? sub.items.data[0]?.current_period_end ?? null;
  const when = next ? day(next) : null;
  const trial = kind === "trial";
  const subject = trial ? "Your HighStrike week has started" : "Your HighStrike membership is on";
  const lead = trial
    ? `Everything is open: the smart scanner's trade ideas every morning, every tool and all of HighStrike Trading School. Your account is <b>${esc(email)}</b>.`
    : `Everything is open again: the smart scanner's trade ideas every morning, every tool and all of HighStrike Trading School. Your account is <b>${esc(email)}</b>.`;
  const terms = trial
    ? `Your week runs until ${when ?? "7 days from today"}, then it's ${MONTHLY_PRICE}/month until you cancel in Settings → Billing.`
    : `It's ${MONTHLY_PRICE}/month${when ? `, next on ${when}` : ""}, until you cancel in Settings → Billing.`;
  const signIn = "To sign in on another device, use Continue with Google if this is a Google address, or set a password in Settings while you're signed in.";
  const help = "Stripe emails your receipt separately. Questions? Write to support@highstrike.com.";
  const html = letter("You're in", P(lead) + P(terms), { href: open, label: "Open HighStrike" }, [signIn, help]);
  const text = `You're in.\n\n${lead.replace(/<\/?b>/g, "")}\n\n${terms}\n\nOpen HighStrike: ${open}\n\n${signIn}\n\n${help}`;
  return { subject, html, text };
}

/** The confirmation email, once per first payment, from highstrike.com through Resend. No sign-in link (see below). */
async function confirmationEmail(ref: string, email: string, kind: "trial" | "month", sub: Stripe.Subscription) {
  const service = supabaseService();
  const { data: claimed } = await service
    .from("purchases")
    .update({ emailed_at: new Date().toISOString() })
    .eq("payment_intent", ref)
    .is("emailed_at", null)
    .select("payment_intent");
  if (!claimed?.length) return;
  // No one-time sign-in link in it: Supabase keeps one live link per account, so the browser's automatic sign-in right
  // after paying would cancel it. The buyer is in already; the email confirms it and says how to get in elsewhere.
  const sent = await sendMail({ to: email, kind: "payment", ...confirmation(email, kind, sub) });
  if (!sent.ok) {
    console.error(`billing: the confirmation to ${email.replace(/^(.).*@/, "$1…@")} didn't go out:`, sent.error);
    await service.from("purchases").update({ email_error: sent.error.slice(0, 300) }).eq("payment_intent", ref);
  }
}

/** The one email a failed $99 sends (per invoice): access is paused, and Stripe's page to pay it with any card. */
async function paymentFailedEmail(subscription: string, email: string, invoice: Stripe.Invoice) {
  const { data: claimed } = await supabaseService()
    .from("subscriptions")
    .update({ failed_invoice: invoice.id })
    .eq("id", subscription)
    .or(`failed_invoice.is.null,failed_invoice.neq.${invoice.id}`)
    .select("id");
  if (!claimed?.length) return;
  const pay = invoice.hosted_invoice_url ?? `${SITE_URL}/dashboard`;
  const amount = dollars(invoice.amount_due);
  const subject = "Your HighStrike payment didn't go through";
  const lead = `We couldn't charge ${amount} for your HighStrike membership, so your access is paused. Pay it with any card and everything opens again right away.`;
  const help = "Questions? Write to support@highstrike.com.";
  const html = letter("Your payment didn't go through", P(lead), { href: pay, label: `Pay ${amount}` }, [help]);
  const text = `Your payment didn't go through.\n\n${lead}\n\nPay ${amount}: ${pay}\n\n${help}`;
  const sent = await sendMail({ to: email, subject, html, text, kind: "payment_failed" });
  if (!sent.ok) console.error(`billing: the failed-payment email for ${invoice.id} didn't go out:`, sent.error);
}

/**
 * The one automatic sign-in a new account gets: in the browser that paid (the caller checks that), within the hour, for
 * an account the payment made. An account that was there before is never signed in this way; its owner signs in.
 */
export async function claimFirstSignIn(ref: string) {
  const { data } = await supabaseService()
    .from("purchases")
    .update({ signed_in_at: new Date().toISOString() })
    .eq("payment_intent", ref)
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

/** What the welcome page says about a first payment: its email, the account, the week's end, whether the email went out. */
export async function purchaseOf(ref: string) {
  const { data } = await supabaseService()
    .from("purchases")
    .select("email, user_id, created_account, emailed_at, email_error, kind, subscription")
    .eq("payment_intent", ref)
    .maybeSingle();
  if (!data) return null;
  const { data: sub } = data.subscription
    ? await supabaseService().from("subscriptions").select("trial_end, period_end").eq("id", data.subscription).maybeSingle()
    : { data: null };
  return {
    ...(data as { email: string; user_id: string | null; created_account: boolean; emailed_at: string | null; email_error: string | null; kind: string }),
    /** When the week ends, or the first month: the first (next) $99. */
    nextCharge: (sub?.trial_end ?? sub?.period_end ?? null) as string | null,
  };
}

/** The membership's line for a receipt or a page: "$14 today, then $99/month from Nov 10". */
export function offerLine(week: boolean, from = new Date()) {
  if (!week) return `${MONTHLY_PRICE}/month from today`;
  const end = new Date(from.getTime() + MEMBERSHIP.trialDays * 86_400_000);
  return `${TRIAL_PRICE} today, then ${MONTHLY_PRICE}/month from ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}
