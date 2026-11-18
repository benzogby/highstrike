/** Admin → Inbox while Gmail answers: the search bar, the rail and the list's lines, where they'll be. */
export default function Loading() {
  return (
    <div className="flex min-h-[calc(100dvh-9rem)] flex-col gap-2 md:h-full md:min-h-0">
      <div className="flex items-center gap-2"><span className="skeleton size-8 rounded-full" /><span className="skeleton h-11 flex-1 rounded-full md:max-w-3xl" /></div>
      <div className="flex min-h-0 flex-1 gap-2">
        <div className="hidden w-56 shrink-0 flex-col gap-2 md:flex">
          <span className="skeleton mb-2 h-12 w-36 rounded-2xl" />
          {Array.from({ length: 8 }, (_, i) => <span key={i} className="skeleton h-7 rounded-full" />)}
        </div>
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border bg-card">
          <div className="h-12 border-b" />
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} className="flex h-10 items-center gap-3 border-b px-4">
              <span className="skeleton size-4 rounded" /><span className="skeleton h-3 w-36 rounded" /><span className="skeleton h-3 flex-1 rounded" /><span className="skeleton h-3 w-12 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
