import Link from "next/link";
import DoneBar from "@/components/education/DoneBar";
import { hours, lessonHref, moduleAnchor, moduleLabel, plural, type Lesson, type LessonStates, type Module } from "@/lib/education";
import { PageHeader } from "@/components/ui";

/** Where "Continue" goes in a module: its first lesson not done yet, else its first. */
function continueLesson(lessons: Lesson[], states: LessonStates): Lesson | undefined {
  return lessons.find((l) => !states[l.id]?.done) ?? lessons[0];
}

/**
 * One module, Skool-style: what it is, how many lessons and how much video, the member's progress, and a button into its
 * lesson panel at the lesson to pick up next.
 */
function ModuleCard({ module: m, lessons, states, index }: { module: Module; lessons: Lesson[]; states: LessonStates; index: number }) {
  const { eyebrow, name } = moduleLabel(m.title);
  const seconds = lessons.reduce((t, l) => t + (states[l.id]?.durationSec ?? 0), 0);
  const youtube = lessons.filter((l) => states[l.id]?.kind === "youtube").length;
  const done = lessons.filter((l) => states[l.id]?.done).length;
  const going = lessons.some((l) => states[l.id]?.done || (states[l.id]?.positionSec ?? 0) > 0);
  const next = continueLesson(lessons, states);
  const id = moduleAnchor(m.position);
  const facts = [plural(lessons.length, "lesson"), seconds > 0 ? `${hours(seconds)} of video` : null, youtube > 0 && seconds === 0 ? "YouTube videos" : null].filter(Boolean).join(" · ");
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="anim-rise flex scroll-mt-20 flex-col rounded-xl border border-line bg-panel p-5"
      style={{ "--rise-delay": `${Math.min(index, 8) * 40}ms` } as React.CSSProperties}
    >
      <p className="text-xs font-medium text-accent-ink">{eyebrow}</p>
      <h2 id={`${id}-title`} className="mt-1 font-display text-lg leading-snug text-ink">
        {name}
      </h2>
      <p className="mt-2 font-mono-nums text-xs text-ink-3">{facts}</p>
      <div className="mt-auto pt-5">
        <DoneBar done={done} total={lessons.length} />
        {next && (
          <Link
            href={lessonHref(next.id)}
            aria-label={`${going ? "Continue" : "Start"} ${eyebrow}: ${name}`}
            className={`mt-4 flex h-9 w-full items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition ${
              going ? "bg-accent text-on-accent hover:bg-accent-2" : "border border-line bg-panel text-ink hover:bg-panel-2"
            }`}
          >
            {going ? "Continue" : "Start"}
            <span aria-hidden="true">→</span>
          </Link>
        )}
      </div>
    </section>
  );
}

/**
 * /education: HighStrike Trading School, laid out like getripping.com's Ripping University: one card per module (each
 * a chapter of the course), three across on wide screens. A card opens its module's lesson
 * panel. Renders from its props alone, so a preview can draw it from a snapshot.
 */
export default function LibraryView({ modules, lessons, states }: { modules: Module[]; lessons: Lesson[]; states: LessonStates }) {
  const byModule = new Map(modules.map((m) => [m.id, lessons.filter((l) => l.moduleId === m.id)]));
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        className="anim-rise"
        title="HighStrike Trading School"
        subtitle={`${modules.length} modules and ${lessons.length} lessons, from setting up your trading station to options, smart money concepts and selling options, with the bonus modules and every live recording. Your progress saves as you go.`}
      />
      {modules.length === 0 ? (
        <p className="mt-10 rounded-xl border border-line bg-panel px-5 py-10 text-center text-sm text-ink-3">The library is being set up. Check back shortly.</p>
      ) : (
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {modules.map((m, i) => (
            <ModuleCard key={m.id} module={m} lessons={byModule.get(m.id) ?? []} states={states} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
