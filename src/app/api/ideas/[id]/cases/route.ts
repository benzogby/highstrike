import { NextResponse } from "next/server";
import { writeCases } from "@/lib/ideaAI";
import { PRIVATE, fail, ideaContext } from "@/lib/ideaRoute";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** POST: the idea's bull and bear case, written by the AI the first time anyone opens the idea, then kept on it. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await ideaContext(request, (await params).id);
  if ("error" in ctx) return ctx.error;
  if (ctx.idea.cases) return NextResponse.json({ cases: ctx.idea.cases }, { headers: PRIVATE });
  try {
    const cases = await writeCases(ctx.idea, ctx.price);
    await ctx.db.from("setups").update({ cases }).eq("id", ctx.idea.id);
    return NextResponse.json({ cases }, { headers: PRIVATE });
  } catch (e) {
    console.error("idea cases:", e instanceof Error ? e.message : e);
    return fail("The AI couldn't write the case just now. Try again in a minute.", 502);
  }
}
