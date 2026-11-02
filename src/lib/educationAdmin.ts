import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { LESSONS_BUCKET, isLessonId } from "@/lib/education";
import { MAX_REL_PATH, dirOf, isLessonVersion, isSafeRelPath, masterUris, masterVariants, mediaSummary, playlistKind, resolveUri, segmentUris } from "@/lib/hls";

// Admin → Trading School (Ben, 2026-11-02): the server side of every edit to the library. Each route asks adminContext()
// first and then writes through the admin's own session, so the tables' and the bucket's admin-only rules
// (supabase/migrations/20261102230000_education_admin.sql) have the last word too. Video files never pass through
// here: the admin's browser makes the HLS and uploads each file straight to storage through a signed upload link.

type Client = Awaited<ReturnType<typeof supabaseServer>>;

const NO_STORE = { "cache-control": "private, no-store" };
export const fail = (error: string, status = 400) => NextResponse.json({ error }, { status, headers: NO_STORE });
export const ok = (body: object = { ok: true }) => NextResponse.json(body, { headers: NO_STORE });

/** The signed-in admin's session, or the response that turns anyone else away. */
export async function adminContext(): Promise<{ supabase: Client; error?: undefined } | { supabase?: undefined; error: NextResponse }> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: fail("Sign in first.", 401) };
  const { data: me } = await supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
  if (!me?.is_admin) return { error: fail("Admins only.", 403) };
  return { supabase };
}

/** The lesson id from a route's params, checked. */
export function lessonParam(id: string): string | null {
  return isLessonId(id) ? id : null;
}

/** A fresh lesson id in the import's shape (lesn_ + letters and digits), so isLessonId() takes it everywhere. */
export function newLessonId(): string {
  const abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.getRandomValues(new Uint8Array(22));
  return `lesn_${Array.from(bytes, (b) => abc[b % abc.length]).join("")}`;
}

/** A fresh video version: its own folder, so no player or cache ever sees a half-made video. */
export function newVersion(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** 'dQw4w9WgXcQ', a youtu.be link or a youtube.com link → the video id; "" → null (cleared); anything else → undefined. */
export function parseYouTube(raw: unknown): string | null | undefined {
  if (raw === null) return null;
  if (typeof raw !== "string") return undefined;
  const s = raw.trim();
  if (!s) return null;
  if (/^[\w-]{6,20}$/.test(s)) return s;
  try {
    const u = new URL(s);
    const id = u.hostname.endsWith("youtu.be") ? u.pathname.slice(1).split("/")[0] : u.searchParams.get("v") ?? /\/(?:embed|shorts|live|v)\/([\w-]{6,})/.exec(u.pathname)?.[1];
    return id && /^[\w-]{6,20}$/.test(id) ? id : undefined;
  } catch {
    return undefined;
  }
}

/** Every file under a folder of the bucket, except the lesson's attachments (`files/`), which outlive any one video. */
async function listTree(supabase: Client, folder: string, depth = 0): Promise<string[]> {
  const out: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.storage.from(LESSONS_BUCKET).list(folder, { limit: 1000, offset });
    if (error || !data) break;
    for (const item of data) {
      const path = `${folder}/${item.name}`;
      if (item.id) out.push(path);
      else if (item.name !== "files" && depth < 3) out.push(...(await listTree(supabase, path, depth + 1)));
    }
    if (data.length < 1000) break;
  }
  return out;
}

/** Remove one video version's files (playlists, segments, poster) from the bucket; its attachments stay. */
export async function removeVersionFiles(supabase: Client, lessonId: string, version: string) {
  if (!isLessonId(lessonId) || !isLessonVersion(version)) return;
  const paths = await listTree(supabase, `${lessonId}/${version}`);
  for (let i = 0; i < paths.length; i += 500) await supabase.storage.from(LESSONS_BUCKET).remove(paths.slice(i, i + 500));
}

