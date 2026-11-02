import { LESSONS_BUCKET, lessonDetail, lessonVideo, posterUrl } from "@/lib/education";
import { adminContext, fail, lessonParam, ok, parseYouTube, removeVersionFiles, renumber } from "@/lib/educationAdmin";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ lesson: string }> };

/** The notes editor's documents are a few KB; anything this big isn't a lesson's notes. */
const MAX_BODY_BYTES = 256 * 1024;

/** GET: everything the editor shows about one lesson (its notes, video, poster and files). */
export async function GET(_request: Request, ctx: Ctx) {
  const id = lessonParam((await ctx.params).lesson);
  if (!id) return fail("There's no such lesson.", 404);
  const { supabase, error } = await adminContext();
  if (error) return error;
  const { data: row } = await supabase.from("course_lessons").select("id, module_id, title, youtube_id, duration_sec").eq("id", id).maybeSingle();
  if (!row) return fail("There's no such lesson.", 404);
  const [detail, video, { data: files }] = await Promise.all([
    lessonDetail(supabase, id),
    lessonVideo(supabase, id),
    supabase.from("lesson_files").select("path, filename, bytes").eq("lesson_id", id),
  ]);
  const links = new Map(detail.files.map((f) => [f.name, f.url]));
  return ok({
    lesson: { id, moduleId: row.module_id, title: row.title, youtubeId: row.youtube_id, durationSec: row.duration_sec == null ? null : Number(row.duration_sec) },
    body: detail.body,
    video: video ? { version: video.version, durationSec: video.durationSec, resolution: video.renditions[0]?.resolution ?? "", poster: await posterUrl(supabase, video) } : null,
    files: ((files ?? []) as { path: string; filename: string; bytes: number | null }[]).map((f) => ({ path: f.path, name: f.filename, bytes: f.bytes ?? 0, url: links.get(f.filename) ?? null })),
  });
}

/** PATCH { title?, body?, youtubeId?, moduleId? }: edit a lesson. A new module puts it at the end of that module. */
export async function PATCH(request: Request, ctx: Ctx) {
  const id = lessonParam((await ctx.params).lesson);
  if (!id) return fail("There's no such lesson.", 404);
  const { supabase, error } = await adminContext();
  if (error) return error;
  const input = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!input) return fail("Nothing to save.");
  const { data: row } = await supabase.from("course_lessons").select("module_id").eq("id", id).maybeSingle();
  if (!row) return fail("There's no such lesson.", 404);

  const update: Record<string, unknown> = {};
  if ("title" in input) {
    const title = typeof input.title === "string" ? input.title.trim().slice(0, 200) : "";
    if (!title) return fail("A lesson needs a title.");
    update.title = title;
  }
  if ("body" in input) {
    const doc = input.body as { type?: unknown; content?: unknown } | null;
    if (doc !== null && (doc?.type !== "doc" || !Array.isArray(doc.content))) return fail("The notes didn't come through right.");
    if (JSON.stringify(doc).length > MAX_BODY_BYTES) return fail("The notes are too long to save.");
    update.body = doc;
  }
  if ("youtubeId" in input) {
    const yt = parseYouTube(input.youtubeId);
    if (yt === undefined) return fail("That isn't a YouTube link or video id.");
    update.youtube_id = yt;
  }
  let moved = false;
  if (typeof input.moduleId === "string" && input.moduleId !== row.module_id) {
    const { data: mod } = await supabase.from("course_modules").select("id").eq("id", input.moduleId).maybeSingle();
    if (!mod) return fail("There's no such module.", 404);
    const { data: last } = await supabase.from("course_lessons").select("position").eq("module_id", mod.id).order("position", { ascending: false }).limit(1).maybeSingle();
    update.module_id = mod.id;
    update.position = (last?.position ?? -1) + 1;
    moved = true;
  }
  if (!Object.keys(update).length) return ok();
  const { error: e } = await supabase.from("course_lessons").update(update).eq("id", id);
  if (e) return fail("The lesson couldn't be saved.", 500);
  if (moved) await renumber(supabase, row.module_id);
  return ok();
}

/** DELETE: the lesson, its video files and its attachments. */
export async function DELETE(_request: Request, ctx: Ctx) {
  const id = lessonParam((await ctx.params).lesson);
  if (!id) return fail("There's no such lesson.", 404);
  const { supabase, error } = await adminContext();
  if (error) return error;
  const { data: row } = await supabase.from("course_lessons").select("module_id").eq("id", id).maybeSingle();
  if (!row) return fail("There's no such lesson.", 404);
  const [video, { data: files }] = await Promise.all([lessonVideo(supabase, id), supabase.from("lesson_files").select("path").eq("lesson_id", id)]);
  const { error: e } = await supabase.from("course_lessons").delete().eq("id", id);
  if (e) return fail("The lesson couldn't be removed.", 500);
  if (video) await removeVersionFiles(supabase, id, video.version);
  const paths = ((files ?? []) as { path: string }[]).map((f) => f.path).filter((p) => p.startsWith(`${id}/`));
  if (paths.length) await supabase.storage.from(LESSONS_BUCKET).remove(paths);
  await renumber(supabase, row.module_id);
  return ok();
}
