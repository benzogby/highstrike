-- Setup performance tracking (terminal loop iteration 3): every published
-- setup is graded daily against prices. Aggregate stats are exposed publicly
-- via a security-definer function (the scoreboard); row detail stays member-only.

alter table public.setups
  add column if not exists entry_price numeric,
  add column if not exists target_price numeric,
  add column if not exists status text not null default 'open'
    check (status in ('open','target_hit','stopped','expired')),
  add column if not exists current_pct numeric,
  add column if not exists result_pct numeric,
  add column if not exists closed_at timestamptz,
  add column if not exists expires_on date;

create index if not exists setups_status_idx on public.setups (status);

create or replace function public.get_setup_stats()
returns table (
  closed_count int,
  open_count int,
  win_rate numeric,
  avg_gain numeric,
  avg_loss numeric
)
language sql stable security definer
set search_path = public
as $$
  select
    count(*) filter (where status <> 'open')::int,
    count(*) filter (where status = 'open')::int,
    round(100.0 * count(*) filter (where status = 'target_hit')
      / nullif(count(*) filter (where status <> 'open'), 0), 1),
    round(avg(result_pct) filter (where status <> 'open' and result_pct > 0)::numeric, 1),
    round(avg(result_pct) filter (where status <> 'open' and result_pct <= 0)::numeric, 1)
  from public.setups
$$;

grant execute on function public.get_setup_stats() to anon, authenticated;
