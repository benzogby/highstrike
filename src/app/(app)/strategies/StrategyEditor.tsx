"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import HighStrikeChart from "@/components/chart/HighStrikeChart";
import { CARD, INPUT } from "@/components/ui";
import { OPERANDS, OPS, conditionText, type Condition, type Op, type Operand, type OperandKind, type Rules } from "@/lib/strategies/rules";
import type { Result, Trade } from "@/lib/strategies/backtest";
import { deleteStrategy, runBacktest, saveStrategy, type LiveSettings } from "./actions";

export type SignalRow = {
  id: string;
  ticker: string;
  day: string;
  fired_at: string;
  price: number;
  symbol: string | null;
  qty: number | null;
  status: "alerted" | "open" | "closed" | "failed";
  note: string | null;
  exit_reason: string | null;
  exit_price: number | null;
};

const WHEN = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** A switch: on (green) or off. */
function Toggle({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => onChange(!on)}
        className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition ${on ? "bg-accent" : "bg-panel-3 ring-1 ring-inset ring-line-strong"}`}
      >
        <span className={`absolute top-0.5 size-4 rounded-full bg-white transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
      </button>
      <span>
        <span className="block text-[13.5px] text-ink">{label}</span>
        <span className="block text-[12px] text-ink-3">{hint}</span>
      </span>
    </label>
  );
}

// The strategy editor (docs/plans/strategies.md): IF / AND / THEN blocks for the entry, exits the same way plus a
// target, a stop and a time limit, the option it trades, and a backtest on any stock's daily history with the trades
// marked on the chart.

const SELECT = "h-9 rounded-lg border border-line-strong bg-panel px-2 text-[13px] text-ink focus:border-accent focus:outline-none";
const NUM = "h-9 w-16 rounded-lg border border-line-strong bg-panel px-2 font-mono-nums text-[13px] text-ink focus:border-accent focus:outline-none";
const groups = [...new Set(OPERANDS.map((o) => o.group))];

