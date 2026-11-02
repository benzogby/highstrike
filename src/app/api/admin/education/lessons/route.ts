import { adminContext, fail, newLessonId, ok } from "@/lib/educationAdmin";

export const dynamic = "force-dynamic";

/** POST { moduleId, title }: a new lesson at the end of its module, text only until it gets a video. */
export async function POST(request: Request) {
  const { supabase, error } = await adminContext();
  if (error) return error;
  const body = (await request.json().catch(() => null)) as { moduleId?: unknown; title?: unknown } | null;
  const moduleId = typeof body?.moduleId === "string" ? body.moduleId : "";
  const title = typeof body?.title === "string" ? body.title.trim().slice(0, 200) : "";
  if (!title) return fail("Give the lesson a title.");
  const { data: mod } = await supabase.from("course_modules").select("id").eq("id", moduleId).maybeSingle();
  if (!mod) return fail("There's no such module.", 404);
  const { data: last } = await supabase.from("course_lessons").select("position").eq("module_id", moduleId).order("position", { ascending: false }).limit(1).maybeSingle();
  const lesson = { id: newLessonId(), module_id: moduleId, position: (last?.position ?? -1) + 1, title };
  const { error: insertError } = await supabase.from("course_lessons").insert(lesson);
  if (insertError) return fail("The lesson couldn't be added.", 500);
  return ok({ lesson: { id: lesson.id, moduleId, position: lesson.position, title, youtubeId: null, durationSec: null } });
}
