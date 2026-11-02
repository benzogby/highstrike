/**
 * Admin → Payments, ported from getripping.com's (Ben, 2026-11-02: "Copy all applicable aspects of ripping's admin
 * panel"): every charge Stripe has made or tried, newest first, paid, declined, refunded or disputed, with what the card,
 * the bank and Radar said about it (src/lib/adminPayments.ts reads them and names their accounts).
 *
 * The country on a line is where the payer is, as Stripe has it: the billing address's country when the checkout took one,
 * else the country the card was issued in.
 */

/** A charge as Stripe lists it, the fields this reads (times in seconds, amounts in the currency's smallest unit). */
export type StripeCharge = {
  id: string;
  created: number;
  amount: number;
  amount_captured?: number | null;
  amount_refunded?: number | null;
  currency: string;
  status: string;
  paid?: boolean | null;
  refunded?: boolean | null;
  disputed?: boolean | null;
  livemode?: boolean;
  customer?: string | { id: string } | null;
  payment_intent?: string | { id: string } | null;
  description?: string | null;
  receipt_url?: string | null;
  receipt_email?: string | null;
  failure_code?: string | null;
  failure_message?: string | null;
  metadata?: Record<string, string> | null;
  billing_details?: { name?: string | null; email?: string | null; address?: { country?: string | null } | null } | null;
  outcome?: { network_status?: string | null; reason?: string | null; risk_level?: string | null; risk_score?: number | null; seller_message?: string | null; type?: string | null } | null;
  payment_method_details?: {
    type?: string | null;
    card?: {
      brand?: string | null; last4?: string | null; country?: string | null; funding?: string | null; exp_month?: number | null; exp_year?: number | null;
      wallet?: { type?: string | null } | null;
      checks?: { cvc_check?: string | null; address_postal_code_check?: string | null; address_line1_check?: string | null } | null;
      three_d_secure?: { result?: string | null } | null;
    } | null;
  } | null;
};

export type PaymentStatus = "paid" | "declined" | "pending" | "refunded" | "partly_refunded" | "disputed";
export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  paid: "Paid", declined: "Declined", pending: "Pending", refunded: "Refunded", partly_refunded: "Partly refunded", disputed: "Disputed",
};

/** Where a payment stands: declined (Stripe's "failed"), pending, disputed, refunded in full or in part, else paid. */
export function paymentStatus(c: StripeCharge): PaymentStatus {
  if (c.status === "failed") return "declined";
  if (c.status === "pending") return "pending";
  if (c.disputed) return "disputed";
  const refunded = Number(c.amount_refunded ?? 0);
  if (c.refunded || (refunded > 0 && refunded >= Number(c.amount_captured ?? c.amount))) return "refunded";
  if (refunded > 0) return "partly_refunded";
  return "paid";
}

/** A currency's amount as the table says it: "$99", "$99.50", or "99.00 EUR" in another currency. */
export function money(cents: number, currency: string): string {
  const n = Number(cents) || 0;
  return currency.toLowerCase() === "usd" ? (n % 100 === 0 ? `$${(n / 100).toLocaleString("en-US")}` : `$${(n / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`) : `${(n / 100).toFixed(2)} ${currency.toUpperCase()}`;
}

const REGION = (() => {
  try { return new Intl.DisplayNames(["en"], { type: "region" }); } catch { return null; }
})();

