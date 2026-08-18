-- Profiles mirror of auth.users with an admin flag.
-- Admin checks go through a security-definer function so RLS policies can
-- reference the flag without recursive-policy issues, and flag changes take
-- effect immediately (no JWT refresh needed).

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  )
$$;

drop policy if exists "own profile or admin reads all" on public.profiles;
create policy "own profile or admin reads all"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());

-- Auto-provision a profile row for every new auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, created_at)
  values (new.id, new.email, new.created_at)
  on conflict (id) do nothing;
  return new;
end
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill existing users.
insert into public.profiles (id, email, created_at)
select id, email, created_at from auth.users
on conflict (id) do nothing;

-- Admins may read the waitlist (anon insert-only policy stays as is).
drop policy if exists "admins read waitlist" on public.waitlist_signups;
create policy "admins read waitlist"
  on public.waitlist_signups for select to authenticated
  using (public.is_admin());

-- Founding admin.
update public.profiles set is_admin = true where email = 'ben.zogby@gmail.com';
