-- First-run tour: members flag it done once (per member, not per browser).
-- tour_done joins the small set of self-updatable profile columns; plan and
-- is_admin remain server-only.

alter table public.profiles add column if not exists tour_done boolean not null default false;

revoke update on public.profiles from authenticated, anon;
grant update (name, bio, avatar_url, tour_done) on public.profiles to authenticated;
