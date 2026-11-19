import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMember } from "@/lib/membership";
import { PageHeader } from "@/components/ui";
import { DEFAULT_CONTRACT, cleanSpec, on, type Spec } from "@/lib/strategies/spec";
import { templateByKey } from "@/lib/strategies/templates";
import StrategyEditor, { type SignalRow } from "../StrategyEditor";
import type { KeptBacktest, LiveSettings } from "../actions";
import type { Period } from "@/lib/strategies/backtest";

export const metadata: Metadata = { title: "Strategy — HighStrike" };

const BLANK: Spec = {
  version: 2,
  direction: "long",
  entry: { criteria: on("entry", [["aboveMA", { n: 50 }]]), custom: [] },
  contract: DEFAULT_CONTRACT,
  exit: { mode: "any", criteria: on("exit", [["x-stockGain", { x: 8 }], ["x-days", { x: 20 }]]), custom: [] },
  stop: { mode: "any", criteria: on("stop", [["s-stockLoss", { x: 4 }]]), custom: [] },
};

/** One strategy in the editor: /strategies/new (blank, or ?template=key), or a saved one by its id. */
export default async function StrategyPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ template?: string; t?: string }> }) {
  const { supabase, user } = await requireMember("/strategies");
  const { id } = await params;
  const { template, t: wantTicker } = await searchParams;
  const asked = wantTicker && /^[A-Z][A-Z0-9.]{0,7}$/.test(wantTicker.toUpperCase()) ? wantTicker.toUpperCase() : null;

  let start: { id: string | null; name: string; rules: Spec; ticker: string; template: string | null };
  let settings: LiveSettings = { watch: [], live: false, alerts: true, autoTrade: false };
  let signals: SignalRow[] = [];
  if (id === "new") {
    const t = template ? templateByKey(template) : null;
    start = { id: null, name: t?.name ?? "My strategy", rules: t?.spec ?? BLANK, ticker: asked ?? "SPY", template: t?.key ?? null };
  } else {
    if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
    const { data } = await supabase.from("strategies").select("id, name, rules, ticker, template, watch, live, alerts, auto_trade").eq("id", id).eq("user_id", user.id).maybeSingle();
    const rules = data ? cleanSpec(data.rules) : null;
    if (!data || !rules) notFound();
    start = { id: data.id, name: data.name, rules, ticker: asked ?? data.ticker, template: data.template };
    settings = { watch: data.watch ?? [], live: data.live, alerts: data.alerts, autoTrade: data.auto_trade };
    const { data: sigs } = await supabase
      .from("strategy_signals")
      .select("id, ticker, day, fired_at, price, symbol, qty, status, note, exit_reason, exit_price")
      .eq("strategy_id", data.id)
      .order("fired_at", { ascending: false })
      .limit(20);
    signals = (sigs ?? []) as SignalRow[];
  }

  // This member's last backtest of it (theirs alone, by row-level security).
  const ref = start.id ?? (start.template ? `template:${start.template}` : "new");
  const { data: kept } = await supabase.from("strategy_backtests").select("ticker, period, run_key, news_from, result").eq("user_id", user.id).eq("ref", ref).maybeSingle();
  const lastRun: KeptBacktest | null = kept
    ? { ticker: kept.ticker, period: kept.period as Period, runKey: kept.run_key, newsFrom: kept.news_from, result: kept.result as KeptBacktest["result"] }
    : null;

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
        <StrategyEditor id={start.id} initialName={start.name} initialRules={start.rules} initialTicker={start.ticker} template={start.template} userId={user.id} initialSettings={settings} signals={signals} backtestRef={ref} lastRun={lastRun} />
      </div>
    </>
  );
}
