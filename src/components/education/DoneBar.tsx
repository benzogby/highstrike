/** A thin bar with "3 of 22 done": the module cards and the lesson page's panel read it the same. */
export default function DoneBar({ done, total, className = "" }: { done: number; total: number; className?: string }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className={className} role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-valuetext={`${done} of ${total} lessons done`}>
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="font-medium text-ink-2">Progress</span>
        <span className="font-mono-nums text-ink-3">
          {done} of {total} done
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-panel-2">
        <div className="h-full rounded-full bg-accent transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
