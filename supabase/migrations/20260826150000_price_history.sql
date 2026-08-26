-- Own price history: the daily cron snapshots real closes per symbol, so
-- charts have a first-party data source that compounds daily and never
-- depends on a third-party wall. Members read; service role writes.

create table if not exists public.price_history (
  ticker text not null references public.symbols(ticker),
  price_date date not null,
  close numeric not null,
  primary key (ticker, price_date)
);

create index if not exists price_history_ticker_idx
  on public.price_history (ticker, price_date desc);

alter table public.price_history enable row level security;

drop policy if exists "members read price history" on public.price_history;
create policy "members read price history"
  on public.price_history for select to authenticated using (true);
