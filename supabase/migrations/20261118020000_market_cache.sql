-- Answers from the market-data feed kept for a while (src/lib/optionQuotes.ts): listed option contracts, a contract's
-- price. Massive's free plan allows 5 calls a minute, so every member reads one shared copy. Server only.
create table if not exists public.market_cache (
  key text primary key,
  body jsonb not null,
  fetched_at timestamptz not null default now()
);
alter table public.market_cache enable row level security;
revoke all on public.market_cache from anon, authenticated;
