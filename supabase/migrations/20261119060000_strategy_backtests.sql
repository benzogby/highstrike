-- Each member's last backtest per strategy (Ben, 2026-11-19: "Once a backtest is run on a strategy for a user, it
-- should stay available in the backtest tab for that user… not shared between users"). `ref` is the saved strategy's
-- id, or "template:<key>" for a classic opened but not yet saved. Only its owner can see, write or delete it.
create table if not exists public.strategy_backtests (
  user_id uuid not null references auth.users(id) on delete cascade,
  ref text not null,
  ticker text not null,
  period text not null,
  run_key text not null,             -- what it was run on (the strategy, ticker and period), to tell when it's out of date
  news_from text,
  result jsonb not null,
  ran_at timestamptz not null default now(),
  primary key (user_id, ref)
);
alter table public.strategy_backtests enable row level security;
drop policy if exists "own strategy backtests" on public.strategy_backtests;
create policy "own strategy backtests"
  on public.strategy_backtests for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and (select public.is_member()));
grant select, insert, update, delete on public.strategy_backtests to authenticated;
