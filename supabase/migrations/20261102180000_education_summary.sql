-- What the Education paywall can say to an account without a paid plan: how big the library is, and nothing in it.
create or replace function public.education_summary()
returns table (modules int, lessons int, video_hours numeric)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*)::int from public.course_modules),
    (select count(*)::int from public.course_lessons),
    (select round(coalesce(sum(duration_sec), 0) / 3600.0, 1) from public.course_lessons);
$$;

revoke all on function public.education_summary() from public;
grant execute on function public.education_summary() to authenticated;
