"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type Hls from "hls.js";
import { HLS_MIME } from "@/lib/hls";
import { saveLessonPosition } from "@/app/(app)/education/actions";

/** While a lesson plays, its place is saved about this often; pausing and the end save it too. */
const SAVE_EVERY_MS = 10_000;
/** …but never twice inside this: a save that comes sooner waits for the gap, then goes with the newest place. */
const SAVE_GAP_MS = 5_000;
/** Saved this close to the end, a lesson starts over rather than resuming on its last seconds. */
const END_SLACK_SEC = 10;
/** Reloads once playback has broken (most often the 6-hour segment links running out under a long pause). */
const MAX_RELOADS = 3;

type Problem = { text: string; retry: boolean };
const LOAD_FAILED: Problem = { text: "The video didn't load. Check your connection, then try again.", retry: true };
const UNSUPPORTED: Problem = { text: "This browser can't play the lesson. A current Chrome, Safari, Edge or Firefox can.", retry: false };

/** Where to start: the saved place, unless there's none or it's in the last seconds (then from the top). */
function resumeAt(startAt: number, durationSec: number): number {
  if (!Number.isFinite(startAt) || startAt < 1) return 0;
  return durationSec > 0 && startAt >= durationSec - END_SLACK_SEC ? 0 : startAt;
}
const tenths = (n: number) => Math.round(n * 10) / 10;

/**
 * A lesson's video, ported from getripping.com's Ripping University: the HLS stream from
 * /api/education/<lesson>/stream/master.m3u8, whose playlists come back with every segment behind a signed storage
 * link. Safari plays HLS itself; everywhere else hls.js (loaded only then) feeds it through Media Source.
 *
 * Nothing but the playlist loads until play is pressed. It starts where `startAt` says (unless that's within 10 s of the
 * end), saves the place every ~10 s of playing, on pause, at the end and on leaving mid-lesson, never twice inside 5 s,
 * and refreshes the page once when a save first comes back completed (90% watched), so the lesson's status and the
 * library catch up. Native controls, so the keyboard, screen readers and picture-in-picture work as the browser does them.
 */
