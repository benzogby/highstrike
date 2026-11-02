import { adminContext, fail, ok, renumber } from "@/lib/educationAdmin";

export const dynamic = "force-dynamic";

/** PATCH { title?, order? }: rename a module, or put its lessons in the order given (lesson ids). */
export async function PATCH(request: Request, ctx: { params: Promise<{ module: string }> }) {
  const { module: moduleId } = await ctx.params;
  const { supabase, error } = await adminContext();
  if (error) return error;
  const body = (await request.json().catch(() => null)) as { title?: unknown; order?: unknown } | null;
  const { data: mod } = await supabase.from("course_modules").select("id").eq("id", moduleId).maybeSingle();
  if (!mod) return fail("There's no such module.", 404);
  if (typeof body?.title === "string") {
    const title = body.title.trim().slice(0, 200);
    if (!title) return fail("A module needs a title.");
    const { error: e } = await supabase.from("course_modules").update({ title }).eq("id", moduleId);
    if (e) return fail("The module couldn't be renamed.", 500);
  }
  if (Array.isArray(body?.order)) {
    const order = body.order.filter((x): x is string => typeof x === "string").slice(0, 1000);
    await renumber(supabase, moduleId, order);
  }
  return ok();
}
