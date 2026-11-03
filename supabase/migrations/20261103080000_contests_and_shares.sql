-- Weekly contests and shareable cards (step 5 of the swipe app, Ben 2026-11-02: "Leaderboard contests, Shareable
-- cards"). Each saved setup gets an unguessable share code for its public page and image (the row ids count up, so they
-- aren't used). Each week's contest (Monday to Sunday, New York) is frozen once it ends: the standings as they stood.
alter table public.swipes add column if not exists share_token uuid not null default gen_random_uuid();
create unique index if not exists swipes_share_token_idx on public.swipes (share_token);

create table if not exists public.contest_weeks (
  week_start date primary key,
  standings jsonb not null,
  frozen_at timestamptz not null default now()
);
alter table public.contest_weeks enable row level security;
drop policy if exists "members read contests" on public.contest_weeks;
create policy "members read contests" on public.contest_weeks for select to authenticated using (true);
