-- Strategies, live (docs/plans/strategies.md): which stocks a strategy watches, whether it's on, whether it alerts and
-- whether it paper-trades by itself; and every time one fired. src/lib/strategies/live.ts checks them in market hours
-- (api/cron/check-alerts) and is the only writer of strategy_signals.
alter table public.strategies
  add column if not exists watch text[] not null default '{}',
  add column if not exists live boolean not null default false,
  add column if not exists alerts boolean not null default true,
  add column if not exists auto_trade boolean not null default false;

create table if not exists public.strategy_signals (
  id uuid primary key default gen_random_uuid(),
  strategy_id uuid not null references public.strategies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  ticker text not null,
  day date not null,                 -- New York trading day it fired
  fired_at timestamptz not null default now(),
  price numeric not null,            -- the stock's price when it fired
  symbol text,                       -- what it paper-traded (a contract or the ticker), when it did
  qty numeric,
  status text not null default 'alerted' check (status in ('alerted', 'open', 'closed', 'failed')),
  note text,
  exit_reason text,
  exit_price numeric,
  closed_at timestamptz,
  unique (strategy_id, ticker, day)
);
create index if not exists strategy_signals_user_idx on public.strategy_signals (user_id, fired_at desc);
create index if not exists strategy_signals_open_idx on public.strategy_signals (status) where status = 'open';
alter table public.strategy_signals enable row level security;
drop policy if exists "own strategy signals" on public.strategy_signals;
create policy "own strategy signals" on public.strategy_signals for select to authenticated using (user_id = (select auth.uid()));
grant select on public.strategy_signals to authenticated;
