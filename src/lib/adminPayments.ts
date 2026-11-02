import type Stripe from "stripe";
import { getStripe, supabaseService } from "@/lib/stripe";
import { byNewest, idOf, paymentRow, type PaymentRow, type StripeCharge } from "@/lib/paymentRows";

// Admin → Payments (ported from getripping.com, 2026-11-02): every charge Stripe has made or tried, newest first, read
// from Stripe when the page opens, declined ones included (each try at a card is a charge of its own). Each is named by
// its account (the payment's metadata user_id, else the account its lifetime_purchases row opened, else the one whose
// Stripe customer paid), else the address the payment or its customer carries. Service role and the secret key: call only from an admin-checked page.

const PER_PAGE = 100;
/** The newest 1,000, so opening the page can't run on. */
const MAX_PAGES = 10;

export type PaymentsList = { rows: PaymentRow[]; capped: boolean };

async function listed(stripe: Stripe) {
  const out: Stripe.Charge[] = [];
  let after: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await stripe.charges.list({ limit: PER_PAGE, ...(after ? { starting_after: after } : {}) });
    out.push(...res.data);
    if (!res.has_more || !res.data.length) return { charges: out, capped: false };
    after = res.data[res.data.length - 1].id;
  }
  return { charges: out, capped: true };
}

/** The payments, newest first; null when Stripe isn't set up. `customer` narrows it to one Stripe customer. */
export async function paymentsList(customer?: string): Promise<PaymentsList | null> {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  const stripe = getStripe();
  const { charges: raw, capped } = customer
    ? { charges: (await stripe.charges.list({ customer, limit: 100 })).data, capped: false }
    : await listed(stripe);
  const charges = raw as unknown as StripeCharge[];

  const db = supabaseService();
  const customers = [...new Set(charges.map((c) => idOf(c.customer)).filter((c): c is string => !!c))];
  // Pay first: the account a payment opened is on its lifetime_purchases row, not on the payment.
  const intents = [...new Set(charges.map((c) => idOf(c.payment_intent)).filter((p): p is string => !!p))];
  const { data: bought } = intents.length
    ? await db.from("lifetime_purchases").select("payment_intent, user_id").in("payment_intent", intents.slice(0, 1000))
    : { data: [] };
  const opened = new Map(((bought ?? []) as { payment_intent: string; user_id: string | null }[]).filter((b) => b.user_id).map((b) => [b.payment_intent, b.user_id as string]));
  const userOf = (c: StripeCharge) => c.metadata?.user_id || opened.get(idOf(c.payment_intent) ?? "") || "";
  const claimed = [...new Set(charges.map(userOf).filter((u): u is string => !!u))];
  const [{ data: byCus }, { data: byId }] = await Promise.all([
    customers.length ? db.from("profiles").select("id, email, stripe_customer_id").in("stripe_customer_id", customers) : Promise.resolve({ data: [] }),
    claimed.length ? db.from("profiles").select("id, email, stripe_customer_id").in("id", claimed) : Promise.resolve({ data: [] }),
  ]);
  type P = { id: string; email: string | null; stripe_customer_id: string | null };
  const people = new Map<string, P>();
  const ofCustomer = new Map<string, P>();
  for (const p of [...(byCus ?? []), ...(byId ?? [])] as P[]) {
    people.set(p.id, p);
    if (p.stripe_customer_id) ofCustomer.set(p.stripe_customer_id, p);
  }

  // A payment no account claims, with no address of its own, is named by its Stripe customer's (a few, one by one).
  const accountOf = (c: StripeCharge) => people.get(userOf(c)) ?? ofCustomer.get(idOf(c.customer) ?? "") ?? null;
  const own = (c: StripeCharge) => c.billing_details?.email || c.receipt_email || "";
  const orphans = [...new Set(charges.filter((c) => !accountOf(c) && !own(c)).map((c) => idOf(c.customer)).filter((c): c is string => !!c))];
  const customerEmail = new Map<string, string>();
  await Promise.all(
    orphans.slice(0, 50).map(async (id) => {
      const cus = await stripe.customers.retrieve(id).catch(() => null);
      if (cus && !cus.deleted && cus.email) customerEmail.set(id, cus.email);
    })
  );

  const rows = charges.map((c) => {
    const p = accountOf(c);
    return paymentRow(c, { userId: p?.id ?? null, email: p?.email || own(c) || customerEmail.get(idOf(c.customer) ?? "") || "" });
  });
  return { rows: byNewest(rows), capped };
}
