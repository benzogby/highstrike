-- Following saved setups (step 3 of the swipe app, Ben 2026-11-02: "Only saved ones" are scored): each right swipe is
-- open until the stock reaches its take profit or stop, or the options expire, with its estimated profit or loss per
-- contract along the way and when it closes. Left swipes aren't followed (status null).
alter table public.swipes
  add column if not exists status text check (status in ('open','win','loss')),
  add column if not exists pnl numeric,
  add column if not exists close_reason text check (close_reason in ('take_profit','stop','expiry')),
  add column if not exists closed_at timestamptz,
  add column if not exists checked_at timestamptz;
update public.swipes set status = 'open' where action = 'right' and status is null;
create index if not exists swipes_open_idx on public.swipes (status) where status = 'open';
