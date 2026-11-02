import Link from "next/link";
import DoneBar from "@/components/education/DoneBar";
import DoneButton from "@/components/education/DoneButton";
import KeepInView from "@/components/education/KeepInView";
import LessonPlayer from "@/components/education/LessonPlayer";
import LessonRow from "@/components/education/LessonRow";
import Notes from "@/components/education/Notes";
import YouTubeEmbed from "@/components/education/YouTubeEmbed";
import { lessonHref, moduleAnchor, moduleLabel, streamSrc, type Lesson, type LessonStates, type Module } from "@/lib/education";

export type LessonViewProps = {
  lesson: Lesson;
  module: Module;
  /** The lesson's module, its lessons in order. */
  moduleLessons: Lesson[];
  states: LessonStates;
  prev: Lesson | null;
  next: Lesson | null;
  /** Our published video's length and poster, or null (a YouTube lesson, notes alone, or a video on its way). */
  video: { durationSec: number; poster: string | null } | null;
  /** The notes, as the editor's JSON document. */
  body: unknown;
  files: { name: string; bytes: number; url: string }[];
};

/** Where the player goes while the lesson's video is still being copied over: the same 16:9 frame. */
function VideoOnItsWay() {
  return (
    <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-2xl border border-line bg-panel-2 px-6 text-center">
      <p className="font-display text-base font-semibold">This video is on its way</p>
      <p className="max-w-md text-sm text-ink-3">It&apos;s being copied into HighStrike right now. Check back shortly; the notes below are ready.</p>
    </div>
  );
}

function PrevNext({ prev, next }: { prev: Lesson | null; next: Lesson | null }) {
  const cls = "inline-flex items-center gap-1.5 rounded-lg border border-line-strong px-3 py-1.5 text-sm font-semibold text-ink-2 transition hover:border-accent/50 hover:text-accent";
  return (
    <nav aria-label="Previous and next lessons" className="flex shrink-0 items-center gap-2">
      {prev && (
        <Link href={lessonHref(prev.id)} title={prev.title} aria-label={`Previous lesson, ${prev.title}`} className={cls}>
          <span aria-hidden="true">←</span> Previous
        </Link>
      )}
      {next && (
        <Link href={lessonHref(next.id)} title={next.title} aria-label={`Next lesson, ${next.title}`} className={cls}>
          Next <span aria-hidden="true">→</span>
        </Link>
      )}
    </nav>
  );
}

/**
 * /education/<lesson>: a module's lesson panel with one lesson open, as Ripping University lays it out. The breadcrumb;
 * the video (our player for the videos Whop hosted, YouTube's for the ones that were on YouTube); the lesson's place in
 * its module with Previous and Next (running on into the next module); the title, the notes and any files; Mark as done;
 * and beside it the module's lessons stacked in order, a sticky panel that scrolls inside itself on wide screens and a list
 * under the lesson on phones. Renders from its props alone, so a preview can draw it from a snapshot.
 */
export default function LessonView({ lesson, module: m, moduleLessons, states, prev, next, video, body, files }: LessonViewProps) {
  const state = states[lesson.id];
  const { eyebrow, name } = moduleLabel(m.title);
  const place = moduleLessons.findIndex((l) => l.id === lesson.id) + 1;
  return (
    <div className="mx-auto max-w-6xl">
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-1.5 text-sm text-ink-3">
          <li>
            <Link href="/education" className="rounded-sm underline-offset-4 hover:text-ink hover:underline">
              Education
            </Link>
          </li>
          <li aria-hidden="true">›</li>
          <li className="min-w-0">
            <Link href={`/education#${moduleAnchor(m.position)}`} className="truncate rounded-sm underline-offset-4 hover:text-ink hover:underline">
              {eyebrow} · {name}
            </Link>
          </li>
        </ol>
      </nav>

      <div className="mt-4 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <article className="flex min-w-0 flex-col gap-6">
          <div className="flex flex-col gap-3">
            {video ? (
              <LessonPlayer key={lesson.id} lessonId={lesson.id} src={streamSrc(lesson.id)} poster={video.poster} startAt={state?.positionSec ?? 0} durationSec={video.durationSec} completed={Boolean(state?.done)} />
            ) : lesson.youtubeId ? (
              <YouTubeEmbed id={lesson.youtubeId} title={lesson.title} />
            ) : state?.kind === "processing" ? (
              <VideoOnItsWay />
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-mono-nums text-xs uppercase tracking-wider text-ink-3">
                Lesson {place} of {moduleLessons.length}
              </p>
              <PrevNext prev={prev} next={next} />
            </div>
          </div>

          <header>
            <h1 className="font-display text-2xl font-bold sm:text-3xl">{lesson.title}</h1>
          </header>

          <Notes body={body} />

          {files.length > 0 && (
            <section aria-labelledby="lesson-files" className="max-w-3xl rounded-2xl border border-line bg-panel p-4">
              <h2 id="lesson-files" className="text-xs uppercase tracking-wider text-ink-3">
                Files
              </h2>
              <ul className="mt-2 space-y-1.5">
                {files.map((f) => (
                  <li key={f.url}>
                    <a href={f.url} className="inline-flex items-center gap-2 text-sm font-semibold text-accent underline-offset-4 hover:underline">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M12 3v12m0 0l-4.5-4.5M12 15l4.5-4.5M4 19h16" />
                      </svg>
                      {f.name}
                      <span className="font-mono-nums text-xs font-normal text-ink-3">{Math.max(1, Math.round(f.bytes / 1024))} KB</span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <DoneButton key={`done-${lesson.id}`} lessonId={lesson.id} done={Boolean(state?.done)} />
            {video && !state?.done && <p className="text-xs text-ink-3">Watching to the end marks it done too.</p>}
          </div>
        </article>

        <aside className="lg:sticky lg:top-20">
          <nav aria-labelledby="module-lessons" className="overflow-hidden rounded-2xl border border-line bg-panel">
            <div className="border-b border-line px-4 py-3">
              <p className="text-xs uppercase tracking-wider text-accent">{eyebrow}</p>
              <h2 id="module-lessons" className="mt-0.5 font-display text-sm font-bold">
                {name}
              </h2>
              <DoneBar done={moduleLessons.filter((l) => states[l.id]?.done).length} total={moduleLessons.length} className="mt-2.5" />
            </div>
            <KeepInView current={lesson.id} className="lg:max-h-[calc(100svh-14rem)] lg:overflow-y-auto">
              <ol className="divide-y divide-line">
                {moduleLessons.map((l, i) => (
                  <li key={l.id}>
                    <LessonRow id={l.id} number={i + 1} title={l.title} state={states[l.id]} current={l.id === lesson.id} />
                  </li>
                ))}
              </ol>
            </KeepInView>
          </nav>
        </aside>
      </div>
    </div>
  );
}
