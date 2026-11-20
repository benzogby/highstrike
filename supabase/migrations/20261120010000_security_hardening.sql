-- Security review, 2026-11-20 (docs/security-checklist.md).

-- 1. Rate limits that hold across every server instance (src/lib/security.ts → allow(…, durable)). One row per key
--    (a hash of route + caller), a fixed window. Nobody but the service role can read, write or call it.
create table if not exists public.rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  hits integer not null default 0
);
alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

create or replace function public.rate_hit(p_key text, p_max integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  insert into public.rate_limits as r (key, window_start, hits)
  values (p_key, now(), 1)
  on conflict (key) do update
    set hits = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.hits + 1 end,
        window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning hits into n;
  -- Now and then, clear windows that ended over a day ago.
  if random() < 0.002 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;
  return n <= p_max;
end;
$$;
revoke all on function public.rate_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_hit(text, integer, integer) to service_role;

-- 2. The waitlist and page views are written by the server only (api/waitlist, api/track, both rate limited), so
--    nobody can fill them straight through the REST API with the public key.
drop policy if exists "anon can join waitlist" on public.waitlist_signups;
revoke insert on public.waitlist_signups from anon, authenticated;
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'page_views' and cmd = 'INSERT' loop
    execute format('drop policy %I on public.page_views', p.policyname);
  end loop;
end $$;
revoke insert on public.page_views from anon, authenticated;

-- 3. Functions: the trigger that makes a profile is never called directly; the membership checks are for signed-in
--    accounts (RLS policies run them as the caller), not for anonymous visitors. The homepage's get_landing_* and
--    education_summary stay public on purpose: they're the homepage's own numbers.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.is_member() from public, anon;
revoke execute on function public.has_education() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;
grant execute on function public.is_member() to authenticated, service_role;
grant execute on function public.has_education() to authenticated, service_role;

-- 4. Public buckets take pictures only, and not huge ones: avatars (members, no SVG, which can carry script) and
--    site-assets (admins: logos, photos, icons).
update storage.buckets
  set file_size_limit = 5 * 1024 * 1024,
      allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
  where id = 'avatars';
update storage.buckets
  set file_size_limit = 10 * 1024 * 1024,
      allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon', 'image/avif']
  where id = 'site-assets';
