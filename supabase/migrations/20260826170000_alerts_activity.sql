-- Price alerts + activity feed (terminal loop iteration 6).
-- Alerts: owner-managed via RLS; fired by the server sweep.
-- Activity: global events (user_id null) visible to all members, personal
-- events visible to their owner; written only by the service role.

create table if not exists public.price_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ticker text not null references public.symbols(ticker),
  condition text not null check (condition in ('above','below')),
  threshold numeric not null check (threshold > 0),
  status text not null default 'active' check (status in ('active','fired','cancelled')),
  created_at timestamptz not null default now(),
  fired_at timestamptz,
  fired_price numeric
);

create index if not exists price_alerts_user_idx on public.price_alerts (user_id, status);
create index if not exists price_alerts_active_idx on public.price_alerts (ticker) where status = 'active';

alter table public.price_alerts enable row level security;

drop policy if exists "own alerts" on public.price_alerts;
create policy "own alerts"
  on public.price_alerts for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  kind text not null,
  message text not null,
  ticker text,
  created_at timestamptz not null default now()
);

create index if not exists activity_events_feed_idx
  on public.activity_events (created_at desc);
create index if not exists activity_events_user_idx
  on public.activity_events (user_id, created_at desc);

alter table public.activity_events enable row level security;

drop policy if exists "members read global and own activity" on public.activity_events;
create policy "members read global and own activity"
  on public.activity_events for select to authenticated
  using (user_id is null or user_id = auth.uid());
