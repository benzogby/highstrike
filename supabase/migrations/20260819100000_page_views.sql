-- First-party site traffic tracking (ported from zogby.io's page-views model).
-- One row per pageview, written by /api/track. Because this app holds no
-- service-role key, access is RLS-shaped instead of service-role-only:
--   - anon/authenticated may INSERT (the tracker route writes with the
--     publishable key; bots are filtered in the route before insert)
--   - only admins may SELECT (aggregation runs under the admin's JWT)
--   - only admins may DELETE (retention pruning from the admin traffic route)

create table if not exists public.page_views (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  path text not null,
  referrer text,            -- external URL on landing, internal path on client-side navs
  visitor_id text,          -- anonymous random id, persisted in the browser (localStorage)
  session_id text,          -- rotates after 30 minutes of inactivity
  device text,              -- mobile | tablet | desktop
  country text,             -- from Vercel's x-vercel-ip-country header
  city text,
  region text,
  user_id uuid              -- signed-in account, when known
);

create index if not exists page_views_created_idx on public.page_views (created_at desc);
create index if not exists page_views_path_idx on public.page_views (path);

alter table public.page_views enable row level security;

drop policy if exists "tracker inserts pageviews" on public.page_views;
create policy "tracker inserts pageviews"
  on public.page_views for insert to anon, authenticated
  with check (true);

drop policy if exists "admins read pageviews" on public.page_views;
create policy "admins read pageviews"
  on public.page_views for select to authenticated
  using (public.is_admin());

drop policy if exists "admins prune pageviews" on public.page_views;
create policy "admins prune pageviews"
  on public.page_views for delete to authenticated
  using (public.is_admin());
