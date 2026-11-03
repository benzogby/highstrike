-- Pasted ideas (piece 3 of the trade-ideas plan, Ben 2026-11-02; no AI, "Do this all without AI APIs"): a member pastes
-- an alert from anywhere and it becomes an idea of their own. Such ideas carry an owner and are private to them; the
-- house's ideas (owner_id null) stay shared. An idea can carry its own stop (the pasted one) and the option contract
-- it named. The public homepage's functions read only the house's ideas (house_setups), never a member's.

alter table public.setups
  add column if not exists owner_id uuid references auth.users(id) on delete cascade,
  add column if not exists stop_price numeric,
  add column if not exists contract text;

drop index if exists public.setups_day_ticker_source;
create unique index if not exists setups_day_ticker_source on public.setups (report_date, ticker, source) where owner_id is null;
create index if not exists setups_owner_idx on public.setups (owner_id, report_date desc) where owner_id is not null;

alter policy "members read setups" on public.setups
  using ((select public.is_member()) and (owner_id is null or owner_id = (select auth.uid())));

-- The house's ideas only, for the security-definer functions below. Not readable through the API.
create or replace view public.house_setups with (security_invoker = on) as
  select * from public.setups where owner_id is null;
revoke all on public.house_setups from anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_setup_stats()
 RETURNS TABLE(closed_count integer, open_count integer, win_rate numeric, avg_gain numeric, avg_loss numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    count(*) filter (where status <> 'open')::int,
    count(*) filter (where status = 'open')::int,
    round(100.0 * count(*) filter (where status = 'target_hit')
      / nullif(count(*) filter (where status <> 'open'), 0), 1),
    round(avg(result_pct) filter (where status <> 'open' and result_pct > 0)::numeric, 1),
    round(avg(result_pct) filter (where status <> 'open' and result_pct <= 0)::numeric, 1)
  from public.house_setups
$function$;

CREATE OR REPLACE FUNCTION public.get_landing_weekly_record()
 RETURNS TABLE(week date, closed integer, hits integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select date_trunc('week', s.closed_at)::date as week,
         count(*)::int as closed,
         (count(*) filter (where s.status = 'target_hit'))::int as hits
  from public.house_setups s
  where s.status in ('target_hit', 'stopped', 'expired') and s.closed_at is not null
  group by 1
  order by 1
$function$;

CREATE OR REPLACE FUNCTION public.get_landing_setups_today()
 RETURNS TABLE(report_date date, ticker text, direction text, flow_score integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select s.report_date, s.ticker, s.direction, s.flow_score
  from public.house_setups s
  where s.report_date = (select max(report_date) from public.house_setups)
  order by s.flow_score desc nulls last, s.created_at
$function$;

CREATE OR REPLACE FUNCTION public.get_recent_closed_setups(limit_n integer DEFAULT 6)
 RETURNS TABLE(report_date date, ticker text, direction text, entry_price numeric, target_price numeric, time_frame text, entry_criteria text[], status text, result_pct numeric, closed_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select s.report_date, s.ticker, s.direction, s.entry_price, s.target_price,
         s.time_frame, s.entry_criteria, s.status, s.result_pct, s.closed_at
  from public.house_setups s
  where s.status <> 'open'
  order by s.closed_at desc nulls last, s.report_date desc
  limit least(greatest(limit_n, 1), 20)
$function$;

CREATE OR REPLACE FUNCTION public.get_landing_ticker(sym text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with t as (select upper(trim(sym)) as ticker),
  closes as (
    select p.price_date, p.close
    from public.price_history p, t
    where p.ticker = t.ticker and extract(isodow from p.price_date) < 6
    order by p.price_date desc
    limit 2
  ),
  latest_report as (select max(report_date) as d from public.house_setups),
  today as (
    select s.direction, s.flow_score
    from public.house_setups s, t, latest_report r
    where s.ticker = t.ticker and s.report_date = r.d
    order by s.flow_score desc nulls last
    limit 1
  ),
  graded as (
    select s.report_date, s.direction, s.status, s.result_pct
    from public.house_setups s, t
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
$function$;
