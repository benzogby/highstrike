import { supabaseServer } from "@/lib/supabase/server";
import { LESSONS_BUCKET } from "@/lib/educationShared";

export { LESSONS_BUCKET, moduleLabel, clock, lessonHref } from "@/lib/educationShared";

// HighStrike Trading School, the course library for members (Ben, 2026-11-02; imported from Whop's Alpha Mastermind and
// renamed the same day), laid out like getripping.com's Ripping University: one module per course chapter, each a list of
// lessons. Everything comes from the database
// (supabase/migrations/20261102170000_education.sql) through the member's own session, so the tables' rules decide
// what anyone sees: the membership or an admin (public.has_education() → is_member()). The repository is public;
// no lesson is in it.

type Client = Awaited<ReturnType<typeof supabaseServer>>;

/** How long a poster or an attachment link lasts: longer than anyone stays on one lesson. */
export const LINK_SECONDS = 6 * 60 * 60;

export type Module = { id: string; position: number; title: string };
export type Lesson = { id: string; moduleId: string; position: number; title: string; youtubeId: string | null; durationSec: number | null };
export type Rendition = { name: string; playlist: string; bandwidth: number; resolution: string };
export type Video = { lessonId: string; version: string; durationSec: number; renditions: Rendition[]; poster: string | null };
export type Progress = { positionSec: number; completedAt: string | null };
/** How a lesson is watched: our player, a video still being copied over, YouTube, or notes alone. */
export type LessonKind = "video" | "processing" | "youtube" | "text";
export type LessonState = { kind: LessonKind; durationSec: number | null; done: boolean; positionSec: number };
export type LessonStates = Record<string, LessonState>;

/** Every module in order, and every lesson in library order (module, then its place in the module). */
export async function outline(supabase: Client): Promise<{ modules: Module[]; lessons: Lesson[] }> {
  const [{ data: m }, { data: l }] = await Promise.all([
    supabase.from("course_modules").select("id, position, title").order("position"),
    supabase.from("course_lessons").select("id, module_id, position, title, youtube_id, duration_sec").order("position").limit(1000),
  ]);
  const modules = ((m ?? []) as Module[]).map((x) => ({ id: x.id, position: x.position, title: x.title }));
  const order = new Map(modules.map((x) => [x.id, x.position]));
  const lessons = ((l ?? []) as { id: string; module_id: string; position: number; title: string; youtube_id: string | null; duration_sec: number | string | null }[])
    .map((x) => ({ id: x.id, moduleId: x.module_id, position: x.position, title: x.title, youtubeId: x.youtube_id, durationSec: x.duration_sec == null ? null : Number(x.duration_sec) }))
    .sort((a, b) => (order.get(a.moduleId) ?? 0) - (order.get(b.moduleId) ?? 0) || a.position - b.position);
  return { modules, lessons };
}

function toVideo(r: { lesson_id: string; version: string; duration_sec: number | string; renditions: unknown; poster: string | null }): Video {
  const renditions = (Array.isArray(r.renditions) ? r.renditions : [])
    .map((x) => x as Partial<Rendition>)
    .filter((x): x is Rendition => typeof x.name === "string" && typeof x.playlist === "string" && !!x.playlist)
    .map((x) => ({ name: x.name, playlist: x.playlist, bandwidth: Number(x.bandwidth) || 0, resolution: typeof x.resolution === "string" ? x.resolution : "" }));
  return { lessonId: r.lesson_id, version: r.version, durationSec: Number(r.duration_sec) || 0, renditions, poster: r.poster || null };
}

/** Every video that's been copied over and published, by lesson id. */
export async function publishedVideos(supabase: Client): Promise<Map<string, Video>> {
  const { data } = await supabase.from("lesson_videos").select("lesson_id, version, duration_sec, renditions, poster").limit(1000);
  return new Map(((data ?? []) as Parameters<typeof toVideo>[0][]).map((r) => [r.lesson_id, toVideo(r)]));
}

