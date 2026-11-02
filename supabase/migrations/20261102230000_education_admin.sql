-- Admin → Education (Ben, 2026-11-02: "Give me an education tab in admin panel to edit each lesson, including video
-- uploads, and supporting text"). Admins write the library; everyone else keeps reading it as before (members only,
-- 20261102170000_education.sql). The app makes every write from its own server routes (src/app/api/admin/education),
-- through the admin's own session, so these rules and the routes' is_admin check both have to agree.
--
-- New lesson videos are made in the admin's browser as the same HLS the import made, and uploaded straight to the
-- bucket through signed upload links the server hands out (one per file, each well under the bucket's 50 MB), then
-- published by flipping the lesson's lesson_videos row to the new version folder.

drop policy if exists "admins write modules" on public.course_modules;
create policy "admins write modules" on public.course_modules for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "admins add lessons" on public.course_lessons;
create policy "admins add lessons" on public.course_lessons for insert to authenticated with check ((select public.is_admin()));
drop policy if exists "admins edit lessons" on public.course_lessons;
create policy "admins edit lessons" on public.course_lessons for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "admins remove lessons" on public.course_lessons;
create policy "admins remove lessons" on public.course_lessons for delete to authenticated using ((select public.is_admin()));

drop policy if exists "admins add videos" on public.lesson_videos;
create policy "admins add videos" on public.lesson_videos for insert to authenticated with check ((select public.is_admin()));
drop policy if exists "admins edit videos" on public.lesson_videos;
create policy "admins edit videos" on public.lesson_videos for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "admins remove videos" on public.lesson_videos;
create policy "admins remove videos" on public.lesson_videos for delete to authenticated using ((select public.is_admin()));

drop policy if exists "admins add files" on public.lesson_files;
create policy "admins add files" on public.lesson_files for insert to authenticated with check ((select public.is_admin()));
drop policy if exists "admins remove files" on public.lesson_files;
create policy "admins remove files" on public.lesson_files for delete to authenticated using ((select public.is_admin()));

drop policy if exists "admins upload lesson files" on storage.objects;
create policy "admins upload lesson files" on storage.objects for insert to authenticated
  with check (bucket_id = 'lessons' and (select public.is_admin()));
drop policy if exists "admins replace lesson files" on storage.objects;
create policy "admins replace lesson files" on storage.objects for update to authenticated
  using (bucket_id = 'lessons' and (select public.is_admin())) with check (bucket_id = 'lessons' and (select public.is_admin()));
drop policy if exists "admins delete lesson files" on storage.objects;
create policy "admins delete lesson files" on storage.objects for delete to authenticated
  using (bucket_id = 'lessons' and (select public.is_admin()));

-- Attachments an admin may add beside the video: documents, sheets, slides, text, images and zips.
update storage.buckets set allowed_mime_types = array[
  'application/vnd.apple.mpegurl', 'video/mp2t', 'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf', 'text/plain', 'text/csv', 'application/zip',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation'
] where id = 'lessons';
