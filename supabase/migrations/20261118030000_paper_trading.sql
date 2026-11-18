-- Paper trading (Ben, 2026-11-18: "turning [Home] into a paper trading engine"; docs/plans/offer-overhaul.md item 8):
-- each member's practice account, starting at $25,000, its orders and its open positions. Stocks and options (an option
-- position is 100 shares a contract). Members read their own rows; every write goes through the server
-- (src/lib/paper.ts), which prices the fills, so nobody can write a fill of their own.

create table if not exists public.paper_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  cash numeric not null default 25000,
  start_balance numeric not null default 25000,
  realized numeric not null default 0,
  resets int not null default 0,
  created_at timestamptz not null default now(),
  reset_at timestamptz not null default now()
);

create table if not exists public.paper_positions (
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,              -- AAPL, or an option contract like O:AAPL261218C00350000
  kind text not null check (kind in ('stock', 'option')),
  underlying text not null,
  qty numeric not null,              -- shares or contracts; negative is short
  avg_price numeric not null,        -- per share (an option's price per share; a contract is 100)
  opened_at timestamptz not null default now(),
  option_type text check (option_type in ('call', 'put')),
  strike numeric,
  expiry date,
  primary key (user_id, symbol)
);

create table if not exists public.paper_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  kind text not null check (kind in ('stock', 'option')),
  underlying text not null,
  side text not null check (side in ('buy', 'sell')),
  qty numeric not null check (qty > 0),
  order_type text not null check (order_type in ('market', 'limit')),
  limit_price numeric,
  status text not null default 'working' check (status in ('working', 'filled', 'cancelled', 'rejected', 'expired')),
  fill_price numeric,
  price_source text,                 -- 'live', 'est', 'quote', 'expiry'
  filled_at timestamptz,
  note text,
  option_type text check (option_type in ('call', 'put')),
  strike numeric,
  expiry date,
  created_at timestamptz not null default now()
);
create index if not exists paper_orders_user_idx on public.paper_orders (user_id, created_at desc);
create index if not exists paper_orders_working_idx on public.paper_orders (status) where status = 'working';

alter table public.paper_accounts enable row level security;
alter table public.paper_positions enable row level security;
alter table public.paper_orders enable row level security;

drop policy if exists "own paper account" on public.paper_accounts;
create policy "own paper account" on public.paper_accounts for select using (user_id = auth.uid());
drop policy if exists "own paper positions" on public.paper_positions;
create policy "own paper positions" on public.paper_positions for select using (user_id = auth.uid());
drop policy if exists "own paper orders" on public.paper_orders;
create policy "own paper orders" on public.paper_orders for select using (user_id = auth.uid());

revoke insert, update, delete on public.paper_accounts, public.paper_positions, public.paper_orders from anon, authenticated;
