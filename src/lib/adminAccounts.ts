import { supabaseService } from "@/lib/stripe";
import { GRANTED_PLAN, MEMBER_PLANS } from "@/lib/offer";

// Admin → Accounts (ported from getripping.com's, 2026-11-02): every account, with its sign-in (Google or email), when it
// last signed in, whether it has the membership, and where it was last seen from (page_views). Service role: call only
// from an admin-checked page or action.

export type Account = {
  id: string;
  email: string;
  name: string | null;
  plan: string;
  /** In the $14 week or paid up ('monthly'), or granted free access ('lifetime'). */
  member: boolean;
  /** Free access an admin granted (Admin → Accounts). */
  granted: boolean;
  /** Its subscription's status in Stripe (trialing, active, past_due, canceled…), the live one first; null for none. */
  billing: string | null;
  admin: boolean;
  joined: string;
  lastSignIn: string | null;
  provider: string;
  terms: string | null;
  country: string | null;
  lastSeen: string | null;
  stripeCustomer: string | null;
};

type AuthUser = { id: string; last_sign_in_at?: string | null; app_metadata?: { provider?: string }; user_metadata?: Record<string, unknown> };

async function authUsers() {
  const db = supabaseService();
  const out = new Map<string, AuthUser>();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) break;
    for (const u of data.users) out.set(u.id, u as AuthUser);
    if (data.users.length < 1000) break;
  }
  return out;
}

/** Where each account was last seen from: its newest page view's country and time. */
async function lastSeen(ids: string[]) {
  const out = new Map<string, { country: string | null; at: string }>();
  if (!ids.length) return out;
  const { data } = await supabaseService()
    .from("page_views")
    .select("user_id, country, created_at")
    .in("user_id", ids)
    .order("created_at", { ascending: false })
    .limit(5000);
  for (const v of (data ?? []) as { user_id: string; country: string | null; created_at: string }[]) {
    const seen = out.get(v.user_id);
    if (!seen) out.set(v.user_id, { country: v.country, at: v.created_at });
    else if (!seen.country && v.country) seen.country = v.country;
  }
  return out;
}

/** Each account's subscription status: a live one (in its week or paid up) over one that owes, over the latest of the rest. */
async function billingOf(ids: string[] | null) {
  const out = new Map<string, string>();
  const q = supabaseService().from("subscriptions").select("user_id, status, updated_at").order("updated_at", { ascending: false }).limit(5000);
  const { data } = ids ? await q.in("user_id", ids) : await q;
  const rank = (s: string) => (s === "trialing" || s === "active" ? 2 : s === "past_due" || s === "unpaid" ? 1 : 0);
  for (const r of (data ?? []) as { user_id: string | null; status: string }[]) {
    if (!r.user_id) continue;
    const had = out.get(r.user_id);
    if (had === undefined || rank(r.status) > rank(had)) out.set(r.user_id, r.status);
  }
  return out;
}

/** The badge an account's membership gets in Admin: its words and tone. */
export function membershipBadge(a: { plan: string | null; admin: boolean; billing?: string | null }): { label: string; tone: "up" | "accent" | "warn" | "down" | "neutral" } {
  if (a.plan === GRANTED_PLAN) return { label: "Free access", tone: "up" };
  if (a.billing === "trialing") return { label: "Trial", tone: "up" };
  if (a.billing === "active" || (a.plan && MEMBER_PLANS.includes(a.plan))) return { label: "Member", tone: "up" };
  if (a.billing === "past_due" || a.billing === "unpaid") return { label: "Payment failed", tone: "down" };
  if (a.admin) return { label: "Admin", tone: "accent" };
  if (a.billing === "canceled") return { label: "Cancelled", tone: "neutral" };
  return { label: "Not paid", tone: "neutral" };
}

function shape(p: Record<string, unknown>, u: AuthUser | undefined, seen: { country: string | null; at: string } | undefined, billing: string | null = null): Account {
  const plan = String(p.plan ?? "free");
  const admin = Boolean(p.is_admin);
  return {
    id: String(p.id),
    email: String(p.email ?? ""),
    name: (p.name as string | null) ?? null,
    plan,
    member: MEMBER_PLANS.includes(plan),
    granted: plan === GRANTED_PLAN,
    billing,
    admin,
    joined: String(p.created_at),
    lastSignIn: u?.last_sign_in_at ?? null,
    provider: u?.app_metadata?.provider ?? "email",
    terms: typeof u?.user_metadata?.terms_accepted_at === "string" ? (u.user_metadata.terms_accepted_at as string) : null,
    country: seen?.country ?? null,
    lastSeen: seen?.at ?? null,
    stripeCustomer: (p.stripe_customer_id as string | null) ?? null,
  };
}

const COLUMNS = "id, email, name, plan, is_admin, created_at, stripe_customer_id";

export async function accountsList(): Promise<Account[]> {
  const db = supabaseService();
  const { data, error } = await db.from("profiles").select(COLUMNS).order("created_at", { ascending: false }).limit(5000);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Record<string, unknown>[];
  const [users, seen, billing] = await Promise.all([authUsers(), lastSeen(rows.map((r) => String(r.id))), billingOf(null)]);
  return rows.map((r) => shape(r, users.get(String(r.id)), seen.get(String(r.id)), billing.get(String(r.id)) ?? null));
}

export async function accountOf(id: string): Promise<Account | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const db = supabaseService();
  const { data } = await db.from("profiles").select(COLUMNS).eq("id", id).maybeSingle();
  if (!data) return null;
  const [{ data: u }, seen, billing] = await Promise.all([db.auth.admin.getUserById(id), lastSeen([id]), billingOf([id])]);
  return shape(data as Record<string, unknown>, (u?.user as AuthUser | undefined) ?? undefined, seen.get(id), billing.get(id) ?? null);
}

/** The account's most visited pages and how many views in all. */
export async function accountTraffic(id: string) {
  const { data } = await supabaseService().from("page_views").select("path, created_at").eq("user_id", id).order("created_at", { ascending: false }).limit(2000);
  const rows = (data ?? []) as { path: string; created_at: string }[];
  const pages = new Map<string, number>();
  for (const r of rows) pages.set(r.path, (pages.get(r.path) ?? 0) + 1);
  return { views: rows.length, pages: [...pages.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10) };
}
