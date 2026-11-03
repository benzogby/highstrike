import { cache } from "react";
import { redirect } from "next/navigation";
import type { UserAppMetadata, UserMetadata } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";
import { MEMBERSHIP, MEMBER_PLANS } from "@/lib/offer";

// Who gets into the app: a member (Ben, 2026-11-03: $14 for the first week, then $99/month; profiles.plan 'monthly'
// while the subscription is in its week or paid up, src/lib/billing.ts), an account an admin granted access to
// ('lifetime'), or an admin. The same rule guards the tables (public.is_member(),
// supabase/migrations/20261103150000_monthly_membership.sql); this is the pages' side of it. Every member page asks
// here first, before it reads anything, because a layout can't stop a page from rendering (Next's authentication
// guide, "Layouts and auth checks").

type Profile = { plan?: string | null; is_admin?: boolean | null } | null | undefined;

export function isMember(profile: Profile) {
  return Boolean(profile?.is_admin) || MEMBER_PLANS.includes(profile?.plan ?? "");
}

/** A member's plan is known good until plan_until; past it (and a few minutes' grace), the page asks Stripe again. */
function stale(profile: { plan?: string | null; plan_until?: string | null } | null | undefined) {
  if (profile?.plan !== MEMBERSHIP.plan) return false;
  const until = profile.plan_until ? Date.parse(profile.plan_until) : NaN;
  return !Number.isFinite(until) || until < Date.now() - 5 * 60_000;
}

/** Where an account without the membership lands: the dashboard, under the paywall (components/join/MemberGate). */
export const PAYWALL = "/dashboard";

/** The signed-in account as its verified sign-in token describes it. */
export type Viewer = { id: string; email?: string; user_metadata: UserMetadata; app_metadata: UserAppMetadata };

/**
 * The signed-in account, its profile and whether it's a member, or null for nobody signed in. Read once per request:
 * the (app) layout draws the sidebar from it and the page gates on it, so React's cache shares one read between them.
 * Speed (Ben, 2026-11-02: "make it lightning fast"): the sign-in is checked with getClaims, which verifies the token
 * against the project's signing keys (ES256) on the server itself instead of a trip to Supabase's auth server on every
 * page, as getUser did; the profile is the one database read. The token's user_metadata can be up to an hour old, so
 * anything that needs it fresh (the paywall's Terms check) asks getUser itself. A member whose week or month has ended
 * since we last heard from Stripe (a webhook that never came) is checked with Stripe before the page goes on, so a
 * lapsed or failed payment can't keep the app open; that's one call, once per period.
 */
export const viewer = cache(async () => {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  const user: Viewer = {
    id: claims.sub,
    email: claims.email,
    user_metadata: claims.user_metadata ?? {},
    app_metadata: claims.app_metadata ?? {},
  };
  const columns = "plan, plan_until, is_admin, name, bio, avatar_url, tour_done";
  let { data: profile } = await supabase.from("profiles").select(columns).eq("id", user.id).maybeSingle();
  if (stale(profile)) {
    const { recheckMember } = await import("@/lib/billing");
    await recheckMember(user.id).catch((e) => console.error("membership: couldn't recheck with Stripe:", e instanceof Error ? e.message : e));
    ({ data: profile } = await supabase.from("profiles").select(columns).eq("id", user.id).maybeSingle());
  }
  return { supabase, user, profile, member: isMember(profile) };
});

/** The signed-in account, its profile and whether it's a member. Nobody signed in goes to Sign in and comes back to `next`. */
export async function memberContext(next: string) {
  const context = await viewer();
  if (!context) redirect(`/signin?next=${encodeURIComponent(next)}`);
  return context;
}

/** A member page's first line: the member, or the paywall for an account without the membership. */
export async function requireMember(next: string) {
  const context = await memberContext(next);
  if (!context.member) redirect(PAYWALL);
  return context;
}
