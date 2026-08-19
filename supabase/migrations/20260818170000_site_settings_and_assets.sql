-- App-wide settings (brand assets etc.) + a public storage bucket for them.
-- Anyone can read settings/assets (the site renders them); only admins write.

create table if not exists public.site_settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);

alter table public.site_settings enable row level security;

drop policy if exists "anyone reads settings" on public.site_settings;
create policy "anyone reads settings"
  on public.site_settings for select to anon, authenticated using (true);

drop policy if exists "admins insert settings" on public.site_settings;
create policy "admins insert settings"
  on public.site_settings for insert to authenticated
  with check (public.is_admin());

drop policy if exists "admins update settings" on public.site_settings;
create policy "admins update settings"
  on public.site_settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins delete settings" on public.site_settings;
create policy "admins delete settings"
  on public.site_settings for delete to authenticated
  using (public.is_admin());

-- Public bucket for logos/photos.
insert into storage.buckets (id, name, public)
values ('site-assets', 'site-assets', true)
on conflict (id) do nothing;

drop policy if exists "public read site assets" on storage.objects;
create policy "public read site assets"
  on storage.objects for select
  using (bucket_id = 'site-assets');

drop policy if exists "admins insert site assets" on storage.objects;
create policy "admins insert site assets"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'site-assets' and public.is_admin());

drop policy if exists "admins update site assets" on storage.objects;
create policy "admins update site assets"
  on storage.objects for update to authenticated
  using (bucket_id = 'site-assets' and public.is_admin());

drop policy if exists "admins delete site assets" on storage.objects;
create policy "admins delete site assets"
  on storage.objects for delete to authenticated
  using (bucket_id = 'site-assets' and public.is_admin());
