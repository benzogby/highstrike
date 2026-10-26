-- Public, read-only data for the homepage's ticker lookup, its graded-record
-- chart and its movers band. Like 20261025160000_public_landing_data.sql,
-- these SECURITY DEFINER functions hand anonymous visitors only what the page
-- draws: never an open setup's entry, target or reasoning.

-- What the desk has on one ticker: its last move, whether it is on today's
-- slate (direction and flow only), its latest graded setup, its insider
-- filings over 30 days and its latest social chatter. null for an unknown ticker.
create or replace function public.get_landing_ticker(sym text)
returns jsonb
language sql stable security definer
set search_path = public
as $$
  with t as (select upper(trim(sym)) as ticker),
  closes as (
    select p.price_date, p.close
    from public.price_history p, t
    where p.ticker = t.ticker and extract(isodow from p.price_date) < 6
    order by p.price_date desc
    limit 2
  ),
  latest_report as (select max(report_date) as d from public.setups),
  today as (
    select s.direction, s.flow_score
    from public.setups s, t, latest_report r
    where s.ticker = t.ticker and s.report_date = r.d
    order by s.flow_score desc nulls last
    limit 1
  ),
  graded as (
    select s.report_date, s.direction, s.status, s.result_pct
    from public.setups s, t
    where s.ticker = t.ticker and s.status <> 'open'
    order by s.closed_at desc nulls last, s.report_date desc
    limit 1
  ),
  insiders as (
    select count(*) filter (where i.transaction_code = 'S') as sells,
           count(*) filter (where i.transaction_code = 'P') as buys,
           coalesce(sum(i.value) filter (where i.transaction_code = 'S'), 0) as sold,
           coalesce(sum(i.value) filter (where i.transaction_code = 'P'), 0) as bought
    from public.insider_trades i, t
    where i.ticker = t.ticker and i.filed_at > current_date - 30
  ),
  chatter as (
    select c.day, c.msgs_per_hour, c.bullish, c.bearish, c.watchers
    from public.chatter_stats c, t
    where c.ticker = t.ticker
    order by c.day desc
    limit 1
  )
  select case when not exists (select 1 from closes) then null else jsonb_build_object(
    'ticker', (select ticker from t),
    'closes', (select jsonb_agg(jsonb_build_object('date', price_date, 'close', close) order by price_date) from closes),
    'today', (select jsonb_build_object('direction', direction, 'flow', flow_score) from today),
    'graded', (select jsonb_build_object('date', report_date, 'direction', direction, 'status', status, 'result', result_pct) from graded),
    'insiders', (select jsonb_build_object('sells', sells, 'buys', buys, 'sold', sold, 'bought', bought) from insiders),
    'chatter', (select jsonb_build_object('day', day, 'perHour', msgs_per_hour, 'bullish', bullish, 'bearish', bearish, 'watchers', watchers) from chatter)
  ) end
$$;

-- Setups closed per week, and how many hit their target: the record as a series.
create or replace function public.get_landing_weekly_record()
returns table (week date, closed int, hits int)
language sql stable security definer
set search_path = public
as $$
  select date_trunc('week', s.closed_at)::date as week,
         count(*)::int as closed,
         (count(*) filter (where s.status = 'target_hit'))::int as hits
  from public.setups s
  where s.status in ('target_hit', 'stopped', 'expired') and s.closed_at is not null
  group by 1
  order by 1
$$;

-- The last session's move for every tracked ticker, largest first.
create or replace function public.get_landing_movers()
returns table (ticker text, close numeric, change_pct numeric)
language sql stable security definer
set search_path = public
as $$
  with days as (
    select distinct price_date from public.price_history
    where extract(isodow from price_date) < 6
    order by price_date desc
    limit 2
  ),
  last2 as (
    select p.ticker, p.price_date, p.close
    from public.price_history p
    where p.price_date in (select price_date from days)
  )
  select a.ticker, a.close, round(((a.close - b.close) / nullif(b.close, 0) * 100)::numeric, 2)
  from last2 a
  join last2 b on b.ticker = a.ticker and b.price_date < a.price_date
  where a.price_date = (select max(price_date) from days)
  order by abs((a.close - b.close) / nullif(b.close, 0)) desc
$$;

grant execute on function public.get_landing_ticker(text) to anon, authenticated;
grant execute on function public.get_landing_weekly_record() to anon, authenticated;
grant execute on function public.get_landing_movers() to anon, authenticated;
