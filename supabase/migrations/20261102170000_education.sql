-- Education: the Highstrike Alpha Mastermind library for paid members (Ben, 2026-11-02: "do all the lessons from
-- HighStrike Alpha Mastermind module, split into the sub modules"), laid out like Ripping University (getripping.com
-- → Education): one module per Mastermind chapter, each a list of lessons. The content lives in these tables, never in
-- the repository, which is public. Videos Whop hosted are HLS in the private `lessons` bucket under
-- <lesson_id>/<version>/ with one lesson_videos row each; lessons whose video is on YouTube keep it as a YouTube embed.
-- Everything here is readable only by an account on a paid plan, or an admin (public.has_education()).

create or replace function public.has_education()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and (coalesce(p.plan, 'free') <> 'free' or p.is_admin)
  );
$$;

revoke all on function public.has_education() from public;
grant execute on function public.has_education() to authenticated;

create table if not exists public.course_modules (
  id text primary key,            -- the Whop chapter id it came from (chap_…)
  position int not null,          -- its place in the library
  title text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.course_lessons (
  id text primary key,            -- the Whop lesson id it came from (lesn_…)
  module_id text not null references public.course_modules (id) on delete cascade,
  position int not null,          -- its place in the module
  title text not null,
  body jsonb,                     -- the lesson's notes, as the editor's JSON document
  youtube_id text,                -- when its video is on YouTube
  duration_sec numeric,           -- the video's length, when known
  created_at timestamptz not null default now()
);

create index if not exists course_lessons_module_idx on public.course_lessons (module_id, position);

create table if not exists public.lesson_videos (
  lesson_id text primary key references public.course_lessons (id) on delete cascade,
  version text not null,          -- the folder the HLS files sit in: lessons/<lesson_id>/<version>/
  duration_sec numeric not null,
  width int,
  height int,
  renditions jsonb not null default '[]'::jsonb,  -- [{ name, playlist, bandwidth, resolution }]
  poster text,                    -- relative to the version folder ("poster.jpg")
  published_at timestamptz not null default now()
);

create table if not exists public.lesson_files (
  lesson_id text not null references public.course_lessons (id) on delete cascade,
  path text not null,             -- in the lessons bucket
  filename text not null,
  content_type text,
  bytes bigint,
  primary key (lesson_id, path)
);

create table if not exists public.lesson_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  lesson_id text not null references public.course_lessons (id) on delete cascade,
  position_sec numeric not null default 0,  -- where the player was last
  completed_at timestamptz,                 -- watched to 90%, or marked done
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

alter table public.course_modules enable row level security;
alter table public.course_lessons enable row level security;
alter table public.lesson_videos enable row level security;
alter table public.lesson_files enable row level security;
alter table public.lesson_progress enable row level security;

drop policy if exists "members read modules" on public.course_modules;
create policy "members read modules" on public.course_modules for select to authenticated using (public.has_education());

drop policy if exists "members read lessons" on public.course_lessons;
create policy "members read lessons" on public.course_lessons for select to authenticated using (public.has_education());

drop policy if exists "members read videos" on public.lesson_videos;
create policy "members read videos" on public.lesson_videos for select to authenticated using (public.has_education());

drop policy if exists "members read files" on public.lesson_files;
create policy "members read files" on public.lesson_files for select to authenticated using (public.has_education());

drop policy if exists "members read own progress" on public.lesson_progress;
create policy "members read own progress" on public.lesson_progress for select to authenticated using (user_id = auth.uid());

drop policy if exists "members write own progress" on public.lesson_progress;
create policy "members write own progress" on public.lesson_progress for insert to authenticated with check (user_id = auth.uid() and public.has_education());

drop policy if exists "members update own progress" on public.lesson_progress;
create policy "members update own progress" on public.lesson_progress for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and public.has_education());

-- The private bucket: only paid members (through signed links the app makes for them) and admins read it.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lessons', 'lessons', false, 52428800, array['application/vnd.apple.mpegurl', 'video/mp2t', 'image/jpeg', 'image/png', 'application/pdf', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "members read lesson files" on storage.objects;
create policy "members read lesson files" on storage.objects for select to authenticated using (bucket_id = 'lessons' and public.has_education());
