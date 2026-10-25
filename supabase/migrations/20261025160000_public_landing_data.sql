-- Public, read-only data for the landing page. setups and price_history are
-- members-only (RLS), so these SECURITY DEFINER functions hand anonymous
-- visitors exactly what the homepage shows and nothing more, like
-- get_setup_stats() does for the scoreboard tiles.

-- Today's slate as a teaser: which names and which way, never the entry,
-- target or reasoning (those stay behind the trial).
create or replace function public.get_landing_setups_today()
returns table (
  report_date date,
  ticker text,
  direction text,
  flow_score int
)
language sql stable security definer
set search_path = public
as $$
  select s.report_date, s.ticker, s.direction, s.flow_score
  from public.setups s
  where s.report_date = (select max(report_date) from public.setups)
  order by s.flow_score desc nulls last, s.created_at
$$;

-- The most recently closed setups, wins and losses alike, in full.
create or replace function public.get_recent_closed_setups(limit_n int default 6)
returns table (
  report_date date,
  ticker text,
  direction text,
  entry_price numeric,
  target_price numeric,
  time_frame text,
  entry_criteria text[],
  status text,
  result_pct numeric,
  closed_at timestamptz
)
language sql stable security definer
set search_path = public
as $$
  select s.report_date, s.ticker, s.direction, s.entry_price, s.target_price,
         s.time_frame, s.entry_criteria, s.status, s.result_pct, s.closed_at
  from public.setups s
  where s.status <> 'open'
  order by s.closed_at desc nulls last, s.report_date desc
  limit least(greatest(limit_n, 1), 20)
$$;

-- One close per market day for a symbol on the landing page's chart.
create or replace function public.get_landing_closes(sym text default 'SPY', days int default 60)
returns table (price_date date, close numeric)
language sql stable security definer
set search_path = public
as $$
  select price_date, close from (
    select distinct on (p.price_date) p.price_date, p.close
    from public.price_history p
    where p.ticker = upper(sym)
      and extract(isodow from p.price_date) < 6
    order by p.price_date desc
    limit least(greatest(days, 2), 120)
  ) d
  order by price_date
$$;

grant execute on function public.get_landing_setups_today() to anon, authenticated;
grant execute on function public.get_recent_closed_setups(int) to anon, authenticated;
grant execute on function public.get_landing_closes(text, int) to anon, authenticated;
