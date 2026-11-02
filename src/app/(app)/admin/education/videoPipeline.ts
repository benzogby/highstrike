"use client";

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";
import { supabaseBrowser } from "@/lib/supabase/client";
import { LESSONS_BUCKET } from "@/lib/educationShared";

// A new lesson video, made in the admin's browser (Ben chose this on 2026-11-02 over a paid video service): ffmpeg
// (WebAssembly) turns the source into the same HLS the import made (720p-or-smaller H.264 + AAC, 6-second TS segments
// under 720p/, a master.m3u8 and a poster.jpg), and each file goes straight to storage through a signed upload link
// from the server, so neither Vercel's request limits nor the bucket's 50 MB per file stand in the way of a long video.
//
// The source is read in place (WORKERFS), never copied into memory, and it's encoded five minutes at a time: each
// stretch's segments are uploaded and freed before the next is made, so memory stays flat however long the video is.
// Keyframes fall exactly every 6 seconds, so every stretch starts on a segment boundary, and each stretch's timestamps
// continue the last one's (-output_ts_offset). Nothing is visible to members until the server publishes the new
// version folder.

const CORE = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm";
// ffmpeg's own worker, unbundled: the bundler can't follow the worker's import() of the core, so it runs as published.
const WORKER = "https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.15/dist/esm/worker.js";
const SEGMENT_SEC = 6;
const CHUNK_SEC = 300;
const RENDITION = "720p";
const UPLOAD_CONCURRENCY = 4;

export type Stage = "loading" | "reading" | "converting" | "publishing";
export type PipelineProgress = { stage: Stage; fraction: number };

