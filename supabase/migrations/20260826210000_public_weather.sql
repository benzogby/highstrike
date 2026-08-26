-- Marketing refresh: the homepage shows the real daily weather report as a
-- live product proof. Aggregates only — setup cards stay member-only.

drop policy if exists "public reads weather" on public.weather_reports;
create policy "public reads weather"
  on public.weather_reports for select to anon using (true);
