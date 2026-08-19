-- Billing is live: Stripe (via the service-role webhook) is now the only
-- writer of profiles.plan. Members keep self-serve updates for name, bio,
-- and avatar only — the beta-era direct plan switch is revoked.

revoke update on public.profiles from authenticated, anon;
grant update (name, bio, avatar_url) on public.profiles to authenticated;
