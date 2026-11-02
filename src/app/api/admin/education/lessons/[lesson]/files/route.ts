import { LESSONS_BUCKET } from "@/lib/education";
import { ATTACHMENT_TYPES, MAX_ATTACHMENT_BYTES, adminContext, fail, lessonParam, ok, slugFile } from "@/lib/educationAdmin";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ lesson: string }> };

/**
 * POST { action }: a file beside the lesson (a PDF, a sheet…), uploaded by the admin's browser straight to storage.
 *  - "sign" { filename, contentType, bytes }: a signed upload link under <lesson>/files/.
 *  - "add" { path, filename }: once it's uploaded, list it on the lesson.
 */
export async function POST(request: Request, ctx: Ctx) {
  const id = lessonParam((await ctx.params).lesson);
  if (!id) return fail("There's no such lesson.", 404);
  const { supabase, error } = await adminContext();
  if (error) return error;
  const input = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const { data: row } = await supabase.from("course_lessons").select("id").eq("id", id).maybeSingle();
  if (!row) return fail("There's no such lesson.", 404);
  const filename = typeof input?.filename === "string" ? input.filename.trim().slice(0, 200) : "";
  if (!filename) return fail("The file needs a name.");
  const bucket = supabase.storage.from(LESSONS_BUCKET);

  if (input?.action === "sign") {
    const contentType = typeof input.contentType === "string" ? input.contentType : "";
    if (!ATTACHMENT_TYPES.has(contentType)) return fail("Files can be PDFs, Word, Excel or PowerPoint files, text, CSV, images or zips.");
    if (!(Number(input.bytes) > 0) || Number(input.bytes) > MAX_ATTACHMENT_BYTES) return fail("Files can be up to 50 MB.");
    const rand = Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => b.toString(16).padStart(2, "0")).join("");
    const path = `${id}/files/${rand}-${slugFile(filename)}`;
    const { data, error: e } = await bucket.createSignedUploadUrl(path);
    if (e || !data) return fail("Storage wouldn't take the upload just now. Try again.", 502);
    return ok({ path, token: data.token });
  }

  if (input?.action === "add") {
    const path = typeof input.path === "string" ? input.path : "";
    if (!new RegExp(`^${id}/files/[0-9a-f]{8}-[a-z0-9.-]+$`).test(path)) return fail("That file isn't one of this lesson's.");
    const name = path.slice(path.lastIndexOf("/") + 1);
    const { data: listed } = await bucket.list(`${id}/files`, { search: name });
    const object = listed?.find((f) => f.name === name);
    if (!object) return fail("The file didn't finish uploading. Try again.", 422);
    const meta = (object.metadata ?? {}) as { size?: number; mimetype?: string };
    const { error: e } = await supabase.from("lesson_files").upsert({ lesson_id: id, path, filename, content_type: meta.mimetype ?? null, bytes: meta.size ?? null });
    if (e) return fail("The file couldn't be added.", 500);
    return ok({ file: { path, name: filename, bytes: meta.size ?? 0 } });
  }

  return fail("Unknown action.");
}

/** DELETE { path }: take a file off the lesson and out of storage. */
export async function DELETE(request: Request, ctx: Ctx) {
  const id = lessonParam((await ctx.params).lesson);
  if (!id) return fail("There's no such lesson.", 404);
  const { supabase, error } = await adminContext();
  if (error) return error;
  const input = (await request.json().catch(() => null)) as { path?: unknown } | null;
  const path = typeof input?.path === "string" ? input.path : "";
  const { data: row } = await supabase.from("lesson_files").select("path").eq("lesson_id", id).eq("path", path).maybeSingle();
  if (!row) return fail("There's no such file.", 404);
  const { error: e } = await supabase.from("lesson_files").delete().eq("lesson_id", id).eq("path", path);
  if (e) return fail("The file couldn't be removed.", 500);
  if (path.startsWith(`${id}/`)) await supabase.storage.from(LESSONS_BUCKET).remove([path]);
  return ok();
}