/** One lesson's published video, or null. */
export async function lessonVideo(supabase: Client, lessonId: string): Promise<Video | null> {
  const { data } = await supabase.from("lesson_videos").select("lesson_id, version, duration_sec, renditions, poster").eq("lesson_id", lessonId).maybeSingle();
  return data ? toVideo(data as Parameters<typeof toVideo>[0]) : null;
}

/** The member's own progress by lesson id. */
export async function myProgress(supabase: Client, userId: string): Promise<Map<string, Progress>> {
  const { data } = await supabase.from("lesson_progress").select("lesson_id, position_sec, completed_at").eq("user_id", userId).limit(1000);
  return new Map(((data ?? []) as { lesson_id: string; position_sec: number | string; completed_at: string | null }[]).map((r) => [r.lesson_id, { positionSec: Number(r.position_sec) || 0, completedAt: r.completed_at }]));
}

/** What the views need about each lesson: how it's watched, how long, and where the member is with it. */
export function lessonStates(lessons: Lesson[], videos: Map<string, Video>, progress: Map<string, Progress>): LessonStates {
  const out: LessonStates = {};
  for (const l of lessons) {
    const video = videos.get(l.id);
    const p = progress.get(l.id);
    const kind: LessonKind = video ? "video" : l.youtubeId ? "youtube" : l.durationSec ? "processing" : "text";
    out[l.id] = { kind, durationSec: video?.durationSec || l.durationSec || null, done: Boolean(p?.completedAt), positionSec: p?.positionSec ?? 0 };
  }
  return out;
}

/** A lesson's notes (the editor's JSON document) and its files, each behind a link that lasts six hours. */
export async function lessonDetail(supabase: Client, lessonId: string) {
  const [{ data: row }, { data: files }] = await Promise.all([
    supabase.from("course_lessons").select("body").eq("id", lessonId).maybeSingle(),
    supabase.from("lesson_files").select("path, filename, bytes").eq("lesson_id", lessonId),
  ]);
  const links = await Promise.all(
    ((files ?? []) as { path: string; filename: string; bytes: number | null }[]).map(async (f) => {
      const { data } = await supabase.storage.from(LESSONS_BUCKET).createSignedUrl(f.path, LINK_SECONDS, { download: f.filename });
      return data?.signedUrl ? { name: f.filename, bytes: f.bytes ?? 0, url: data.signedUrl } : null;
    })
  );
  return { body: (row?.body ?? null) as unknown, files: links.filter((x): x is { name: string; bytes: number; url: string } => x !== null) };
}

/** The poster through a link that lasts six hours, or null. */
export async function posterUrl(supabase: Client, video: Video): Promise<string | null> {
  if (!video.poster || video.poster.includes("..")) return null;
  const { data } = await supabase.storage.from(LESSONS_BUCKET).createSignedUrl(`${video.lessonId}/${video.version}/${video.poster.replace(/^\/+/, "")}`, LINK_SECONDS);
  return data?.signedUrl ?? null;
}

/** How big the library is, for the paywall (the one thing an account without Education may know about it). */
export async function librarySummary(supabase: Client): Promise<{ modules: number; lessons: number; videoHours: number } | null> {
  const { data } = await supabase.rpc("education_summary");
  const r = (data as { modules: number; lessons: number; video_hours: number | string }[] | null)?.[0];
  return r ? { modules: r.modules, lessons: r.lessons, videoHours: Number(r.video_hours) || 0 } : null;
}

export const moduleAnchor = (position: number) => `module-${position + 1}`;
/** The lesson's HLS master playlist: the stream route signs every piece for the signed-in member. */
export const streamSrc = (id: string) => `/api/education/${encodeURIComponent(id)}/stream/master.m3u8`;
export const isLessonId = (id: unknown): id is string => typeof id === "string" && /^lesn_[A-Za-z0-9]{8,40}$/.test(id);

/** 9000 → "2h 30m", 1500 → "25m". */
export function hours(sec: number): string {
  const m = Math.round((sec || 0) / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}

export const plural = (n: number, word: string) => `${n} ${n === 1 ? word : `${word}s`}`;
