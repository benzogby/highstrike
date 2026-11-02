import Link from "next/link";
import { clock, lessonHref, type LessonState } from "@/lib/education";

/** Where a lesson stands, in words, for a screen reader (the row's marks carry it on screen). */
function statusWords(state: LessonState): string {
  if (state.done) return "Done";
  if (state.kind === "video") return state.durationSec ? `Video, ${clock(state.durationSec)}` : "Video";
  if (state.kind === "youtube") return "YouTube video";
  if (state.kind === "processing") return "Video on its way";
  return "Notes";
}

function Status({ state }: { state: LessonState }) {
  if (state.done) {
    return (
      <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-accent text-bg">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </span>
    );
  }
  if (state.kind === "video" || state.kind === "processing") {
    return (
      <span className="flex shrink-0 items-center gap-1 font-mono-nums text-[11px] text-ink-3">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M10 8.5l5 3.5-5 3.5z" fill="currentColor" stroke="none" />
        </svg>
        {state.durationSec ? clock(state.durationSec) : ""}
      </span>
    );
  }
  if (state.kind === "youtube") return <span className="shrink-0 text-[11px] text-ink-3">YouTube</span>;
  return <span className="shrink-0 text-[11px] text-ink-3">Notes</span>;
}

/**
 * One lesson in its module's panel: its number in the module, its title and its status on the right. The whole row is
 * the link, and its label says the status in words; `current` marks the lesson being watched.
 */
export default function LessonRow({ id, number, title, state, current }: { id: string; number: number; title: string; state: LessonState; current: boolean }) {
  return (
    <Link
      href={lessonHref(id)}
      aria-current={current ? "page" : undefined}
      aria-label={`Lesson ${number}: ${title}. ${statusWords(state)}.`}
      className={`relative flex items-center gap-2.5 px-3 py-2 outline-none transition hover:bg-panel-2 focus-visible:bg-panel-2 ${
        current ? "bg-panel-2 before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-accent" : ""
      }`}
    >
      <span aria-hidden="true" className="inline-flex h-5 min-w-7 shrink-0 items-center justify-center rounded-md border border-line bg-panel-2 px-1 font-mono-nums text-[11px] text-ink-3">
        {String(number).padStart(2, "0")}
      </span>
      <span aria-hidden="true" className={`line-clamp-2 min-w-0 flex-1 text-[13px] leading-snug ${current ? "font-semibold text-ink" : "text-ink-2"}`}>
        {title}
      </span>
      <span aria-hidden="true" className="flex shrink-0 items-center">
        <Status state={state} />
      </span>
    </Link>
  );
}
