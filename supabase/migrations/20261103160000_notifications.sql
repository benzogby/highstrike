-- In-app notifications (Ben, 2026-11-03: alerts reach members by email and an in-app bell). One row per thing to tell a
-- member: the top bar's bell shows the latest with an unread count (src/components/NotificationBell.tsx through
-- /api/notifications). Written only by the server with the service key (src/lib/notify.ts notify(), first used by the
-- price-alert sweep in src/lib/alerts.ts); a member reads their own and can mark them read, nothing else.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,          -- what sent it: price_alert, ...
  title text not null,
  body text,
  href text,                   -- a path inside HighStrike to open, like /symbol/NVDA
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications (user_id) where read_at is null;

alter table public.notifications enable row level security;

create policy "own notifications read" on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));

create policy "own notifications marked read" on public.notifications
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- No insert or delete policy: only the service key (which skips RLS) writes them. And of a row, a member may change
-- only read_at.
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