async function api(lessonId: string, body: object) {
  const res = await fetch(`/api/admin/education/lessons/${encodeURIComponent(lessonId)}/video`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Something went wrong.");
  return json;
}

let shared: Promise<FFmpeg> | null = null;

/** ffmpeg's ~30 MB core, fetched once per visit. */
function loadFFmpeg(): Promise<FFmpeg> {
  shared ??= (async () => {
    const ff = new FFmpeg();
    await ff.load({
      // A worker has to come from this page's origin, so a one-line module here imports the published one.
      classWorkerURL: URL.createObjectURL(new Blob([`import ${JSON.stringify(WORKER)};`], { type: "text/javascript" })),
      coreURL: await toBlobURL(`${CORE}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${CORE}/ffmpeg-core.wasm`, "application/wasm"),
    });
    return ff;
  })().catch((e) => {
    shared = null;
    throw e;
  });
  return shared;
}

/** "00:18:20.12" → 1100.12 */
const seconds = (hms: string) => hms.split(":").reduce((t, p) => t * 60 + Number(p), 0);

async function uploadAll(lessonId: string, version: string, files: { rel: string; data: Uint8Array }[]) {
  const { uploads } = (await api(lessonId, { action: "sign", version, paths: files.map((f) => f.rel) })) as {
    uploads: { path: string; token: string; contentType: string }[];
  };
  const bucket = supabaseBrowser().storage.from(LESSONS_BUCKET);
  let next = 0;
  const worker = async () => {
    while (next < files.length) {
      const i = next++;
      const u = uploads[i];
      const blob = new Blob([files[i].data as BlobPart], { type: u.contentType });
      for (let attempt = 1; ; attempt++) {
        const { error } = await bucket.uploadToSignedUrl(u.path, u.token, blob, { contentType: u.contentType, upsert: true });
        if (!error) break;
        if (attempt >= 3) throw new Error(`Upload failed: ${error.message}`);
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(UPLOAD_CONCURRENCY, files.length) }, worker));
}

/**
 * Convert `file`, upload it as a new version of the lesson's video and publish it. Resolves with the video's length.
 * Abort with `signal`: ffmpeg stops and the half-made version is deleted.
 */
export async function uploadLessonVideo(lessonId: string, file: File, onProgress: (p: PipelineProgress) => void, signal: AbortSignal): Promise<number> {
  onProgress({ stage: "loading", fraction: 0 });
  const ff = await loadFFmpeg();
  const { version } = (await api(lessonId, { action: "start" })) as { version: string };
  let mounted = false;
  const stop = () => ff.terminate();
  signal.addEventListener("abort", stop);
  try {
    // The source, read in place under a plain name.
    await ff.createDir("/in").catch(() => {});
    await ff.createDir("/out").catch(() => {});
    const ext = (/\.([a-z0-9]{1,5})$/i.exec(file.name)?.[1] ?? "mp4").toLowerCase();
    const src = `/in/source.${ext}`;
    await ff.mount("WORKERFS" as Parameters<FFmpeg["mount"]>[0], { files: [new File([file], `source.${ext}`, { type: file.type })] }, "/in");
    mounted = true;

    // How long it is and how big its picture is.
    onProgress({ stage: "reading", fraction: 0 });
    let log = "";
    const collect = ({ message }: { message: string }) => {
      log += message + "\n";
    };
    ff.on("log", collect);
    await ff.exec(["-hide_banner", "-i", src]);
    ff.off("log", collect);
    const duration = seconds(/Duration:\s*(\d+:\d+:\d+(?:\.\d+)?)/.exec(log)?.[1] ?? "0");
    if (!(duration > 0)) throw new Error("That file doesn't look like a video ffmpeg can read.");
    if (!/Stream #\d+:\d+.*Video:/.test(log)) throw new Error("That file has no video in it.");

    // The poster: a frame a little way in, at the rendition's size.
    const scale = "scale=-2:'trunc(min(720,ih)/2)*2'";
    await ff.exec(["-hide_banner", "-ss", String(Math.min(5, duration / 10)), "-i", src, "-frames:v", "1", "-vf", scale, "-q:v", "3", "/out/poster.jpg"]);
    const poster = (await ff.readFile("/out/poster.jpg").catch(() => null)) as Uint8Array | null;
    if (poster) {
      await uploadAll(lessonId, version, [{ rel: "poster.jpg", data: poster }]);
      await ff.deleteFile("/out/poster.jpg");
    }

    // The video, five minutes at a time.
    const entries: { sec: number; name: string; bytes: number; chunk: number }[] = [];
    let resolution = "";
    let doneSec = 0;
    const onTime = ({ time }: { time: number }) => {
      // `time` is in microseconds of output written so far in this stretch.
      onProgress({ stage: "converting", fraction: Math.min(0.99, (doneSec + Math.max(0, time) / 1e6) / duration) });
    };
    ff.on("progress", onTime);
    try {
      for (let start = 0, chunk = 0; start < duration - 0.05; start += CHUNK_SEC, chunk++) {
        if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
        doneSec = start;
        const len = Math.min(CHUNK_SEC, duration - start);
        log = "";
        ff.on("log", collect);
        const code = await ff.exec([
          "-hide_banner",
          "-ss", String(start),
          "-t", String(len),
          "-i", src,
          "-map", "0:v:0",
          "-map", "0:a:0?",
          "-vf", scale,
          "-c:v", "libx264",
          "-preset", "veryfast",
          "-crf", "23",
          "-maxrate", "2500k",
          "-bufsize", "5000k",
          "-pix_fmt", "yuv420p",
          "-profile:v", "main",
          "-force_key_frames", `expr:gte(t,n_forced*${SEGMENT_SEC})`,
          "-sc_threshold", "0",
          "-c:a", "aac",
          "-b:a", "128k",
          "-ac", "2",
          "-ar", "48000",
          "-output_ts_offset", String(start),
          "-f", "hls",
          "-hls_time", String(SEGMENT_SEC),
          "-hls_playlist_type", "vod",
          "-start_number", String(entries.length),
          "-hls_segment_filename", "/out/seg_%04d.ts",
          "/out/part.m3u8",
        ]);
        ff.off("log", collect);
        if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
        if (code !== 0) throw new Error("ffmpeg couldn't convert this video.");
        if (!resolution) resolution = /Output #0[\s\S]*?Video:[^\n]*?(\d{2,5})x(\d{2,5})/.exec(log)?.slice(1, 3).join("x") ?? "";

        // This stretch's segments, uploaded, then freed.
        const part = (await ff.readFile("/out/part.m3u8", "utf8")) as string;
        const lines = part.split(/\r?\n/);
        const files: { rel: string; data: Uint8Array }[] = [];
        for (let i = 0; i < lines.length; i++) {
          if (!lines[i].startsWith("#EXTINF:")) continue;
          const name = lines[i + 1]?.trim().split("/").pop() ?? "";
          if (!/^seg_\d{4,6}\.ts$/.test(name)) continue;
          const data = (await ff.readFile(`/out/${name}`)) as Uint8Array;
          entries.push({ sec: Number(lines[i].slice(8).split(",")[0]) || 0, name, bytes: data.byteLength, chunk });
          files.push({ rel: `${RENDITION}/${name}`, data });
        }
        if (!files.length) throw new Error("ffmpeg made no video from this file.");
        for (let i = 0; i < files.length; i += 50) await uploadAll(lessonId, version, files.slice(i, i + 50));
        for (const f of files) await ff.deleteFile(`/out/${f.rel.split("/").pop()}`);
        await ff.deleteFile("/out/part.m3u8");
      }
    } finally {
      ff.off("progress", onTime);
    }

    // The playlists, written last so the folder is only ever complete once they're there.
    onProgress({ stage: "publishing", fraction: 1 });
    const target = Math.ceil(Math.max(...entries.map((e) => e.sec)));
    const media = ["#EXTM3U", "#EXT-X-VERSION:3", `#EXT-X-TARGETDURATION:${target}`, "#EXT-X-MEDIA-SEQUENCE:0", "#EXT-X-PLAYLIST-TYPE:VOD"];
    entries.forEach((e, i) => {
      if (i > 0 && e.chunk !== entries[i - 1].chunk) media.push("#EXT-X-DISCONTINUITY");
      media.push(`#EXTINF:${e.sec.toFixed(6)},`, e.name);
    });
    media.push("#EXT-X-ENDLIST", "");
    const total = entries.reduce((s, e) => s + e.sec, 0);
    const bytes = entries.reduce((s, e) => s + e.bytes, 0);
    const peak = Math.max(...entries.map((e) => (e.sec > 0 ? (e.bytes * 8) / e.sec : 0)));
    const average = total > 0 ? (bytes * 8) / total : 0;
    const master = [
      "#EXTM3U",
      "#EXT-X-VERSION:3",
      `#EXT-X-STREAM-INF:BANDWIDTH=${Math.round(peak)},AVERAGE-BANDWIDTH=${Math.round(average)}${resolution ? `,RESOLUTION=${resolution}` : ""}`,
      `${RENDITION}/index.m3u8`,
      "",
    ];
    const enc = new TextEncoder();
    await uploadAll(lessonId, version, [{ rel: `${RENDITION}/index.m3u8`, data: enc.encode(media.join("\n")) }]);
    await uploadAll(lessonId, version, [{ rel: "master.m3u8", data: enc.encode(master.join("\n")) }]);
    const { durationSec } = (await api(lessonId, { action: "publish", version })) as { durationSec: number };
    return durationSec;
  } catch (e) {
    await api(lessonId, { action: "discard", version }).catch(() => {});
    if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
    throw e;
  } finally {
    signal.removeEventListener("abort", stop);
    if (signal.aborted) shared = null; // terminate() ends this ffmpeg; the next upload loads a fresh one
    else if (mounted) await ff.unmount("/in").catch(() => {});
  }
}