function OperandPicker({ value, onChange }: { value: Operand; onChange: (o: Operand) => void }) {
  const spec = OPERANDS.find((o) => o.kind === value.kind)!;
  return (
    <span className="flex items-center gap-1.5">
      <select className={SELECT} value={value.kind} onChange={(e) => onChange(OPERANDS.find((o) => o.kind === (e.target.value as OperandKind))!.def)} aria-label="Value">
        {groups.map((g) => (
          <optgroup key={g} label={g}>
            {OPERANDS.filter((o) => o.group === g).map((o) => (
              <option key={o.kind} value={o.kind}>
                {o.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {spec.params?.includes("n") && "n" in value && (
        <input className={NUM} inputMode="numeric" value={value.n} onChange={(e) => onChange({ ...value, n: Math.max(1, Math.min(400, Number(e.target.value) || 1)) } as Operand)} aria-label="Bars" />
      )}
      {spec.params?.includes("value") && value.kind === "value" && (
        <input className={NUM} inputMode="decimal" value={value.value} onChange={(e) => onChange({ kind: "value", value: Number(e.target.value) || 0 })} aria-label="Number" />
      )}
    </span>
  );
}

function ConditionRow({ c, onChange, onRemove, join }: { c: Condition; onChange: (c: Condition) => void; onRemove: () => void; join: string | null }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-panel-2/60 p-2">
      {join && <span className="mr-1 w-9 text-[11px] font-semibold uppercase tracking-wide text-ink-3">{join}</span>}
      <OperandPicker value={c.left} onChange={(left) => onChange({ ...c, left })} />
      <select className={SELECT} value={c.op} onChange={(e) => onChange({ ...c, op: e.target.value as Op })} aria-label="Comparison">
        {OPS.map((o) => (
          <option key={o.op} value={o.op}>
            {o.label}
          </option>
        ))}
      </select>
      <OperandPicker value={c.right} onChange={(right) => onChange({ ...c, right })} />
      <button type="button" onClick={onRemove} className="ml-auto grid size-7 place-items-center rounded-md text-ink-3 hover:bg-down-soft hover:text-down" aria-label="Remove this rule">
        ✕
      </button>
    </div>
  );
}

const pct = (n: number | null, digits = 1) => (n == null ? "—" : `${n > 0 ? "+" : ""}${n.toFixed(digits)}%`);
const dollars = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}$${Math.abs(n).toLocaleString("en-US")}`;
const tone = (n: number | null) => (n == null || n === 0 ? "text-ink-2" : n > 0 ? "text-up" : "text-down");
const REASONS: Record<Trade["reason"], string> = { target: "Target", stop: "Stop", rule: "Exit rule", time: "Time limit", expiry: "Expiry", open: "Still open" };
const NEW_RULE: Condition = { left: { kind: "close" }, op: "above", right: { kind: "sma", n: 50 } };

function Equity({ points }: { points: { t: string; v: number }[] }) {
  if (points.length < 2) return null;
  const w = 600;
  const h = 140;
  const vals = [0, ...points.map((p) => p.v)];
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const x = (i: number) => (i / (vals.length - 1)) * w;
  const y = (v: number) => h - ((v - lo) / (hi - lo || 1)) * (h - 8) - 4;
  const d = vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const up = vals[vals.length - 1] >= 0;
  const col = up ? "var(--color-up)" : "var(--color-down)";
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-36 w-full" preserveAspectRatio="none" aria-label="Running profit or loss">
      <line x1={0} x2={w} y1={y(0)} y2={y(0)} stroke="var(--color-line-strong)" strokeDasharray="4 4" />
      <path d={`${d} L${w},${h} L0,${h} Z`} fill={col} opacity={0.12} />
      <path d={d} fill="none" stroke={col} strokeWidth={2} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default function StrategyEditor({
  id,
  initialName,
  initialRules,
  initialTicker,
  template,
  userId,
  initialSettings = { watch: [], live: false, alerts: true, autoTrade: false },
  signals = [],
}: {
  id: string | null;
  initialName: string;
  initialRules: Rules;
  initialTicker: string;
  template: string | null;
  userId: string;
  initialSettings?: LiveSettings;
  signals?: SignalRow[];
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [rules, setRules] = useState<Rules>(initialRules);
  const [ticker, setTicker] = useState(initialTicker);
  const [settings, setSettings] = useState<LiveSettings>(initialSettings);
  const [watchText, setWatchText] = useState(initialSettings.watch.join(", "));
  const setLive = (patch: Partial<LiveSettings>) => {
    setSettings((s) => ({ ...s, ...patch }));
    setSaved(null);
  };
  const [result, setResult] = useState<{ ticker: string; data: Result } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [running, startRun] = useTransition();
  const [saving, startSave] = useTransition();

  const set = (patch: Partial<Rules>) => {
    setRules((r) => ({ ...r, ...patch }));
    setSaved(null);
  };
  const run = () =>
    startRun(async () => {
      setError(null);
      const t = ticker.trim().toUpperCase();
      const r = await runBacktest({ rules, ticker: t });
      if ("error" in r) setError(r.error);
      else setResult({ ticker: t, data: r.result });
    });
  const save = () =>
    startSave(async () => {
      setError(null);
      const watch = watchText.split(/[\s,]+/).filter(Boolean);
      const r = await saveStrategy({ id, name, rules, ticker, template, settings: { ...settings, watch } });
      if ("error" in r) setError(r.error);
      else {
        setSaved("Saved");
        if (!id) router.replace(`/strategies/${r.id}`);
      }
    });
  const remove = () =>
    startSave(async () => {
      if (!id || !confirm(`Delete “${name}”?`)) return;
      const r = await deleteStrategy(id);
      if ("error" in r) setError(r.error);
      else router.push("/strategies");
    });


  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,520px)_minmax(0,1fr)]">
      {/* The rules */}
      <section className="flex flex-col gap-4">
        <div className={`${CARD} p-4`}>
          <div className="flex items-center gap-2">
            <input value={name} onChange={(e) => (setName(e.target.value), setSaved(null))} className={`${INPUT} font-medium`} aria-label="Strategy name" maxLength={80} />
          </div>
          <div className="mt-3 flex gap-1 rounded-lg bg-bg p-1" role="tablist" aria-label="Direction">
            {(["long", "short"] as const).map((d) => (
              <button
                key={d}
                type="button"
                role="tab"
                aria-selected={rules.direction === d}
                onClick={() => set({ direction: d })}
                className={`flex-1 rounded-md px-3 py-1.5 text-[13px] font-medium transition ${rules.direction === d ? (d === "long" ? "bg-up-soft text-up ring-1 ring-inset ring-up/40" : "bg-down-soft text-down ring-1 ring-inset ring-down/40") : "text-ink-3 hover:text-ink"}`}
              >
                {d === "long" ? "Bullish · buys calls" : "Bearish · buys puts"}
              </button>
            ))}
          </div>
        </div>

        <div className={`${CARD} p-4`}>
          <h2 className="text-[14px] font-medium text-ink">Enter when all of these are true</h2>
          <p className="mt-0.5 text-[12px] text-ink-3">Checked at each day&apos;s close.</p>
          <div className="mt-3 flex flex-col gap-2">
            {rules.entry.map((c, k) => (
              <ConditionRow
                key={k}
                c={c}
                join={k === 0 ? "If" : "And"}
                onChange={(n) => set({ entry: rules.entry.map((x, j) => (j === k ? n : x)) })}
                onRemove={() => set({ entry: rules.entry.filter((_, j) => j !== k) })}
              />
            ))}
          </div>
          {rules.entry.length < 8 && (
            <button type="button" onClick={() => set({ entry: [...rules.entry, NEW_RULE] })} className="mt-2 text-[13px] font-medium text-accent hover:underline">
              + Add a rule
            </button>
          )}
        </div>

        <div className={`${CARD} p-4`}>
          <h2 className="text-[14px] font-medium text-ink">Exit</h2>
          <div className="mt-3 grid grid-cols-3 gap-3">
            {(
              [
                ["targetPct", "Target", "% move"],
                ["stopPct", "Stop", "% move"],
                ["maxDays", "Time limit", "days"],
              ] as const
            ).map(([k, label, unit]) => (
              <label key={k} className="block">
                <span className="mb-1 block text-[12px] text-ink-2">{label}</span>
                <span className="flex items-center gap-1.5">
                  <input
                    className={`${NUM} w-full`}
                    inputMode="decimal"
                    value={rules[k] ?? ""}
                    placeholder="none"
                    onChange={(e) => set({ [k]: e.target.value === "" ? null : Number(e.target.value) || null } as Partial<Rules>)}
                  />
                  <span className="shrink-0 text-[12px] text-ink-3">{unit}</span>
                </span>
              </label>
            ))}
          </div>
          <p className="mt-4 text-[12px] font-medium text-ink-2">Or when any of these is true</p>
          <div className="mt-2 flex flex-col gap-2">
            {rules.exit.map((c, k) => (
              <ConditionRow
                key={k}
                c={c}
                join={k === 0 ? null : "Or"}
                onChange={(n) => set({ exit: rules.exit.map((x, j) => (j === k ? n : x)) })}
                onRemove={() => set({ exit: rules.exit.filter((_, j) => j !== k) })}
              />
            ))}
          </div>
          {rules.exit.length < 8 && (
            <button type="button" onClick={() => set({ exit: [...rules.exit, { left: { kind: "rsi", n: 14 }, op: "crossesAbove", right: { kind: "value", value: 70 } }] })} className="mt-2 text-[13px] font-medium text-accent hover:underline">
              + Add an exit rule
            </button>
          )}
        </div>

        <div className={`${CARD} p-4`}>
          <div className="flex items-center justify-between">
            <h2 className="text-[14px] font-medium text-ink">What it trades</h2>
            <label className="flex items-center gap-2 text-[12px] text-ink-2">
              <input type="checkbox" checked={rules.option != null} onChange={(e) => set({ option: e.target.checked ? { dte: 30, delta: 0.4 } : null })} className="accent-[var(--color-accent)]" />
              Options (off: shares)
            </label>
          </div>
          {rules.option ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px] text-ink-2">
              A {rules.direction === "long" ? "call" : "put"} about
              <input className={NUM} inputMode="numeric" value={rules.option.dte} onChange={(e) => set({ option: { ...rules.option!, dte: Math.max(1, Math.min(400, Number(e.target.value) || 1)) } })} aria-label="Days to expiry" />
              days out, nearest
              <input className={NUM} inputMode="decimal" value={rules.option.delta} onChange={(e) => set({ option: { ...rules.option!, delta: Math.max(0.05, Math.min(0.95, Number(e.target.value) || 0.4)) } })} aria-label="Delta" />
              delta.
            </div>
          ) : (
            <p className="mt-3 text-[13px] text-ink-2">Shares, {rules.direction === "long" ? "bought" : "sold short"} at the close.</p>
          )}
        </div>

        <div className={`${CARD} p-4`}>
          <div className="flex items-center justify-between">
            <h2 className="text-[14px] font-medium text-ink">Live</h2>
            {settings.live ? (
              <span className="flex items-center gap-1.5 rounded-md bg-up-soft px-2 py-0.5 text-[11px] font-medium text-up">
                <span className="size-1.5 rounded-full bg-up" /> Watching
              </span>
            ) : (
              <span className="text-[11px] text-ink-3">Off</span>
            )}
          </div>
          <label className="mt-3 block">
            <span className="mb-1 block text-[12px] text-ink-2">Stocks to watch (up to 25)</span>
            <input value={watchText} onChange={(e) => (setWatchText(e.target.value.toUpperCase()), setSaved(null))} placeholder="SPY, AAPL, NVDA" className={`${INPUT} font-mono-nums uppercase`} />
          </label>
          <div className="mt-4 flex flex-col gap-3">
            <Toggle on={settings.live} onChange={(v) => setLive({ live: v })} label="Switch it on" hint="Checked every 5 minutes while the market's open, on today's bar so far." />
            <Toggle on={settings.alerts} onChange={(v) => setLive({ alerts: v })} label="Alert me" hint="In the bell and by email when the entry rules are all true." />
            <Toggle
              on={settings.autoTrade}
              onChange={(v) => setLive({ autoTrade: v })}
              label="Paper-trade it by itself"
              hint={rules.option ? "Buys 1 contract its option rule picks, and closes it at the exit." : "Buys $1,000 of shares, and sells them at the exit."}
            />
          </div>
          {signals.length > 0 && (
            <div className="mt-4 border-t border-line pt-3">
              <p className="text-[12px] font-medium text-ink-2">Recent signals</p>
              <ul className="mt-2 space-y-1.5">
                {signals.map((g) => (
                  <li key={g.id} className="flex items-center justify-between gap-3 text-[12.5px]">
                    <span className="text-ink-2">
                      <b className="font-mono-nums text-ink">{g.ticker}</b> {WHEN.format(new Date(g.fired_at))} at {Number(g.price).toFixed(2)}
                    </span>
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${g.status === "open" ? "bg-accent-soft text-accent-ink" : g.status === "failed" ? "bg-down-soft text-down" : "bg-panel-2 text-ink-2"}`}
                      title={g.note ?? g.exit_reason ?? undefined}
                    >
                      {g.status === "open" ? "In a trade" : g.status === "closed" ? `Closed · ${g.exit_reason}` : g.status === "failed" ? "Didn't trade" : "Alerted"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button type="button" onClick={save} disabled={saving} className="h-10 rounded-lg bg-accent px-4 text-[14px] font-semibold text-on-accent shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_2px_0_#148a60] disabled:opacity-60">
            {saving ? "Saving…" : id ? "Save" : "Save strategy"}
          </button>
          {saved && <span className="text-[13px] text-up">{saved}</span>}
          {id && (
            <button type="button" onClick={remove} className="ml-auto text-[13px] text-ink-3 hover:text-down">
              Delete
            </button>
          )}
        </div>
      </section>

      {/* The backtest */}
      <section className="flex min-w-0 flex-col gap-4">
        <div className={`${CARD} flex flex-wrap items-center gap-2 p-4`}>
          <span className="text-[14px] font-medium text-ink">Backtest on</span>
          <input
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && run()}
            className="h-9 w-28 rounded-lg border border-line-strong bg-panel px-2.5 font-mono-nums text-[14px] uppercase text-ink focus:border-accent focus:outline-none"
            aria-label="Ticker"
          />
          <span className="text-[12px] text-ink-3">daily bars since 2016</span>
          <button type="button" onClick={run} disabled={running} className="ml-auto h-9 rounded-lg bg-accent px-4 text-[13.5px] font-semibold text-on-accent shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_2px_0_#148a60] disabled:opacity-60">
            {running ? "Running…" : "Run backtest"}
          </button>
        </div>
        {error && <p className="rounded-lg border border-down/40 bg-down-soft px-3 py-2 text-[13px] text-down">{error}</p>}

        {!result && !error && (
          <div className={`${CARD} px-5 py-12 text-center`}>
            <p className="text-sm text-ink-2">Run it to see every trade these rules would have taken.</p>
            <p className="mt-1 text-[12px] text-ink-3">
              Entry rules: {rules.entry.map(conditionText).join(" and ") || "none yet"}.
            </p>
          </div>
        )}

        {result && <BacktestResults result={result.data} ticker={result.ticker} direction={rules.direction} userId={userId} />}
        <p className="text-[12px] text-ink-3">
          New to these? <Link href="/education" className="text-accent hover:underline">Trading School</Link> covers RSI, moving averages and how options move.
        </p>
      </section>
    </div>
  );
}

/** A backtest's numbers, its running total, the chart with every entry and exit, and the trades. */
export function BacktestResults({ result, ticker, direction, userId }: { result: Result; ticker: string; direction: "long" | "short"; userId?: string }) {
  const s = result.stats;
  const markers = useMemo(
    () =>
      result.trades.flatMap((t) => {
        const win = (result.basis === "option" && t.option ? t.option.pct : t.stockPct) > 0;
        const m: { t: string; kind: "entry" | "exit"; side: "long" | "short"; win?: boolean }[] = [{ t: t.entryT, kind: "entry", side: direction }];
        if (t.exitT) m.push({ t: t.exitT, kind: "exit", side: direction, win });
        return m;
      }),
    [result, direction]
  );
  return (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(
                [
                  ["Trades", String(s.count), ""],
                  ["Win rate", s.winRate == null ? "—" : `${s.winRate}%`, ""],
                  ["Average trade", pct(s.expectancy), tone(s.expectancy)],
                  ["$1,000 a trade", dollars(s.totalDollars), tone(s.totalDollars)],
                  ["Average win", pct(s.avgWin), "text-up"],
                  ["Average loss", pct(s.avgLoss), "text-down"],
                  ["Worst drawdown", s.maxDrawdown ? `−$${s.maxDrawdown.toLocaleString("en-US")}` : "$0", s.maxDrawdown ? "text-down" : ""],
                  ["Days held", s.avgBars == null ? "—" : s.avgBars.toFixed(1), ""],
                ] as const
              ).map(([k, v, c]) => (
                <div key={k} className={`${CARD} px-3.5 py-3`}>
                  <p className="text-[11px] text-ink-3">{k}</p>
                  <p className={`mt-1 font-mono-nums text-[18px] ${c || "text-ink"}`}>{v}</p>
                </div>
              ))}
            </div>
            <p className="-mt-1 text-[11px] text-ink-3">
              {result.basis === "option"
                ? "On the option, priced from the stock's own recent swings (estimated, not real past quotes). "
                : "On the shares. "}
              {ticker}, {result.from} to {result.to}. Not a promise of future results.
            </p>

            <div className={`${CARD} p-4`}>
              <p className="text-[13px] font-medium text-ink">Running profit or loss, $1,000 a trade</p>
              <Equity points={result.equity} />
            </div>

            <div className={`${CARD} p-3`}>
              <HighStrikeChart key={ticker} ticker={ticker} userId={userId} height={360} initialTimeframe="D" markers={markers} />
            </div>

            <div className={`${CARD} overflow-x-auto`}>
              <table className="w-full min-w-[720px] text-[13px]">
                <thead className="border-b border-line text-[11px] text-ink-3">
                  <tr>
                    {["Entered", "Exited", "Why", "Stock", result.basis === "option" ? "Option" : "", "Result"].filter(Boolean).map((h, k) => (
                      <th key={h} className={`px-3 py-2.5 font-medium ${k >= 3 ? "text-right" : "text-left"}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {[...result.trades].reverse().slice(0, 100).map((t) => {
                    const r = result.basis === "option" && t.option ? t.option.pct : t.stockPct;
                    return (
                      <tr key={t.entryT}>
                        <td className="whitespace-nowrap px-3 py-2 text-ink-2">{t.entryT}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-ink-2">{t.exitT ?? "—"}</td>
                        <td className="px-3 py-2 text-ink-2">{REASONS[t.reason]}</td>
                        <td className={`px-3 py-2 text-right font-mono-nums ${tone(t.stockPct)}`}>
                          {t.entryPrice.toFixed(2)} → {t.exitPrice.toFixed(2)}
                        </td>
                        {result.basis === "option" && (
                          <td className="whitespace-nowrap px-3 py-2 text-right font-mono-nums text-ink-2">
                            {t.option ? `$${t.option.strike} ${t.option.type} · ${t.option.entry.toFixed(2)} → ${t.option.exit.toFixed(2)}` : "—"}
                          </td>
                        )}
                        <td className={`px-3 py-2 text-right font-mono-nums ${tone(r)}`}>{pct(r)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
  );
}
