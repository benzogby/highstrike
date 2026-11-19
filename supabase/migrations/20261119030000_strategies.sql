-- A member's strategies (docs/plans/strategies.md): entry and exit rules built from blocks, the option they trade and
-- the ticker they were last tested on. The rules are checked by src/lib/strategies/rules.ts before they're saved.
create table if not exists public.strategies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  rules jsonb not null,
  ticker text not null default 'SPY',
  template text,                     -- the template it was copied from, if any
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists strategies_user_idx on public.strategies (user_id, updated_at desc);
alter table public.strategies enable row level security;
drop policy if exists "own strategies" on public.strategies;
create policy "own strategies"
  on public.strategies for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and (select public.is_member()));
grant select, insert, update, delete on public.strategies to authenticated;
