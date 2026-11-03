import type { Metadata } from "next";
import Link from "next/link";
import { requireMember } from "@/lib/membership";
import { CARD, INPUT } from "@/components/ui";
import { IDEA_COLUMNS, SOURCES, STYLES, ideasSince, type Idea, type Source, type Style } from "@/lib/ideas";
import IdeaRow from "../IdeaRow";

export const metadata: Metadata = { title: "Ideas — HighStrike" };

type Filters = { source?: string; style?: string; side?: string; show?: string; q?: string };

const DAY = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric" });

/**
 * The idea feed, HighStrike's hero (Ben, 2026-11-02: "Yes, start the feed"): every trade idea from every source in one
 * list, newest first, filtered by source, style, side and ticker. Open ideas by default; the last 30 days. Ideas' first
 * tab; the header, its buttons and the tabs are the layout's.
 */
export default async function IdeasPage({ searchParams }: { searchParams: Promise<Filters> }) {
  const { supabase } = await requireMember("/ideas");
  const f = await searchParams;
  const source = f.source && f.source in SOURCES ? (f.source as Source) : null;
  const style = f.style && f.style in STYLES ? (f.style as Style) : null;
  const side = f.side === "long" || f.side === "short" ? f.side : null;
  const show = f.show === "all" || f.show === "closed" ? f.show : "open";
  const q = (f.q ?? "").trim().toUpperCase().replace(/[^A-Z.]/g, "").slice(0, 8);

  const since = ideasSince(30);
  let query = supabase.from("setups").select(IDEA_COLUMNS).gte("report_date", since).order("report_date", { ascending: false }).order("flow_score", { ascending: false }).limit(300);
  if (source) query = query.eq("source", source);
  if (style) query = query.eq("style", style);
  if (side) query = query.eq("direction", side);
  if (show === "open") query = query.eq("status", "open");
  if (show === "closed") query = query.neq("status", "open");
  if (q) query = query.ilike("ticker", `${q}%`);
  const [{ data, error }, { data: sourceRows }] = await Promise.all([query, supabase.from("setups").select("source").gte("report_date", since).limit(2000)]);
  const ideas = (data ?? []) as Idea[];
  const live = new Set(((sourceRows ?? []) as { source: Source }[]).map((r) => r.source));

  const byDay = new Map<string, Idea[]>();
  for (const i of ideas) byDay.set(i.report_date, [...(byDay.get(i.report_date) ?? []), i]);

  const link = (patch: Partial<Filters>) => {
    const next = { ...(source ? { source } : {}), ...(style ? { style } : {}), ...(side ? { side } : {}), ...(show !== "open" ? { show } : {}), ...(q ? { q } : {}), ...patch };
    const qs = new URLSearchParams(Object.entries(next).filter(([, v]) => v) as [string, string][]).toString();
    return qs ? `/ideas?${qs}` : "/ideas";
  };
  const chip = (on: boolean) =>
    `whitespace-nowrap rounded-md px-2.5 py-1 text-[13px] font-medium transition ${on ? "bg-panel-2 text-ink ring-1 ring-inset ring-line-strong" : "text-ink-3 hover:text-ink"}`;

  return (
    <>
      <div className="mt-5 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <form action="/ideas" className="w-40">
            {Object.entries({ source, style, side, show: show !== "open" ? show : null }).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
            <input name="q" defaultValue={q} placeholder="Ticker" aria-label="Filter by ticker" className={`${INPUT} font-mono-nums uppercase`} />
          </form>
          <nav aria-label="Show" className="flex gap-1">
            {(["open", "closed", "all"] as const).map((s) => (
              <Link key={s} href={link({ show: s === "open" ? undefined : s })} className={chip(show === s)}>
                {s === "open" ? "Open" : s === "closed" ? "Closed" : "All"}
              </Link>
            ))}
          </nav>
          <nav aria-label="Side" className="flex gap-1">
            <Link href={link({ side: undefined })} className={chip(!side)}>Long and short</Link>
            <Link href={link({ side: "long" })} className={chip(side === "long")}>Long</Link>
            <Link href={link({ side: "short" })} className={chip(side === "short")}>Short</Link>
          </nav>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <Link href={link({ source: undefined })} className={chip(!source)}>Every source</Link>
          {(Object.keys(SOURCES) as Source[])
            .filter((s) => live.has(s) || s === source)
            .map((s) => (
              <Link key={s} href={link({ source: s })} className={chip(source === s)}>
                {SOURCES[s]}
              </Link>
            ))}
          <span className="mx-2 h-4 w-px bg-line" aria-hidden="true" />
          <Link href={link({ style: undefined })} className={chip(!style)}>Any style</Link>
          {(Object.keys(STYLES) as Style[]).map((s) => (
            <Link key={s} href={link({ style: s })} className={chip(style === s)}>
              {STYLES[s]}
            </Link>
          ))}
        </div>
      </div>

      {error && <p className="mt-6 rounded-lg border border-down/30 bg-down-soft px-3 py-2 text-sm text-down">The ideas couldn&apos;t load: {error.message}</p>}
      {!error && ideas.length === 0 && (
        <p className={`${CARD} mt-8 px-5 py-10 text-center text-sm text-ink-3`}>
          No ideas match. {show === "open" ? "Try Closed or All, or another filter." : "Try another filter."}
        </p>
      )}

      {[...byDay.entries()].map(([day, list]) => (
        <section key={day} className="mt-8">
          <h2 className="text-sm font-medium text-ink">
            {DAY.format(new Date(`${day}T12:00:00Z`))} <span className="text-ink-3">· {list.length} {list.length === 1 ? "idea" : "ideas"}</span>
          </h2>
          <ul className={`${CARD} mt-3 divide-y divide-line`}>
            {list.map((i) => (
              <IdeaRow key={i.id} idea={i} />
            ))}
          </ul>
        </section>
      ))}

      <p className="mt-10 text-xs leading-relaxed text-ink-3">
        Ideas are market commentary, not investment advice. Every idea is followed to its target, a stop (an 8% move against it) or its expiry.
      </p>
    </>
  );
}
