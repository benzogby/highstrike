import type Stripe from "stripe";
import { getStripe, supabaseService } from "@/lib/stripe";

// Admin → Subscriptions (Ben, 2026-11-03: "Yes, like Ripping's"): every membership in Stripe, read live as the page
// opens: who's in their $14 week and when their first $99 comes, who's paying and when they renew, who cancelled
// (and until when they keep access), whose payment failed, and who ended. On top: the money coming in each month and
// how many weeks turned into $99 members. Soonest charge first, as Ripping's lists them. Service role and the secret
// key: call only from an admin-checked page.

export type SubRow = {
  id: string;
  email: string;
  userId: string | null;
  /** In their week, paying, cancelled but still open, payment failed, or over. */
  state: "week" | "member" | "cancelling" | "failed" | "ended";
  /** The next charge (the end of the week or month), when one is due; when access ends for a cancelled one. */
  next: number | null;
  /** The price per month, in cents. */
  cents: number;
  started: number;
  ended: number | null;
  /** It began with a $14 week. */
  hadWeek: boolean;
  /** Its week is over. */
  weekOver: boolean;
  live: boolean;
};

export type SubsList = {
  rows: SubRow[];
  capped: boolean;
  counts: { week: number; member: number; cancelling: number; failed: number; ended: number };
  /** What the paying members bring in a month, in cents (not counting anyone still in their week). */
  monthly: number;
  /** Of the weeks that are over: still paying, cancelled in or after the week, and failed. */
  weeks: { over: number; paying: number };
};

const PAGES = 10;

function idOf(x: string | { id: string } | null | undefined) {
  return typeof x === "string" ? x : x?.id ?? null;
}

/** A membership's state, in Admin's words. */
function stateOf(s: Stripe.Subscription): SubRow["state"] {
  if (s.status === "trialing") return s.cancel_at_period_end || s.cancel_at ? "cancelling" : "week";
  if (s.status === "active") return s.cancel_at_period_end || s.cancel_at ? "cancelling" : "member";
  if (s.status === "past_due" || s.status === "unpaid") return "failed";
  return "ended";
}

/** HighStrike's memberships, as Stripe has them now; null when Stripe isn't set up. */
export async function subscriptionsList(): Promise<SubsList | null> {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  const stripe = getStripe();
  const subs: Stripe.Subscription[] = [];
  let after: string | undefined;
  let capped = true;
  for (let page = 0; page < PAGES; page++) {
    const res = await stripe.subscriptions.list({ status: "all", limit: 100, expand: ["data.customer"], ...(after ? { starting_after: after } : {}) });
    subs.push(...res.data);
    if (!res.has_more || !res.data.length) {
      capped = false;
      break;
    }
    after = res.data[res.data.length - 1].id;
  }
  // Only the membership's (the app makes them with app=highstrike; Stripe's own page puts product=membership on them).
  const ours = subs.filter((s) => s.metadata?.app === "highstrike" || s.metadata?.product === "membership");

  const customers = [...new Set(ours.map((s) => idOf(s.customer)).filter((c): c is string => !!c))];
  const { data: people } = customers.length
    ? await supabaseService().from("profiles").select("id, email, stripe_customer_id").in("stripe_customer_id", customers)
    : { data: [] };
  const byCustomer = new Map(((people ?? []) as { id: string; email: string | null; stripe_customer_id: string }[]).map((p) => [p.stripe_customer_id, p]));
  const now = Date.now() / 1000;

  const rows: SubRow[] = ours.map((s) => {
    const customer = typeof s.customer === "object" && s.customer && !("deleted" in s.customer && s.customer.deleted) ? (s.customer as Stripe.Customer) : null;
    const person = byCustomer.get(idOf(s.customer) ?? "");
    const item = s.items.data[0];
    const state = stateOf(s);
    const periodEnd = item?.current_period_end ?? s.trial_end ?? null;
    return {
      id: s.id,
      email: person?.email || customer?.email || s.metadata?.email || "(no email)",
      userId: person?.id ?? (s.metadata?.user_id || null),
      state,
      next: state === "ended" ? null : s.cancel_at ?? periodEnd,
      cents: item?.price?.unit_amount ?? 0,
      started: s.start_date ?? s.created,
      ended: s.ended_at ?? null,
      hadWeek: s.trial_end != null,
      weekOver: s.trial_end != null && s.trial_end < now,
      live: s.livemode,
    };
  });

  const order: Record<SubRow["state"], number> = { failed: 0, week: 1, cancelling: 2, member: 3, ended: 4 };
  rows.sort((a, b) => order[a.state] - order[b.state] || (a.state === "ended" ? (b.ended ?? 0) - (a.ended ?? 0) : (a.next ?? Infinity) - (b.next ?? Infinity)));

  const counts = { week: 0, member: 0, cancelling: 0, failed: 0, ended: 0 };
  for (const r of rows) counts[r.state]++;
  const monthly = rows.filter((r) => r.state === "member" || (r.state === "cancelling" && r.weekOver) || (r.state === "cancelling" && !r.hadWeek)).reduce((s, r) => s + r.cents, 0);
  const over = rows.filter((r) => r.hadWeek && r.weekOver);
  const weeks = { over: over.length, paying: over.filter((r) => r.state === "member" || r.state === "cancelling").length };
  return { rows, capped, counts, monthly, weeks };
}
