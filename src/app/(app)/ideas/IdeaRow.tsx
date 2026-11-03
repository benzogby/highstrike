import Link from "next/link";
import { Badge } from "@/components/ui";
import { SOURCES, STATUS, STYLES, headlineOf, type Idea } from "@/lib/ideas";

const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** One idea in the feed: its line (ticker, side, headline, source, entry to target, how it's doing), opening to the why and the entry rules. */
export default function IdeaRow({ idea: i }: { idea: Idea }) {
  const st = STATUS[i.status] ?? STATUS.open;
  const pct = i.status === "open" ? i.current_pct : i.result_pct;
  return (
    <li>
      <details className="group">
        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 hover:bg-panel-2 sm:flex-nowrap">
          <span className="flex w-28 shrink-0 items-center gap-2">
            <span className="font-mono-nums text-[15px] font-semibold text-ink">{i.ticker}</span>
            <Badge tone={i.direction === "long" ? "up" : "down"}>{i.direction === "long" ? "Long" : "Short"}</Badge>
          </span>
          <Link href={`/ideas/${i.id}`} className="min-w-0 flex-1 basis-full text-sm text-ink hover:text-accent hover:underline sm:basis-auto">
            {headlineOf(i)}
          </Link>
          <span className="flex shrink-0 items-center gap-1.5">
            <Badge>{STYLES[i.style] ?? i.style}</Badge>
            <Badge tone="accent">{SOURCES[i.source] ?? i.source}</Badge>
          </span>
          <span className="w-40 shrink-0 text-right font-mono-nums text-[13px] text-ink-2">
            {i.entry_price != null ? money(i.entry_price) : "—"} → {i.target_price != null ? money(i.target_price) : i.price_target}
          </span>
          <span className="flex w-28 shrink-0 items-center justify-end gap-2">
            {pct != null && <span className={`font-mono-nums text-[13px] ${pct >= 0 ? "text-up" : "text-down"}`}>{`${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`}</span>}
            <Badge tone={st.tone}>{st.label}</Badge>
          </span>
        </summary>
        <div className="grid gap-4 border-t border-line bg-bg/40 px-4 py-4 text-sm sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div>
            <p className="text-[13px] font-medium text-ink">Why</p>
            <p className="mt-1 leading-relaxed text-ink-2">{i.justification}</p>
          </div>
          <div>
            <p className="text-[13px] font-medium text-ink">When to get in</p>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-ink-2">
              {i.entry_criteria.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <p className="mt-3 text-ink-3">
              Target {i.price_target} · {i.time_frame}
            </p>
            <Link href={`/ideas/${i.id}`} className="mt-3 inline-block text-[13px] font-medium text-accent hover:underline">
              Open the idea: bull vs bear, quick answers, sizing →
            </Link>
          </div>
        </div>
      </details>
    </li>
  );
}
