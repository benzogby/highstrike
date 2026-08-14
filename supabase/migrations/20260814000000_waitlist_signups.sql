-- Waitlist signups for the Highstrike marketing site.
-- RLS: anon may INSERT only (no select/update/delete) — the landing page
-- writes through the publishable key; reads happen in the dashboard or with
-- the service role.

create table if not exists public.waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  source text,
  created_at timestamptz not null default now()
);

alter table public.waitlist_signups enable row level security;

drop policy if exists "anon can join waitlist" on public.waitlist_signups;
create policy "anon can join waitlist"
  on public.waitlist_signups
  for insert
  to anon
  with check (true);
