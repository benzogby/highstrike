-- HighStrike Chart (Ben, 2026-11-17, docs/plans/offer-overhaul.md): our own candle chart with markup.
--
-- candle_cache: each ticker's daily candles as one JSON array, fetched from the market-data service and kept here so a
-- rate-limited free plan serves every member. Read and written by the server only (service role); no policies.
--
-- chart_drawings: a member's markup on a ticker (levels, lines, zones, notes, arrows, measures, fibs, trade plans),
-- private to them, one row per ticker.
--
-- app_secrets: server-only keys pasted by Ben (e.g. MASSIVE_API_KEY) when they aren't in Vercel's environment.
-- Service role only; no policies.

create table if not exists public.candle_cache (
  ticker text primary key,
  candles jsonb not null default '[]'::jsonb,
  source text not null,
  fetched_at timestamptz not null default now()
);
alter table public.candle_cache enable row level security;

create table if not exists public.chart_drawings (
  user_id uuid not null references auth.users(id) on delete cascade,
  ticker text not null,
  drawings jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, ticker)
);
alter table public.chart_drawings enable row level security;

drop policy if exists "own chart drawings" on public.chart_drawings;
create policy "own chart drawings"
  on public.chart_drawings for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and (select public.is_member()));

create table if not exists public.app_secrets (
  name text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table public.app_secrets enable row level security;
revoke all on public.app_secrets from anon, authenticated;
revoke all on public.candle_cache from anon, authenticated;
