-- The swipe screen (step 2 of the swipe app, Ben 2026-11-02: swipe right "Save to my ideas"): every swipe a member
-- makes, right (saved) or left (passed), with the card as it was, since cards are rebuilt on each refresh. Saved cards
-- are the member's ideas in the app; all swipes feed the crowd's verdict and taste learning later (step 4). Members read
-- their own; the server writes.
create table if not exists public.swipes (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid,
  ticker text not null,
  structure text not null,
  action text not null check (action in ('right','left')),
  card jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, card_id)
);
create index if not exists swipes_user_idx on public.swipes (user_id, created_at desc);
create index if not exists swipes_card_idx on public.swipes (card_id);
alter table public.swipes enable row level security;
drop policy if exists "members read own swipes" on public.swipes;
create policy "members read own swipes" on public.swipes for select to authenticated using (user_id = (select auth.uid()));
