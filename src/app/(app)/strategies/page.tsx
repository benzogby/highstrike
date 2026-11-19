import type { Metadata } from "next";
import Link from "next/link";
import { requireMember } from "@/lib/membership";
import { CARD, PageHeader } from "@/components/ui";
import { TEMPLATES } from "@/lib/strategies/templates";
import { cleanSpec, entryText, type Spec } from "@/lib/strategies/spec";

export const metadata: Metadata = { title: "Strategies — HighStrike" };

/**
 * Strategies (Ben, 2026-11-19, docs/plans/strategies.md): a member's own entry and exit rules, and ready-made ones to
 * start from. Each opens in the editor, where it's backtested on any stock's history.
 */
export default async function StrategiesPage() {
  const { supabase, user } = await requireMember("/strategies");
  const { data } = await supabase.from("strategies").select("id, name, rules, ticker, updated_at").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(100);
  const mine = (data ?? []).flatMap((r) => {
    const spec = cleanSpec(r.rules);
    return spec ? [{ id: r.id as string, name: r.name as string, spec, ticker: r.ticker as string }] : [];
  });

  const card = (href: string, name: string, rules: Spec, note: string) => (
    <Link key={href} href={href} className={`${CARD} group flex flex-col p-4 transition hover:border-line-strong hover:bg-panel-2/40`}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[15px] font-medium text-ink group-hover:text-accent">{name}</h3>
        <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${rules.direction === "long" ? "bg-up-soft text-up" : "bg-down-soft text-down"}`}>
          {rules.contract.kind === "shares" ? (rules.direction === "long" ? "Shares" : "Short") : rules.contract.kind === "spread" ? (rules.direction === "long" ? "Call spread" : "Put spread") : rules.direction === "long" ? "Calls" : "Puts"}
        </span>
      </div>
      <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">{note}</p>
      <p className="mt-auto pt-3 font-mono text-[11.5px] leading-relaxed text-ink-3">If {entryText(rules)}</p>
    </Link>
  );

  return (
    <>
      <PageHeader
        title="Strategies"
        subtitle="Entry and exit rules from indicators and price action, backtested on years of history."
        actions={
          <Link href="/strategies/new" className="inline-flex h-9 items-center rounded-lg bg-accent px-3.5 text-sm font-semibold text-on-accent shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_2px_0_#148a60]">
            New strategy
          </Link>
        }
      />

      {mine.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-[15px] text-ink">Yours</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {mine.map((s) => card(`/strategies/${s.id}`, s.name, s.spec, `Last tested on ${s.ticker}`))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="font-display text-[15px] text-ink">Start from a classic</h2>
        <p className="mt-0.5 text-[13px] text-ink-3">Open one to backtest it on any stock, change the rules, and save your own copy.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{TEMPLATES.map((t) => card(`/strategies/new?template=${t.key}`, t.name, t.spec, t.blurb))}</div>
      </section>
    </>
  );
}
