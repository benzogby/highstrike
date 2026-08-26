-- Insider Feed v1 (terminal loop iteration 8): Form 4 open-market buys and
-- sales ingested daily from SEC EDGAR (free public data). One row per filing
-- per transaction code (P = purchase, S = sale), amounts aggregated within
-- the filing. Members read; only the server writes. No sample data ever —
-- this table holds real filings or nothing.

alter table public.symbols add column if not exists cik text;

create table if not exists public.insider_trades (
  accession text not null,
  transaction_code text not null check (transaction_code in ('P','S')),
  ticker text not null references public.symbols(ticker),
  filed_at date not null,
  transaction_date date,
  owner_name text not null,
  owner_title text,
  shares numeric,
  price numeric,
  value numeric,
  created_at timestamptz not null default now(),
  primary key (accession, transaction_code)
);

create index if not exists insider_trades_ticker_idx
  on public.insider_trades (ticker, filed_at desc);
create index if not exists insider_trades_filed_idx
  on public.insider_trades (filed_at desc);

alter table public.insider_trades enable row level security;

drop policy if exists "members read insider trades" on public.insider_trades;
create policy "members read insider trades"
  on public.insider_trades for select to authenticated using (true);
