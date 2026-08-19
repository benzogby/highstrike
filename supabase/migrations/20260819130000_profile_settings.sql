-- Account settings: profile fields users can edit about themselves, a plan
-- column, and an avatars bucket.
--
-- Users may UPDATE their own profile row, but only via column-level grants
-- (name, bio, avatar_url, plan) — is_admin and email are NOT granted, so a
-- crafted PostgREST request cannot self-promote.

alter table public.profiles add column if not exists name text;
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists plan text not null default 'free';

drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile"
  on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

revoke update on public.profiles from authenticated, anon;
grant update (name, bio, avatar_url, plan) on public.profiles to authenticated;

-- Avatars: public read, each user manages files under their own uid/ prefix.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "public read avatars" on storage.objects;
create policy "public read avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "users insert own avatars" on storage.objects;
create policy "users insert own avatars"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users update own avatars" on storage.objects;
create policy "users update own avatars"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users delete own avatars" on storage.objects;
create policy "users delete own avatars"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
