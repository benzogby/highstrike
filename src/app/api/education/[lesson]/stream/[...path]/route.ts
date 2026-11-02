import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { LESSONS_BUCKET, isLessonId, lessonVideo } from "@/lib/education";
import { HLS_MIME, dirOf, isSafeRelPath, playlistKind, resolveUri, rewriteMedia, segmentUris } from "@/lib/hls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Each segment's signed link: longer than any lesson, so a long pause still plays on (the player reloads past it). */
const SIGNED_SECONDS = 6 * 60 * 60;
/** A lesson's playlists are a few KB; a file this big isn't one, and isn't read into memory. */
const MAX_PLAYLIST_BYTES = 1024 * 1024;

const NO_STORE = { "cache-control": "private, no-store" };
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers: NO_STORE });
const playlist = (body: string) => new Response(body, { headers: { "content-type": HLS_MIME, ...NO_STORE } });

/**
 * GET: a published lesson's HLS playlists for the Education player (master.m3u8 and its rendition's playlist), ported
 * from getripping.com's Ripping University. Everything is read through the member's own session, so the bucket's and
 * the tables' rules decide: no paid plan (and not an admin), nothing to read. The master goes back as stored (its variant
 * URIs are relative, so they resolve back to this route); a rendition's playlist goes back with every segment swapped
 * for a signed storage link, so the video bytes come straight from storage and the bucket stays private. Only the
 * lesson's own published version is read, and every URI must stay inside its rendition's folder (src/lib/hls.ts).
 */
export async function GET(_request: Request, ctx: { params: Promise<{ lesson: string; path: string[] }> }) {
  const { lesson, path } = await ctx.params;
  if (!isLessonId(lesson)) return fail("There's no such lesson.", 404);
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Sign in to watch.", 401);
  const video = await lessonVideo(supabase, lesson);
  if (!video) return fail("This lesson's video isn't available.", 404);

  const rel = (path ?? []).join("/");
  const rendition = video.renditions.find((r) => r.playlist === rel);
  if (!isSafeRelPath(rel) || (rel !== "master.m3u8" && !rendition)) return fail("not found", 404);
  if (video.lessonId !== lesson || !/^[a-z0-9]{8,40}$/.test(video.version)) return fail("This lesson's video can't play right now.", 502);
  const prefix = `${video.lessonId}/${video.version}`;
  const bucket = supabase.storage.from(LESSONS_BUCKET);

  const { data: file, error } = await bucket.download(`${prefix}/${rel}`);
  if (error || !file) return fail("This lesson's video can't play right now.", 502);
  if (file.size > MAX_PLAYLIST_BYTES) return fail("This lesson's video can't play right now.", 502);
  const text = await file.text();

  if (rel === "master.m3u8") return playlistKind(text) === "master" ? playlist(text) : fail("This lesson's video can't play right now.", 502);
  if (playlistKind(text) !== "media") return fail("This lesson's video can't play right now.", 502);

  // Every URI the player would fetch, as a storage key inside this rendition's folder, then all of them signed at once.
  const dir = dirOf(rel);
  const keyOf = new Map<string, string>();
  for (const uri of segmentUris(text)) {
    const inside = resolveUri(dir, uri);
    if (!inside) return fail("This lesson's video can't play right now.", 502);
    keyOf.set(uri, `${prefix}/${inside}`);
  }
  if (!keyOf.size) return fail("This lesson's video can't play right now.", 502);
  const keys = [...new Set(keyOf.values())];
  const { data: signed, error: signError } = await bucket.createSignedUrls(keys, SIGNED_SECONDS);
  if (signError || !signed) return fail("This lesson's video can't play right now.", 502);
  const urlOf = new Map<string, string>();
  signed.forEach((s, i) => {
    if (s.signedUrl && !s.error) urlOf.set(s.path ?? keys[i], s.signedUrl);
  });
  if (keys.some((k) => !urlOf.has(k))) return fail("This lesson's video can't play right now.", 502);
  try {
    return playlist(rewriteMedia(text, (uri) => urlOf.get(keyOf.get(uri) ?? "") ?? ""));
  } catch {
    return fail("This lesson's video can't play right now.", 502);
  }
}
