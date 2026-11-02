"use client";

import { useOptimistic, useState, useTransition } from "react";
import { setLessonDone } from "@/app/(app)/education/actions";
import { toastError } from "@/lib/toastBus";

/**
 * Mark as done, and once it is, "Done ✓", which a second press undoes. Watching a video to 90% marks it done by itself;
 * this is for anyone who'd rather say so, and for the lessons that are YouTube videos or notes alone. The new state shows
 * at once and saves behind it; a failed save goes back and says why.
 */
export default function DoneButton({ lessonId, done }: { lessonId: string; done: boolean }) {
  const [server, setServer] = useState(done);
  const [saved, setSaved] = useState(done);
  if (server !== done) {
    setServer(done);
    setSaved(done);
  }
  const [shown, setShown] = useOptimistic(saved);
  const [, start] = useTransition();
  const [said, setSaid] = useState("");
  const toggle = () => {
    const next = !shown;
    start(async () => {
      setShown(next);
      try {
        await setLessonDone(lessonId, next);
        setSaved(next);
        setSaid(next ? "Lesson marked as done." : "Lesson marked as not done.");
      } catch (err) {
        toastError(err instanceof Error ? err.message : "Couldn't save that. Try again.");
      }
    });
  };
  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-label={shown ? "Done. Mark as not done" : undefined}
        className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 font-display text-sm font-semibold transition ${
          shown ? "border border-line-strong bg-panel-2 text-ink hover:border-accent/50" : "bg-accent text-bg hover:bg-accent-2"
        }`}
      >
        {shown ? (
          <>
            Done
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </>
        ) : (
          "Mark as done"
        )}
      </button>
      <span role="status" className="sr-only">
        {said}
      </span>
    </>
  );
}
