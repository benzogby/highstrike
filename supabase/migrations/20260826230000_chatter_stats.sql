-- Chatter Engine v1 (terminal loop iteration 14): daily per-ticker crowd
-- metrics derived from StockTwits' public symbol streams — message velocity,
-- labeled bull/bear counts, and watcher totals. Aggregates only; no post
-- content is stored. Members read; service writes. Real data or nothing.

create table if not exists public.chatter_stats (
  ticker text not null references public.symbols(ticker),
  day date not null,
  msgs_per_hour numeric,
  bullish int not null default 0,
  bearish int not null default 0,
  watchers int,
  created_at timestamptz not null default now(),
  primary key (ticker, day)
);

create index if not exists chatter_stats_day_idx on public.chatter_stats (day desc);

alter table public.chatter_stats enable row level security;

drop policy if exists "members read chatter" on public.chatter_stats;
create policy "members read chatter"
  on public.chatter_stats for select to authenticated using (true);
