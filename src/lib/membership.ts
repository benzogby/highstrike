import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { LIFETIME } from "@/lib/offer";

// Who gets into the app (Ben, 2026-11-02: "Nobody gets access until they become a 397 member"): an account with the
// lifetime membership, or an admin. The same rule guards the tables (public.is_member(),
// supabase/migrations/20261102200000_lifetime_membership.sql); this is the pages' side of it. Every member page asks
// here first, before it reads anything, because a layout can't stop a page from rendering (Next's authentication
// guide, "Layouts and auth checks").

type Profile = { plan?: string | null; is_admin?: boolean | null } | null | undefined;

export function isMember(profile: Profile) {
  return Boolean(profile?.is_admin) || profile?.plan === LIFETIME.plan;
}

/** Where an account without the membership lands: the dashboard, under the paywall (components/join/MemberGate). */
export const PAYWALL = "/dashboard";

/** The signed-in account, its profile and whether it's a member. Nobody signed in goes to Sign in and comes back to `next`. */
export async function memberContext(next: string) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/signin?next=${encodeURIComponent(next)}`);
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, is_admin, name, bio, avatar_url, tour_done")
    .eq("id", user.id)
    .maybeSingle();
  return { supabase, user, profile, member: isMember(profile) };
}

/** A member page's first line: the member, or the paywall for an account without the membership. */
export async function requireMember(next: string) {
  const context = await memberContext(next);
  if (!context.member) redirect(PAYWALL);
  return context;
}
