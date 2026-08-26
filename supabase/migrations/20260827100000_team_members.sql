-- Team page: members managed in Admin ▸ Team, displayed publicly on /company.
-- Photos live in the site-assets bucket (admin-writable already).

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  title text not null default '',
  bio text not null default '',
  photo_url text,
  position int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists team_members_order_idx
  on public.team_members (is_active, position, created_at);

alter table public.team_members enable row level security;

drop policy if exists "public reads active team" on public.team_members;
create policy "public reads active team"
  on public.team_members for select
  using (is_active);

drop policy if exists "admins manage team" on public.team_members;
create policy "admins manage team"
  on public.team_members for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
