import { getStripe, supabaseService } from "@/lib/stripe";
import { MEMBER_PLANS } from "@/lib/offer";
import { lastDays, nyDay } from "@/lib/adminGate";

// Admin → Growth (getripping.com's tab): a day at a time over the last 30 days in New York, the money collected
// (Stripe's paid charges, less refunds: the $14 weeks and the $99 months), the payments, and the accounts made; and the
// members in all (in their week, paid up, or granted). Service role and the secret key: call only from an admin-checked page.

export type Day = { day: string; revenue: number; sales: number; signups: number };
export type Growth = { days: Day[]; members: number; accounts: number; stripe: boolean };

export async function growth(n = 30): Promise<Growth> {
  const days = lastDays(n);
  const at = new Map(days.map((d) => [d, { day: d, revenue: 0, sales: 0, signups: 0 }]));
  const since = Date.now() - (n + 1) * 86_400_000;
  const db = supabaseService();

  const [{ data: made }, { count: members }, { count: accounts }] = await Promise.all([
    db.from("profiles").select("created_at").gte("created_at", new Date(since).toISOString()).limit(10000),
    db.from("profiles").select("id", { count: "exact", head: true }).in("plan", [...MEMBER_PLANS]),
    db.from("profiles").select("id", { count: "exact", head: true }),
  ]);
  for (const p of (made ?? []) as { created_at: string }[]) {
    const d = at.get(nyDay(p.created_at));
    if (d) d.signups++;
  }

  const stripe = Boolean(process.env.STRIPE_SECRET_KEY);
  if (stripe) {
    const s = getStripe();
    let after: string | undefined;
    for (let page = 0; page < 10; page++) {
      const res = await s.charges.list({ limit: 100, created: { gte: Math.floor(since / 1000) }, ...(after ? { starting_after: after } : {}) });
      for (const c of res.data) {
        if (c.status !== "succeeded" || c.currency !== "usd") continue;
        const d = at.get(nyDay(c.created * 1000));
        if (!d) continue;
        d.revenue += c.amount_captured - c.amount_refunded;
        if (!c.refunded) d.sales++;
      }
      if (!res.has_more || !res.data.length) break;
      after = res.data[res.data.length - 1].id;
    }
  }
  return { days: [...at.values()], members: members ?? 0, accounts: accounts ?? 0, stripe };
}