/** Which kind of file a video's folder may get, by name, and the type it's uploaded as. */
export function videoFileType(rel: string): string | null {
  if (!isSafeRelPath(rel) || rel.length > MAX_REL_PATH) return null;
  if (rel.endsWith(".m3u8")) return "application/vnd.apple.mpegurl";
  if (rel.endsWith(".ts")) return "video/mp2t";
  if (rel.endsWith(".jpg")) return "image/jpeg";
  return null;
}

/** An uploaded master playlist and its renditions, read back and checked before anyone is sent to them. */
export async function readUploadedVideo(supabase: Client, lessonId: string, version: string) {
  const bucket = supabase.storage.from(LESSONS_BUCKET);
  const prefix = `${lessonId}/${version}`;
  const text = async (rel: string) => {
    const { data } = await bucket.download(`${prefix}/${rel}`);
    return data && data.size < 1024 * 1024 ? data.text() : null;
  };
  const master = await text("master.m3u8");
  if (!master || playlistKind(master) !== "master") return null;

  // Every URI the master names must be one of its variants, the only playlists the stream route serves.
  const variants = masterVariants(master);
  if (!variants.length || masterUris(master).some((u) => !variants.includes(u)) || !variants.every((u) => isSafeRelPath(u))) return null;
  const renditions: { name: string; playlist: string; bandwidth: number; resolution: string }[] = [];
  const lines = master.split(/\r?\n/).map((l) => l.trim());
  for (const uri of variants) {
    const inf = lines[lines.indexOf(uri) - 1] ?? "";
    renditions.push({
      name: uri.split("/")[0].replace(/\.m3u8$/, ""),
      playlist: uri,
      bandwidth: Number(/[:,]BANDWIDTH=(\d+)/.exec(inf)?.[1]) || 0,
      resolution: /RESOLUTION=(\d+x\d+)/.exec(inf)?.[1] ?? "",
    });
  }

  // Each rendition finished, with every segment inside its own folder; the length comes from the first one's segments,
  // so the library shows exactly what plays.
  let durationSec = 0;
  for (const [i, r] of renditions.entries()) {
    const media = await text(r.playlist);
    if (!media || playlistKind(media) !== "media") return null;
    const summary = mediaSummary(media);
    if (!summary.ended || !summary.segments || segmentUris(media).some((u) => !resolveUri(dirOf(r.playlist), u))) return null;
    if (i === 0) durationSec = summary.durationSec;
  }
  if (!(durationSec > 0)) return null;

  const { data: poster } = await bucket.list(prefix, { search: "poster.jpg" });
  const [w, h] = renditions[0].resolution.split("x").map(Number);
  return { renditions, durationSec, poster: poster?.some((f) => f.name === "poster.jpg") ? "poster.jpg" : null, width: w || null, height: h || null };
}

/** Number a module's lessons 0, 1, 2… in the order given (the ids not given keep their order, after them). */
export async function renumber(supabase: Client, moduleId: string, first: string[] = []) {
  const { data } = await supabase.from("course_lessons").select("id, position").eq("module_id", moduleId).order("position");
  const rest = ((data ?? []) as { id: string; position: number }[]).map((r) => r.id).filter((id) => !first.includes(id));
  const order = [...first.filter((id) => (data ?? []).some((r) => r.id === id)), ...rest];
  const was = new Map(((data ?? []) as { id: string; position: number }[]).map((r) => [r.id, r.position]));
  await Promise.all(order.map((id, i) => (was.get(id) === i ? null : supabase.from("course_lessons").update({ position: i }).eq("id", id))));
}

/** "Strategy Sheet (v2).PDF" → "strategy-sheet-v2.pdf", for an attachment's storage key. */
export function slugFile(name: string): string {
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) : "";
  const base = (dot > 0 ? name.slice(0, dot) : name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "file";
  return ext ? `${base}.${ext}` : base;
}

/** The attachment types the bucket takes (supabase/migrations/20261102230000_education_admin.sql). */
export const ATTACHMENT_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/zip",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);
export const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;
