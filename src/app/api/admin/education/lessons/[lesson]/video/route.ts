import { LESSONS_BUCKET, lessonVideo } from "@/lib/education";
import { isLessonVersion } from "@/lib/hls";
import { adminContext, fail, lessonParam, newVersion, ok, readUploadedVideo, removeVersionFiles, videoFileType } from "@/lib/educationAdmin";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ lesson: string }> };

/** Most files one signing call covers: a few minutes of segments at a time. */
const MAX_SIGN = 200;

/**
 * POST { action }: a lesson's new video, made in the admin's browser (src/app/(app)/admin/education/videoPipeline.ts).
 *  - "start": a fresh version folder for it.
 *  - "sign" { version, paths }: one signed upload link per file (playlists, segments, the poster), inside that folder.
 *  - "publish" { version }: read the uploaded playlists back, check them, point the lesson at the new folder, set its
 *    length, and clear out the version it replaced. Members load the new folder's playlists from then on, so nobody's
 *    player or cache ever mixes the two.
 *  - "discard" { version }: a cancelled or failed upload's files, gone (never the published version's).
 */
export async function POST(request: Request, ctx: Ctx) {
  const id = lessonParam((await ctx.params).lesson);
  if (!id) return fail("There's no such lesson.", 404);
  const { supabase, error } = await adminContext();
  if (error) return error;
  const input = (await request.json().catch(() => null)) as { action?: unknown; version?: unknown; paths?: unknown } | null;
  const { data: row } = await supabase.from("course_lessons").select("id").eq("id", id).maybeSingle();
  if (!row) return fail("There's no such lesson.", 404);

  if (input?.action === "start") return ok({ version: newVersion() });

  const version = input?.version;
  if (!isLessonVersion(version)) return fail("That upload isn't one of ours.");
  const current = await lessonVideo(supabase, id);

  if (input?.action === "sign") {
    const paths = Array.isArray(input.paths) ? input.paths : [];
    if (!paths.length || paths.length > MAX_SIGN) return fail("Nothing to sign.");
    if (current?.version === version) return fail("That version is already published.");
    const bucket = supabase.storage.from(LESSONS_BUCKET);
    const out: { path: string; token: string; contentType: string }[] = [];
    for (const rel of paths) {
      const contentType = typeof rel === "string" ? videoFileType(rel) : null;
      if (!contentType) return fail("One of the video's files has a name storage won't take.");
      const key = `${id}/${version}/${rel}`;
      const { data, error: e } = await bucket.createSignedUploadUrl(key, { upsert: true });
      if (e || !data) return fail("Storage wouldn't take the upload just now. Try again.", 502);
      out.push({ path: key, token: data.token, contentType });
    }
    return ok({ uploads: out });
  }

  if (input?.action === "publish") {
    const video = await readUploadedVideo(supabase, id, version);
    if (!video) return fail("The uploaded video isn't complete. Try the upload again.", 422);
    const { error: e } = await supabase.from("lesson_videos").upsert({
      lesson_id: id,
      version,
      duration_sec: video.durationSec,
      width: video.width,
      height: video.height,
      renditions: video.renditions,
      poster: video.poster,
      published_at: new Date().toISOString(),
    });
    if (e) return fail("The video couldn't be published.", 500);
    await supabase.from("course_lessons").update({ duration_sec: video.durationSec, youtube_id: null }).eq("id", id);
    if (current && current.version !== version) await removeVersionFiles(supabase, id, current.version);
    return ok({ durationSec: video.durationSec });
  }

  if (input?.action === "discard") {
    if (current?.version === version) return fail("That version is the one members watch.");
    await removeVersionFiles(supabase, id, version);
    return ok();
  }

  return fail("Unknown action.");
}

/** DELETE: take the lesson's video down and remove its files. The lesson keeps its notes, files and any YouTube id. */
export async function DELETE(_request: Request, ctx: Ctx) {
  const id = lessonParam((await ctx.params).lesson);
  if (!id) return fail("There's no such lesson.", 404);
  const { supabase, error } = await adminContext();
  if (error) return error;
  const current = await lessonVideo(supabase, id);
  if (!current) return ok();
  const { error: e } = await supabase.from("lesson_videos").delete().eq("lesson_id", id);
  if (e) return fail("The video couldn't be removed.", 500);
  // Without a video the length is unknown, and a length with no video would read as "still processing".
  await supabase.from("course_lessons").update({ duration_sec: null }).eq("id", id);
  await removeVersionFiles(supabase, id, current.version);
  return ok();
}
