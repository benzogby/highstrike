-- The trades a member took and their journal (Ben, 2026-11-03: "Yes: track + journal": "I took this" on any idea, then
-- their open trades, results and a simple journal with notes, all private). One row per trade: shares, or option
-- contracts of 100 shares (the contract in `option`, as the idea suggested it). Prices are per share, as a broker shows
-- them. Only its owner reads or changes it; adding one takes the membership.

create table if not exists public.trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  setup_id uuid references public.setups (id) on delete set null,
  ticker text not null check (ticker ~ '^[A-Z][A-Z0-9.\-]{0,9}$'),
  direction text not null check (direction in ('long', 'short')),
  instrument text not null default 'stock' check (instrument in ('stock', 'option')),
  option jsonb,
  entry_price numeric not null check (entry_price > 0),
  quantity numeric not null check (quantity > 0),
  -- The stock's levels to watch (the idea's target and stop, or the member's own).
  target numeric check (target is null or target > 0),
  stop numeric check (stop is null or stop > 0),
  opened_on date not null default ((now() at time zone 'America/New_York')::date),
  status text not null default 'open' check (status in ('open', 'closed')),
  exit_price numeric check (exit_price is null or exit_price >= 0),
  closed_on date,
  notes text check (notes is null or char_length(notes) <= 4000),
  -- 'target' or 'stop' once that alert went out, so each sends once.
  alerted text check (alerted is null or alerted in ('target', 'stop')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trades_user on public.trades (user_id, status, opened_on desc);
create index if not exists trades_open on public.trades (status) where status = 'open';

alter table public.trades enable row level security;

drop policy if exists "read own trades" on public.trades;
create policy "read own trades" on public.trades
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "add own trades" on public.trades;
create policy "add own trades" on public.trades
  for insert to authenticated with check (user_id = (select auth.uid()) and (select public.is_member()));

drop policy if exists "change own trades" on public.trades;
create policy "change own trades" on public.trades
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "delete own trades" on public.trades;
create policy "delete own trades" on public.trades
  for delete to authenticated using (user_id = (select auth.uid()));
