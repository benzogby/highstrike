import { NextResponse } from "next/server";
import { answer } from "@/lib/ideaAI";
import { PRIVATE, fail, ideaContext } from "@/lib/ideaRoute";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Questions a member can ask the AI in a day, across every idea. */
const PER_DAY = 40;

/** POST { question }: the AI's answer about the idea, kept with the question in the member's own thread. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await ideaContext(request, (await params).id);
  if ("error" in ctx) return ctx.error;
  const body = (await request.json().catch(() => ({}))) as { question?: unknown };
  const question = typeof body.question === "string" ? body.question.trim().slice(0, 1000) : "";
  if (!question) return fail("Type a question first.", 400);

  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count } = await ctx.db.from("idea_chats").select("id", { count: "exact", head: true }).eq("user_id", ctx.user.id).eq("role", "user").gte("created_at", since);
  if ((count ?? 0) >= PER_DAY) return fail(`That's ${PER_DAY} questions in a day. Ask again tomorrow.`, 429);

  const { data: past } = await ctx.db
    .from("idea_chats")
    .select("role, content")
    .eq("user_id", ctx.user.id)
    .eq("setup_id", ctx.idea.id)
    .order("id", { ascending: false })
    .limit(20);
  const history = ((past ?? []) as { role: "user" | "assistant"; content: string }[]).reverse();

  try {
    const reply = await answer(ctx.idea, ctx.price, history, question);
    await ctx.db.from("idea_chats").insert([
      { setup_id: ctx.idea.id, user_id: ctx.user.id, role: "user", content: question },
      { setup_id: ctx.idea.id, user_id: ctx.user.id, role: "assistant", content: reply },
    ]);
    return NextResponse.json({ answer: reply }, { headers: PRIVATE });
  } catch (e) {
    console.error("idea ask:", e instanceof Error ? e.message : e);
    return fail("The AI couldn't answer just now. Try again in a minute.", 502);
  }
}