export default function LessonPlayer({ lessonId, src, poster, startAt, durationSec, completed }: { lessonId: string; src: string; poster: string | null; startAt: number; durationSec: number; completed: boolean }) {
  const router = useRouter();
  const ref = useRef<HTMLVideoElement>(null);
  // The newest props, for the long-lived handlers below: the refresh after a lesson completes brings a new startAt and
  // completed, and that mustn't tear the player down mid-lesson. Only a new src (another lesson) or a retry rebuilds it.
  const latest = useRef({ startAt, durationSec, completed, refresh: () => router.refresh() });
  useEffect(() => {
    latest.current = { startAt, durationSec, completed, refresh: () => router.refresh() };
  });
  /** When the last save went, kept across rebuilds so a reload or a retry can't save twice inside the gap. */
  const lastSaveAt = useRef(0);
  /** Where this src last played, so a retry picks up there rather than at the place the page was rendered with. */
  const spot = useRef<{ src: string; at: number } | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [announce, setAnnounce] = useState("");

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const from = resumeAt(spot.current?.src === src ? spot.current.at : latest.current.startAt, latest.current.durationSec);
    let alive = true;
    let hls: Hls | null = null;
    let native = false;
    let loading = false;
    let rolling = false;
    let everPlayed = false;
    let here = from;
    let seekTo = 0;
    let lastPos = from;
    let startedAt = 0;
    let reloads = 0;
    let mediaFixes = 0;
    let refreshed = false;
    let trailing: ReturnType<typeof setTimeout> | null = null;

    const save = () => {
      if (trailing) {
        clearTimeout(trailing);
        trailing = null;
      }
      if (!rolling) return;
      const pos = video.currentTime;
      if (!Number.isFinite(pos) || Math.abs(pos - lastPos) < 1) return;
      const wait = lastSaveAt.current + SAVE_GAP_MS - Date.now();
      if (wait > 0) {
        trailing = setTimeout(save, wait);
        return;
      }
      lastSaveAt.current = Date.now();
      lastPos = pos;
      const { durationSec: total, refresh } = latest.current;
      const length = total > 0 ? total : Number.isFinite(video.duration) ? video.duration : 0;
      saveLessonPosition(lessonId, tenths(pos), tenths(length))
        .then((r) => {
          if (!alive || refreshed || !r?.completed || latest.current.completed) return;
          refreshed = true;
          setAnnounce("Lesson complete.");
          refresh();
        })
        .catch(() => {}); // the next save tries again
    };
    const fail = () => {
      if (alive) setProblem(LOAD_FAILED);
    };

    const onPlay = () => {
      if (hls && !loading) {
        loading = true;
        hls.startLoad(from > 0 ? from : -1);
      }
    };
    const onPlaying = () => {
      rolling = true;
      everPlayed = true;
      if (!startedAt) startedAt = Date.now();
    };
    const onEmptied = () => {
      rolling = false;
    };
    const onTime = () => {
      if (!rolling) return;
      here = video.currentTime;
      spot.current = { src, at: here };
      if (!video.paused && Date.now() - Math.max(lastSaveAt.current, startedAt) >= SAVE_EVERY_MS) save();
    };
    const onHidden = () => {
      if (document.visibilityState === "hidden" && !video.paused) save();
    };
    const playNative = (at: number) => {
      seekTo = at;
      video.src = at > 0 ? `${src}#t=${at.toFixed(1)}` : src;
    };
    const onMeta = () => {
      if (seekTo > 0 && video.currentTime < seekTo - 1) video.currentTime = seekTo;
      seekTo = 0;
    };
    // Safari's player broke mid-lesson: the same stream again from where it was (its playlists bring fresh links).
    const onError = () => {
      if (!alive || !native) return;
      if (!everPlayed || reloads >= MAX_RELOADS) return fail();
      reloads++;
      const wasPlaying = !video.paused;
      rolling = false;
      playNative(here);
      if (wasPlaying) video.play().catch(() => {});
    };

    video.addEventListener("play", onPlay);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("emptied", onEmptied);
    video.addEventListener("loadedmetadata", onMeta);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("pause", save);
    video.addEventListener("ended", save);
    video.addEventListener("error", onError);
    document.addEventListener("visibilitychange", onHidden);

    if (video.canPlayType(HLS_MIME)) {
      native = true;
      playNative(from);
    } else {
      import("hls.js")
        .then(({ default: H }) => {
          if (!alive) return;
          if (!H.isSupported()) {
            setProblem(UNSUPPORTED);
            return;
          }
          const attach = (at: number, autoLoad: boolean) => {
            const h = new H({ autoStartLoad: autoLoad, startPosition: at > 0 ? at : -1, capLevelToPlayerSize: true });
            loading = autoLoad;
            h.on(H.Events.ERROR, (_event, data) => {
              if (!alive || !data.fatal) return;
              if (data.type === H.ErrorTypes.MEDIA_ERROR && mediaFixes < 2) {
                mediaFixes++;
                rolling = false;
                h.recoverMediaError();
                return;
              }
              if (data.type === H.ErrorTypes.NETWORK_ERROR && everPlayed && reloads < MAX_RELOADS) {
                reloads++;
                const wasPlaying = !video.paused;
                rolling = false;
                h.destroy();
                attach(here, true);
                if (wasPlaying) video.play().catch(() => {});
                return;
              }
              fail();
            });
            h.loadSource(src);
            h.attachMedia(video);
            hls = h;
          };
          attach(from, !video.paused);
        })
        .catch(fail);
    }

    return () => {
      if (!video.paused) save();
      alive = false;
      if (trailing) clearTimeout(trailing);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("emptied", onEmptied);
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("pause", save);
      video.removeEventListener("ended", save);
      video.removeEventListener("error", onError);
      document.removeEventListener("visibilitychange", onHidden);
      rolling = false;
      if (hls) hls.destroy();
      else if (native) {
        video.removeAttribute("src");
        video.load();
      }
    };
  }, [src, lessonId, attempt]);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-line bg-black">
      <video ref={ref} controls playsInline preload="none" controlsList="nodownload" poster={poster ?? undefined} aria-label="Lesson video" inert={problem !== null} className="h-full w-full object-contain">
        Your browser can&apos;t play this video.
      </video>
      {problem && (
        <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-panel/95 p-6 text-center text-sm text-ink">
          <p className="max-w-sm">{problem.text}</p>
          {problem.retry && (
            <button
              type="button"
              onClick={() => {
                setProblem(null);
                setAttempt((n) => n + 1);
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-line-strong bg-panel-2 px-3 py-1.5 text-sm font-medium text-ink transition hover:bg-panel-3"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
                <path d="M21 3v5h-5" />
              </svg>
              Try again
            </button>
          )}
        </div>
      )}
      <p role="status" aria-live="polite" className="sr-only">
        {announce}
      </p>
    </div>
  );
}
