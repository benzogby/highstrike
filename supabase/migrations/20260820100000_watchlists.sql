-- Real member watchlists (iteration 1 of the terminal loop).
-- Owner-only CRUD via RLS; symbols validated against public.symbols.

create table if not exists public.watchlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'My Watchlist',
  created_at timestamptz not null default now()
);

create index if not exists watchlists_user_idx on public.watchlists (user_id);

alter table public.watchlists enable row level security;

drop policy if exists "own watchlists" on public.watchlists;
create policy "own watchlists"
  on public.watchlists for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.watchlist_items (
  watchlist_id uuid not null references public.watchlists(id) on delete cascade,
  ticker text not null references public.symbols(ticker),
  position int not null default 0,
  added_at timestamptz not null default now(),
  primary key (watchlist_id, ticker)
);

alter table public.watchlist_items enable row level security;

drop policy if exists "own watchlist items" on public.watchlist_items;
create policy "own watchlist items"
  on public.watchlist_items for all to authenticated
  using (exists (select 1 from public.watchlists w
                 where w.id = watchlist_id and w.user_id = auth.uid()))
  with check (exists (select 1 from public.watchlists w
                      where w.id = watchlist_id and w.user_id = auth.uid()));
