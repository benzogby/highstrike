-- Each stock's latest real-time trade, written about once a second by the always-on worker (worker/) from Alpaca's
-- free IEX trade stream, so the desk's price moves within a second or two without asking Alpaca per member
-- (src/app/api/live/route.ts reads it). Server only, like public.live_bars.
create table if not exists public.live_quotes (
  ticker text primary key,
  price numeric not null,
  at timestamptz not null          -- the trade's own time
);
alter table public.live_quotes enable row level security;
revoke all on public.live_quotes from anon, authenticated;
