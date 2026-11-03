-- Trade ideas (Ben, 2026-11-02: "Need to make this all about TRADE IDEAS"): every setup is an idea in one feed, from
-- one of several sources. The AI's daily picks are the first ('ai'); options flow, catalysts, watchlist scans, pasted
-- ideas, the idea builder, members and pro traders follow. Each idea has a style (day / swing / long) and a one-line
-- headline for the feed. One idea per ticker per day per source.

alter table public.setups
  add column if not exists source text not null default 'ai'
    check (source in ('ai','flow','catalyst','watchlist','pasted','builder','member','pro')),
  add column if not exists style text not null default 'swing'
    check (style in ('day','swing','long')),
  add column if not exists headline text;

alter table public.setups drop constraint if exists setups_report_date_ticker_key;
create unique index if not exists setups_day_ticker_source on public.setups (report_date, ticker, source);
create index if not exists setups_source_idx on public.setups (source, report_date desc);
