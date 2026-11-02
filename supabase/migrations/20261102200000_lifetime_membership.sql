-- The $397 lifetime membership (Ben, 2026-11-02: "Nobody gets access until they become a 397 member. Put up a $397
-- lifetime access paywall for new users. One time payment, instant access").
--
-- A member is an account with plan 'lifetime' (set only by the server once Stripe says the payment went through;
-- src/lib/lifetime.ts) or an admin. Every member-only table now checks it, so an account without the membership reads
-- nothing even with its own session; the pages check it too (src/lib/membership.ts). The public homepage keeps reading
-- through its own security-definer functions (20261025160000_public_landing_data.sql) and the public weather report.

create or replace function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and (p.is_admin or p.plan = 'lifetime')
  );
$$;

revoke all on function public.is_member() from public;
grant execute on function public.is_member() to authenticated;

-- Education came with any paid plan; it comes with the membership now, like everything else.
create or replace function public.has_education()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_member();
$$;

-- The member-only tables: members read them, nobody else. `(select …)` runs the check once per query, not per row.
alter policy "members read setups" on public.setups using ((select public.is_member()));
alter policy "members read insider trades" on public.insider_trades using ((select public.is_member()));
alter policy "members read chatter" on public.chatter_stats using ((select public.is_member()));
alter policy "members read price history" on public.price_history using ((select public.is_member()));
alter policy "members read global and own activity" on public.activity_events
  using (((user_id is null) or (user_id = auth.uid())) and (select public.is_member()));

-- What the homepage says about the Alpha Mastermind: each module's title and how many lessons it has. Titles and
-- counts only, never a lesson.
create or replace function public.get_landing_education()
returns table (module_position int, title text, lessons int)
language sql
stable
security definer
set search_path = public
as $$
  select m.position, m.title, (select count(*)::int from public.course_lessons l where l.module_id = m.id)
  from public.course_modules m
  order by m.position;
$$;

revoke all on function public.get_landing_education() from public;
grant execute on function public.get_landing_education() to anon, authenticated;
