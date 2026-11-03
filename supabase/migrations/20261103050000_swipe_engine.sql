-- The swipe app's options engine (step 1, Ben 2026-11-02): its own list of stocks with their latest quote and estimated
-- volatility, the daily closes it keeps for them (outside public.symbols, so the scanner's universe is untouched), and
-- the option setup cards it builds. Free for now (Ben: "Make it all free for now while we build"), so active cards and
-- the stock data are readable by anyone; only the server (service role) writes.

create table if not exists public.option_underlyings (
  ticker text primary key,
  tier smallint not null default 3 check (tier between 1 and 3),
  spot numeric,
  change_pct numeric,
  high numeric,
  low numeric,
  prev_close numeric,
  vol numeric,
  quoted_at timestamptz
);

create table if not exists public.underlying_closes (
  ticker text not null references public.option_underlyings(ticker) on delete cascade,
  day date not null,
  close numeric not null,
  primary key (ticker, day)
);

create table if not exists public.swipe_cards (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  ticker text not null references public.option_underlyings(ticker) on delete cascade,
  structure text not null check (structure in ('long_call','long_put','bull_call_spread','bear_put_spread','bull_put_spread','bear_call_spread','iron_condor')),
  bias text not null check (bias in ('bull','bear','neutral')),
  expiry date not null,
  dte int not null,
  spot numeric not null,
  vol numeric not null,
  legs jsonb not null,
  net numeric not null,
  max_profit numeric,
  max_loss numeric not null,
  reward_risk numeric,
  breakevens numeric[] not null default '{}',
  pop numeric not null,
  take_profit numeric[] not null default '{}',
  stop_loss numeric[] not null default '{}',
  why text not null,
  tier smallint not null default 3,
  estimated boolean not null default true,
  active boolean not null default true
);
create index if not exists swipe_cards_active_idx on public.swipe_cards (active, tier, created_at desc);
create index if not exists swipe_cards_ticker_idx on public.swipe_cards (ticker, active);

alter table public.option_underlyings enable row level security;
alter table public.underlying_closes enable row level security;
alter table public.swipe_cards enable row level security;

drop policy if exists "anyone reads underlyings" on public.option_underlyings;
create policy "anyone reads underlyings" on public.option_underlyings for select to anon, authenticated using (true);
drop policy if exists "anyone reads underlying closes" on public.underlying_closes;
create policy "anyone reads underlying closes" on public.underlying_closes for select to anon, authenticated using (true);
drop policy if exists "anyone reads active cards" on public.swipe_cards;
create policy "anyone reads active cards" on public.swipe_cards for select to anon, authenticated using (active);
