import { NextResponse } from "next/server";
import { viewer } from "@/lib/membership";
import { fetchQuotes } from "@/lib/quotes";
import { supabaseService } from "@/lib/stripe";
import { IDEA_COLUMNS, type Idea } from "@/lib/ideas";

// The idea page's API routes share this: a signed-in member, the idea, and its latest price.
export const PRIVATE = { "cache-control": "private, no-store" };
export const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers: PRIVATE });

export async function ideaContext(request: Request, id: string) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(request.url).host) return { error: fail("Open this from highstrike.com.", 403) };
  if (!process.env.ANTHROPIC_API_KEY) return { error: fail("The AI isn't switched on yet. It will be soon.", 503) };
  const v = await viewer();
  if (!v) return { error: fail("Sign in first.", 401) };
  if (!v.member) return { error: fail("Ideas are for members.", 403) };
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { error: fail("No such idea.", 404) };
  const db = supabaseService();
  const { data } = await db.from("setups").select(`${IDEA_COLUMNS}, cases`).eq("id", id).maybeSingle();
  if (!data) return { error: fail("No such idea.", 404) };
  const idea = data as Idea & { cases: unknown };
  const [q] = await fetchQuotes([idea.ticker]).catch(() => []);
  return { db, user: v.user, idea, price: q?.live ? q.price : null };
}
