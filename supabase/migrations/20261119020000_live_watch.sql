-- The stocks members have open on a chart right now (src/app/api/live/route.ts stamps them as it's asked), so the
-- always-on worker streams real-time trades for those (Alpaca's free plan streams trades for at most 30 symbols at a
-- time). Server only.
create table if not exists public.live_watch (
  ticker text primary key,
  seen_at timestamptz not null default now()
);
alter table public.live_watch enable row level security;
revoke all on public.live_watch from anon, authenticated;
