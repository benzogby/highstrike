import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMember } from "@/lib/membership";
import { PageHeader } from "@/components/ui";
import { cleanRules, type Rules } from "@/lib/strategies/rules";
import { templateByKey } from "@/lib/strategies/templates";
import StrategyEditor from "../StrategyEditor";

export const metadata: Metadata = { title: "Strategy — HighStrike" };

const BLANK: Rules = {
  direction: "long",
  entry: [{ left: { kind: "close" }, op: "crossesAbove", right: { kind: "sma", n: 50 } }],
  exit: [],
  targetPct: 8,
  stopPct: 4,
  maxDays: 20,
  option: { dte: 30, delta: 0.4 },
};

/** One strategy in the editor: /strategies/new (blank, or ?template=key), or a saved one by its id. */
export default async function StrategyPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ template?: string }> }) {
  const { supabase, user } = await requireMember("/strategies");
  const { id } = await params;
  const { template } = await searchParams;

  let start: { id: string | null; name: string; rules: Rules; ticker: string; template: string | null };
  if (id === "new") {
    const t = template ? templateByKey(template) : null;
    start = { id: null, name: t?.name ?? "My strategy", rules: t?.rules ?? BLANK, ticker: "SPY", template: t?.key ?? null };
  } else {
    if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
    const { data } = await supabase.from("strategies").select("id, name, rules, ticker, template").eq("id", id).eq("user_id", user.id).maybeSingle();
    const rules = data ? cleanRules(data.rules) : null;
    if (!data || !rules) notFound();
    start = { id: data.id, name: data.name, rules, ticker: data.ticker, template: data.template };
  }

  return (
    <>
      <PageHeader
        title={start.id ? start.name : start.template ? `${start.name}` : "New strategy"}
        subtitle={
          <>
            <Link href="/strategies" className="text-accent hover:underline">
              Strategies
            </Link>{" "}
            · {start.template && !start.id ? "A classic to start from: run it, change it, save your copy." : "Build the rules, then run the backtest."}
          </>
        }
      />
      <div className="mt-6">
        <StrategyEditor id={start.id} initialName={start.name} initialRules={start.rules} initialTicker={start.ticker} template={start.template} userId={user.id} />
      </div>
    </>
  );
}
