"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { isLessonId, lessonHref } from "@/lib/education";

// A member's progress through the lessons: the player saves where they are, and the lesson page marks a lesson done.
// Every write goes through the member's own session, so lesson_progress's rules hold it to their own rows and to
// accounts with Education (supabase/migrations/20261102170000_education.sql).

/** A lesson counts as watched at 90% of its video: the sign-off at the end isn't the lesson. */
const DONE_AT = 0.9;
/** No lesson runs a day: past this it's a broken clock, not a position. */
const MAX_SEC = 24 * 60 * 60;

async function member(lessonId: unknown) {
  if (!isLessonId(lessonId)) throw new Error("That lesson doesn't exist.");
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in to save your progress.");
  // Readable only with Education, so this also checks the plan.
  const { data } = await supabase.from("course_lessons").select("id").eq("id", lessonId).maybeSingle();
  if (!data) throw new Error("Education comes with every paid plan.");
  return { supabase, userId: user.id, lessonId };
}

function refresh(lessonId: string) {
  revalidatePath("/education");
  revalidatePath(lessonHref(lessonId));
}

/**
 * Where the player is: every ~10 seconds while it plays, on pause and at the end. At 90% of the video the lesson is done,
 * once: a lesson watched again keeps the day it was first finished.
 */
export async function saveLessonPosition(lessonId: string, positionSec: number, durationSec: number): Promise<{ completed: boolean }> {
  const m = await member(lessonId);
  const length = Number.isFinite(durationSec) && durationSec > 0 ? Math.min(durationSec, MAX_SEC) : 0;
  const at = Math.round(Math.min(Math.max(0, Number(positionSec) || 0), length || MAX_SEC) * 10) / 10;
  const now = new Date().toISOString();
  const { data, error } = await m.supabase
    .from("lesson_progress")
    .upsert({ user_id: m.userId, lesson_id: m.lessonId, position_sec: at, updated_at: now }, { onConflict: "user_id,lesson_id" })
    .select("completed_at")
    .single();
  if (error) throw new Error("Your place couldn't be saved.");
  if ((data as { completed_at: string | null } | null)?.completed_at) return { completed: true };
  if (!length || at < DONE_AT * length) return { completed: false };
  const { data: first } = await m.supabase.from("lesson_progress").update({ completed_at: now }).eq("user_id", m.userId).eq("lesson_id", m.lessonId).is("completed_at", null).select("lesson_id");
  if (first?.length) refresh(m.lessonId);
  return { completed: true };
}

/** Mark as done, or not done again, from the lesson page. */
export async function setLessonDone(lessonId: string, done: boolean): Promise<void> {
  const m = await member(lessonId);
  const now = new Date().toISOString();
  if (done) {
    const { error } = await m.supabase.from("lesson_progress").upsert({ user_id: m.userId, lesson_id: m.lessonId, updated_at: now }, { onConflict: "user_id,lesson_id" });
    if (error) throw new Error("That couldn't be saved.");
    await m.supabase.from("lesson_progress").update({ completed_at: now }).eq("user_id", m.userId).eq("lesson_id", m.lessonId).is("completed_at", null);
  } else {
    const { error } = await m.supabase.from("lesson_progress").update({ completed_at: null, updated_at: now }).eq("user_id", m.userId).eq("lesson_id", m.lessonId);
    if (error) throw new Error("That couldn't be saved.");
  }
  refresh(m.lessonId);
}
