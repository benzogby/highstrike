-- The last half hour of minute bars, written by the always-on worker (worker/) from Alpaca's free real-time IEX stream,
-- so charts are complete up to now (Alpaca's free history stops 15 minutes back). Server only: the site reads it
-- through src/lib/candles.ts; the worker writes with the service key and prunes rows older than 40 minutes.
create table if not exists public.live_bars (
  ticker text not null,
  t text not null,                 -- New York wall time of the minute, "2026-11-18T10:37"
  o numeric not null,
  h numeric not null,
  l numeric not null,
  c numeric not null,
  v numeric not null default 0,
  at timestamptz not null,         -- the minute's start, for pruning
  primary key (ticker, t)
);
create index if not exists live_bars_at_idx on public.live_bars (at);
alter table public.live_bars enable row level security;
revoke all on public.live_bars from anon, authenticated;