/** A country by its two-letter code: its flag and its name ("🇮🇳", "India"), or null for anything else. */
export function countryOf(code: string | null | undefined): { code: string; flag: string; name: string } | null {
  if (!code || !/^[A-Za-z]{2}$/.test(code)) return null;
  const cc = code.toUpperCase();
  const flag = String.fromCodePoint(...[...cc].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
  let name = cc;
  try { name = REGION?.of(cc) ?? cc; } catch { /* an unknown code stays as it is */ }
  return { code: cc, flag, name };
}

/** Where the payer is: the billing address's country, else the card's, saying which. Null when Stripe has neither. */
export function payerCountry(c: StripeCharge): { code: string; flag: string; name: string; from: "billing" | "card" } | null {
  const billing = countryOf(c.billing_details?.address?.country);
  if (billing) return { ...billing, from: "billing" };
  const card = countryOf(c.payment_method_details?.card?.country);
  return card ? { ...card, from: "card" } : null;
}

const BRANDS: Record<string, string> = { visa: "Visa", mastercard: "Mastercard", amex: "Amex", discover: "Discover", jcb: "JCB", diners: "Diners", unionpay: "UnionPay", cartes_bancaires: "Cartes Bancaires", eftpos_au: "eftpos", interac: "Interac" };
const WALLETS: Record<string, string> = { apple_pay: "Apple Pay", google_pay: "Google Pay", link: "Link", samsung_pay: "Samsung Pay", amex_express_checkout: "Amex Express Checkout", masterpass: "Masterpass", visa_checkout: "Visa Checkout" };
const words = (s: string) => s.replace(/_/g, " ");
const capital = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** The card as one short phrase ("Visa •••• 4242 · debit"), or the way it was paid when it isn't a card ("Cash App Pay"). */
export function cardOf(c: StripeCharge): string | null {
  const pm = c.payment_method_details;
  const card = pm?.card;
  if (!card) return pm?.type ? capital(words(pm.type)) : null;
  const brand = card.brand ? (BRANDS[card.brand] ?? capital(words(card.brand))) : "Card";
  const funding = card.funding && card.funding !== "unknown" ? ` · ${card.funding}` : "";
  return `${brand}${card.last4 ? ` •••• ${card.last4}` : ""}${funding}`;
}

/** Why a payment was declined, in Stripe's words ("Your card has insufficient funds."), with its code; null when it wasn't. */
export function declineOf(c: StripeCharge): { message: string; code: string | null } | null {
  if (c.status !== "failed") return null;
  const code = c.outcome?.reason ?? c.failure_code ?? null;
  const message = c.failure_message?.trim() || c.outcome?.seller_message?.trim() || (code ? capital(words(code)) : "Declined");
  return { message, code };
}

const CHECK: Record<string, string> = { pass: "passed", fail: "failed", unavailable: "unavailable", unchecked: "not checked" };
const THREE_DS: Record<string, string> = { authenticated: "3D Secure passed", attempt_acknowledged: "3D Secure attempted", failed: "3D Secure failed", not_supported: "3D Secure not supported", processing_error: "3D Secure error", exempted: "3D Secure exempted" };
const NETWORK: Record<string, string> = { declined_by_network: "Declined by the bank", not_sent_to_network: "Not sent to the bank", reversed_after_approval: "Reversed after approval" };

/**
 * Everything else Stripe says about the payment, a short phrase each, only what it has: what it was for, the name on it,
 * the card's expiry, the wallet, the bank's and Radar's answers, the CVC and postal code checks, 3D Secure, refunds and
 * a dispute.
 */
export function detailsOf(c: StripeCharge): string[] {
  const out: string[] = [];
  const card = c.payment_method_details?.card;
  if (c.description?.trim()) out.push(c.description.trim());
  if (c.billing_details?.name?.trim()) out.push(c.billing_details.name.trim());
  if (card?.exp_month && card.exp_year) out.push(`exp ${String(card.exp_month).padStart(2, "0")}/${String(card.exp_year).slice(-2)}`);
  if (card?.wallet?.type) out.push(WALLETS[card.wallet.type] ?? capital(words(card.wallet.type)));
  const o = c.outcome;
  if (o?.type === "blocked") out.push("Blocked by Radar");
  else if (o?.network_status && NETWORK[o.network_status]) out.push(NETWORK[o.network_status]);
  if (o?.risk_level && o.risk_level !== "not_assessed" && o.risk_level !== "unknown") out.push(`Risk ${o.risk_level}${typeof o.risk_score === "number" ? ` (${o.risk_score})` : ""}`);
  const checks = card?.checks;
  if (checks?.cvc_check) out.push(`CVC ${CHECK[checks.cvc_check] ?? checks.cvc_check}`);
  if (checks?.address_postal_code_check) out.push(`Postal code ${CHECK[checks.address_postal_code_check] ?? checks.address_postal_code_check}`);
  if (card?.three_d_secure?.result) out.push(THREE_DS[card.three_d_secure.result] ?? `3D Secure ${words(card.three_d_secure.result)}`);
  const refunded = Number(c.amount_refunded ?? 0);
  if (refunded > 0) out.push(refunded >= Number(c.amount_captured ?? c.amount) ? `Refunded ${money(refunded, c.currency)}` : `Refunded ${money(refunded, c.currency)} of ${money(Number(c.amount_captured ?? c.amount), c.currency)}`);
  if (c.disputed) out.push("Disputed");
  return out;
}

export const idOf = (v: string | { id: string } | null | undefined): string | null => (typeof v === "string" ? v : (v?.id ?? null));

/** A payment's page on Stripe's dashboard (its PaymentIntent's when it has one, else the charge's), or its customer's. */
export const stripePaymentUrl = (kind: "payments" | "customers", id: string, livemode = true) =>
  `https://dashboard.stripe.com/${livemode ? "" : "test/"}${kind}/${encodeURIComponent(id)}`;

export type PaymentRow = {
  /** The charge's id (ch_… or py_…). */
  id: string;
  /** Its PaymentIntent (pi_…), which its Stripe page goes by, when it has one. */
  paymentIntent: string | null;
  customerId: string | null;
  /** The account it was for, when one is known (its metadata's user_id, else the account's Stripe customer). */
  userId: string | null;
  /** The account's address, else the one the payment or its Stripe customer carries; empty when none is known. */
  email: string;
  /** In ms. */
  at: number;
  amount: string;
  /** In the currency's smallest unit, and its currency, for the totals. */
  cents: number;
  refundedCents: number;
  currency: string;
  status: PaymentStatus;
  country: { code: string; flag: string; name: string; from: "billing" | "card" } | null;
  card: string | null;
  decline: { message: string; code: string | null } | null;
  details: string[];
  receiptUrl: string | null;
  livemode: boolean;
};

/** A charge as a row, its account and address as src/lib/adminPayments.ts found them. */
export function paymentRow(c: StripeCharge, o: { userId: string | null; email: string }): PaymentRow {
  return {
    id: c.id,
    paymentIntent: idOf(c.payment_intent),
    customerId: idOf(c.customer),
    userId: o.userId,
    email: o.email,
    at: c.created * 1000,
    amount: money(c.amount, c.currency),
    cents: Number(c.amount) || 0,
    refundedCents: Number(c.amount_refunded ?? 0) || 0,
    currency: c.currency.toLowerCase(),
    status: paymentStatus(c),
    country: payerCountry(c),
    card: cardOf(c),
    decline: declineOf(c),
    details: detailsOf(c),
    receiptUrl: typeof c.receipt_url === "string" && c.receipt_url.startsWith("https://") ? c.receipt_url : null,
    livemode: c.livemode !== false,
  };
}

/** Newest first; then by id, so the order never shifts. */
export function byNewest(rows: readonly PaymentRow[]): PaymentRow[] {
  return [...rows].sort((a, b) => b.at - a.at || b.id.localeCompare(a.id));
}

/**
 * What the table's header says: how many payments, how many paid (refunded and disputed ones included), declined and
 * refunded, and what was collected in dollars, after refunds (another currency's isn't added in).
 */
export function tallyPayments(rows: readonly PaymentRow[]) {
  const is = (...s: PaymentStatus[]) => rows.filter((r) => s.includes(r.status)).length;
  const collected = rows.filter((r) => r.currency === "usd" && r.status !== "declined" && r.status !== "pending").reduce((sum, r) => sum + r.cents - r.refundedCents, 0);
  return { total: rows.length, paid: is("paid", "partly_refunded", "refunded", "disputed"), declined: is("declined"), refunded: is("refunded", "partly_refunded"), collected };
}
