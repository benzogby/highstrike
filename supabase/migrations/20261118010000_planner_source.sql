-- Trade Planner plans are a member's own ideas too (src/app/(app)/plan/actions.ts), source 'planner'.
alter table public.setups drop constraint if exists setups_source_check;
alter table public.setups add constraint setups_source_check
  check (source in ('ai', 'flow', 'catalyst', 'watchlist', 'pasted', 'builder', 'member', 'pro', 'planner'));
