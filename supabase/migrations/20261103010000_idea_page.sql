-- The idea page (piece 2 of the trade-ideas plan, Ben 2026-11-02): the AI's bull and bear case, written once per idea
-- and kept on it, and each member's own "Ask the AI" conversation about an idea. The server writes both with the
-- service role; members read their own chat, and the case through the setups policy.

alter table public.setups add column if not exists cases jsonb;

create table if not exists public.idea_chats (
  id bigint generated always as identity primary key,
  setup_id uuid not null references public.setups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists idea_chats_thread_idx on public.idea_chats (user_id, setup_id, id);
create index if not exists idea_chats_day_idx on public.idea_chats (user_id, created_at desc);
alter table public.idea_chats enable row level security;

drop policy if exists "members read own idea chats" on public.idea_chats;
create policy "members read own idea chats" on public.idea_chats for select to authenticated using (user_id = (select auth.uid()));
