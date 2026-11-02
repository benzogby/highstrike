-- Admins may read the two admin logs (20261102233000_admin_logs.sql) under RLS, as lifetime_purchases does; only the
-- service role writes them. email_log holds customers' addresses, so nobody else reads it.
drop policy if exists "admins read email log" on public.email_log;
create policy "admins read email log" on public.email_log for select to authenticated using ((select public.is_admin()));

drop policy if exists "admins read error reports" on public.error_reports;
create policy "admins read error reports" on public.error_reports for select to authenticated using ((select public.is_admin()));
