-- AI Setup Engine (terminal loop iteration 2): daily weather reports and
-- setup cards. Members read; only the server (service role) writes.

create table if not exists public.weather_reports (
  report_date date primary key,
  volatility int not null check (volatility between 0 and 100),
  opportunity int not null check (opportunity between 0 and 100),
  direction int not null check (direction between 0 and 100),
  summary text not null default '',
  model text not null default 'heuristic',
  created_at timestamptz not null default now()
);

alter table public.weather_reports enable row level security;

drop policy if exists "members read weather" on public.weather_reports;
create policy "members read weather"
  on public.weather_reports for select to authenticated using (true);

create table if not exists public.setups (
  id uuid primary key default gen_random_uuid(),
  report_date date not null,
  ticker text not null references public.symbols(ticker),
  direction text not null check (direction in ('long','short')),
  justification text not null,
  entry_criteria text[] not null default '{}',
  price_target text not null,
  time_frame text not null,
  flow_score int not null check (flow_score between 0 and 100),
  model text not null default 'heuristic',
  created_at timestamptz not null default now(),
  unique (report_date, ticker)
);

create index if not exists setups_date_idx on public.setups (report_date desc);

alter table public.setups enable row level security;

drop policy if exists "members read setups" on public.setups;
create policy "members read setups"
  on public.setups for select to authenticated using (true);
