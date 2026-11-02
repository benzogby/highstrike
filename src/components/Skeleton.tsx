import { CARD } from "@/components/ui";

// Loading placeholders (Ben, 2026-11-02: "add lazy loading animations and make it lightning fast"). Each route's
// loading.tsx draws its page's shape in shimmering bones; Next shows it the moment a tab is clicked (it's prefetched
// with the link) while the page itself is made on the server, then swaps the page in. The frame around it stays put.

/** Widths that vary row to row, so a placeholder list reads as content rather than stripes. */
const WIDTHS = ["w-24", "w-32", "w-20", "w-28", "w-36", "w-16", "w-24", "w-32"];

/** One shimmering bone. */
export function Bone({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`skeleton block rounded-md ${className}`} />;
}

/** A page's placeholder: announced as loading, and faded in only once the wait is long enough to notice. */
export function SkeletonPage({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="skeleton-in" role="status" aria-label={`Loading ${label}`}>
      {children}
    </div>
  );
}

/** A page title, its grey line, and an action's place on the right. */
export function HeaderBones({ action = false }: { action?: boolean }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div>
        <Bone className="h-7 w-56 max-w-[70vw]" />
        <Bone className="mt-3 h-4 w-40" />
      </div>
      {action && <Bone className="hidden h-9 w-28 rounded-lg sm:block" />}
    </div>
  );
}

/** A section title over what follows. */
export function TitleBone({ className = "" }: { className?: string }) {
  return <Bone className={`h-4 w-32 ${className}`} />;
}

/** A row of figure cards. */
export function StatBones({ count = 4, tall = false }: { count?: number; tall?: boolean }) {
  return (
    <div className={`grid gap-3 sm:grid-cols-2 ${count >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={`${CARD} px-4 py-3.5`}>
          <Bone className="h-3.5 w-24" />
          <Bone className={tall ? "mx-auto mt-5 h-14 w-28 rounded-t-full" : "mt-3 h-7 w-16"} />
        </div>
      ))}
    </div>
  );
}

/** A table in its card: a header row, then rows whose cells vary in width. */
export function TableBones({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className={`overflow-hidden ${CARD}`}>
      <div className="flex items-center gap-6 border-b border-line px-4 py-3">
        {Array.from({ length: cols }, (_, c) => (
          <Bone key={c} className={`h-3 ${c === 0 ? "w-20" : "ml-auto w-14 max-sm:hidden"}`} />
        ))}
      </div>
      <div className="divide-y divide-line">
        {Array.from({ length: rows }, (_, r) => (
          <div key={r} className="flex items-center gap-6 px-4 py-3">
            <Bone className="h-4 w-14" />
            <Bone className={`h-3.5 ${WIDTHS[r % WIDTHS.length]}`} />
            {Array.from({ length: Math.max(0, cols - 2) }, (_, c) => (
              <Bone key={c} className={`h-3.5 w-12 ${c === 0 ? "ml-auto" : ""} ${c > 0 ? "max-sm:hidden" : ""}`} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** A grid of cards, each a title, a tag and a few lines. */
export function CardBones({ count = 6, columns = "sm:grid-cols-2 lg:grid-cols-3", tall = false }: { count?: number; columns?: string; tall?: boolean }) {
  return (
    <div className={`grid gap-4 ${columns}`}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={`${CARD} p-5`}>
          {tall && <Bone className="-mx-1 -mt-1 mb-4 aspect-video w-[calc(100%+0.5rem)] rounded-lg" />}
          <div className="flex items-center justify-between">
            <Bone className={`h-5 ${WIDTHS[(i + 2) % WIDTHS.length]}`} />
            <Bone className="h-4 w-12" />
          </div>
          <Bone className="mt-4 h-3.5 w-full" />
          <Bone className="mt-2 h-3.5 w-4/5" />
          <Bone className="mt-2 h-3.5 w-3/5" />
        </div>
      ))}
    </div>
  );
}

/** A form in its card: a heading, then labelled fields and a button. */
export function FormBones({ fields = 3 }: { fields?: number }) {
  return (
    <div className={`${CARD} p-6`}>
      <TitleBone />
      <Bone className="mt-2 h-3.5 w-56 max-w-full" />
      <div className="mt-6 space-y-5">
        {Array.from({ length: fields }, (_, i) => (
          <div key={i}>
            <Bone className="h-3.5 w-20" />
            <Bone className="mt-2 h-9 w-full rounded-lg" />
          </div>
        ))}
      </div>
      <Bone className="ml-auto mt-6 h-9 w-28 rounded-lg" />
    </div>
  );
}
