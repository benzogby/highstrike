-- Ideas from strategies (Ben, 2026-11-19, docs/plans/strategies.md: "Ideas come from strategies"): each morning
-- HighStrike's classic strategies run over the most traded names, and the ones that fired with a winning past record
-- become the day's ideas (source 'strategy'), carrying that record (src/lib/strategies/ideas.ts).
alter table public.setups drop constraint if exists setups_source_check;
alter table public.setups add constraint setups_source_check
  check (source in ('ai','flow','catalyst','watchlist','pasted','builder','member','pro','planner','strategy'));
alter table public.setups add column if not exists record jsonb;
