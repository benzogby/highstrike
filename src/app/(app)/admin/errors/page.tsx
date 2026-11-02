import { Badge, CARD } from "@/components/ui";
import { DATE, TIME, daysAgo, requireAdmin } from "@/lib/adminGate";
import { supabaseService } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const metadata = { title: "Errors — Admin — HighStrike" };

type Row = { id: number; source: string; message: string; stack: string | null; path: string | null; digest: string | null; created_at: string };

/**
 * Admin → Errors (from getripping.com's): everything pages, routes and browsers reported in the last 7 days
 * (src/instrumentation.ts, src/app/error.tsx), grouped by message, the most frequent first, with the latest stack.
 */
export default async function AdminErrorsPage() {
  await requireAdmin();
  const since = daysAgo(7);
  const db = supabaseService();
  const [{ data, error }, { count }] = await Promise.all([
    db.from("error_reports").select("id, source, message, stack, path, digest, created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(1000),
    db.from("error_reports").select("id", { count: "exact", head: true }).gte("created_at", since),
  ]);
  const rows = (error ? [] : (data ?? [])) as Row[];
  const groups = new Map<string, { latest: Row; count: number; paths: Set<string> }>();
  for (const r of rows) {
    const k = `${r.source}|${r.message.slice(0, 160)}`;
    const g = groups.get(k);
    if (g) {
      g.count++;
      if (r.path) g.paths.add(r.path);
    } else groups.set(k, { latest: r, count: 1, paths: new Set(r.path ? [r.path] : []) });
  }
  const list = [...groups.values()].sort((a, b) => b.count - a.count);
  const total = Math.max(rows.length, count ?? 0);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-2">
        {total === 0 ? "No errors in the last 7 days." : `${total} ${total === 1 ? "error" : "errors"} in the last 7 days, in ${list.length} ${list.length === 1 ? "kind" : "kinds"}, the most frequent first.`}
      </p>
      {error && <p className="rounded-lg border border-down/30 bg-down-soft px-3 py-2 text-sm text-down">The errors couldn&apos;t be read: {error.message}</p>}
      {list.map(({ latest: r, count: n, paths }) => (
        <details key={r.id} className={`${CARD} group`}>
          <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 px-4 py-3">
            <Badge tone="down">{n}×</Badge>
            <Badge>{r.source}</Badge>
            <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-ink">{r.message}</span>
            <span className="whitespace-nowrap text-xs text-ink-3">
              Last {DATE.format(new Date(r.created_at))}, {TIME.format(new Date(r.created_at))}
            </span>
          </summary>
          <div className="border-t border-line px-4 py-3 text-xs">
            {paths.size > 0 && <p className="text-ink-2">On: {[...paths].slice(0, 8).join(", ")}</p>}
            {r.digest && <p className="mt-1 text-ink-3">Digest {r.digest}</p>}
            {r.stack && <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-bg p-3 font-mono text-[11px] leading-relaxed text-ink-2">{r.stack}</pre>}
          </div>
        </details>
      ))}
    </div>
  );
}
