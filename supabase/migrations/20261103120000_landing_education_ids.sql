-- The homepage shows each Trading School module's key image (public/education/modules/<id>.jpg, src/lib/moduleArt.ts),
-- so get_landing_education also returns the module's id. Still titles and counts only, never a lesson.
drop function if exists public.get_landing_education();

create function public.get_landing_education()
returns table (module_position int, title text, lessons int, module_id text)
language sql
stable
security definer
set search_path = public
as $$
  select m.position, m.title, (select count(*)::int from public.course_lessons l where l.module_id = m.id), m.id::text
  from public.course_modules m
  order by m.position;
$$;

revoke all on function public.get_landing_education() from public;
grant execute on function public.get_landing_education() to anon, authenticated;
