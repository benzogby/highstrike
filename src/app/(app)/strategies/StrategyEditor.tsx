"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import HighStrikeChart from "@/components/chart/HighStrikeChart";
import { CARD, INPUT } from "@/components/ui";
import { OPERANDS, OPS, type Condition, type Op, type Operand, type OperandKind } from "@/lib/strategies/rules";
import { criterionDef, entryText, fullList, type Contract, type Criterion, type Exits, type Group, type Spec } from "@/lib/strategies/spec";
import type { Result, Trade } from "@/lib/strategies/backtest";
import { deleteStrategy, runBacktest, saveStrategy, type LiveSettings } from "./actions";

// The strategy editor (Ben, 2026-11-19: "Each strategy should have tabs: Entry, Contract, Exit, Stop, Backtest"):
// criteria switched on and off with their own sensitivity, how it picks a contract or spread and sizes it, exits and
// stops that fire on "any one" or "all", the backtest in its own tab, and a Live tab for its alerts and paper trading.

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

const SELECT = "h-9 rounded-lg border border-line-strong bg-panel px-2 text-[13px] text-ink focus:border-accent focus:outline-none";
const NUM = "h-8 w-16 rounded-md border border-line-strong bg-panel px-1.5 text-center font-mono-nums text-[13px] text-ink focus:border-accent focus:outline-none disabled:opacity-50";
const WHEN = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const TABS = [
  ["entry", "Entry"],
  ["contract", "Contract"],
  ["exit", "Exit"],
  ["stop", "Stop"],
  ["backtest", "Backtest"],
  ["live", "Live"],
] as const;
type Tab = (typeof TABS)[number][0];
const groups = [...new Set(OPERANDS.map((o) => o.group))];

/** A switch: on (green) or off. */
function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative h-5 w-9 shrink-0 rounded-full transition ${on ? "bg-accent" : "bg-panel-3 ring-1 ring-inset ring-line-strong"}`}
    >
      <span className={`absolute top-0.5 size-4 rounded-full bg-white transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
    </button>
  );
}

/** Two or three choices side by side. */
function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: readonly (readonly [T, string])[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex gap-1 rounded-lg bg-bg p-1">
      {options.map(([k, text]) => (
        <button
          key={k}
          type="button"
          aria-pressed={value === k}
          onClick={() => onChange(k)}
          className={`flex-1 rounded-md px-3 py-1.5 text-[13px] font-medium transition ${value === k ? "bg-panel-3 text-ink ring-1 ring-inset ring-line-strong" : "text-ink-3 hover:text-ink"}`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

/** One criterion: its switch, and its sentence with its numbers (the sensitivity) in place. */
function CriterionRow({ cr, onChange }: { cr: Criterion; onChange: (c: Criterion) => void }) {
  const d = criterionDef(cr.id);
  if (!d) return null;
  const parts = d.text.split(/(\{\w+\})/);
  return (
    <div className={`flex items-center gap-3 rounded-lg px-3 py-2 transition ${cr.on ? "bg-accent-soft/60 ring-1 ring-inset ring-accent/30" : "bg-panel-2/40"}`}>
      <Toggle on={cr.on} onChange={(v) => onChange({ ...cr, on: v })} label={d.text.replace(/\{\w+\}/g, "N")} />
      <span className={`flex flex-wrap items-center gap-1.5 text-[13.5px] ${cr.on ? "text-ink" : "text-ink-3"}`}>
        {parts.map((p, k) => {
          const m = /^\{(\w+)\}$/.exec(p);
          if (!m) return p ? <span key={k}>{p}</span> : null;
          const q = d.params.find((x) => x.key === m[1])!;
          return (
            <input
              key={k}
              type="number"
              min={q.min}
              max={q.max}
              step={q.step}
              value={cr.p[q.key]}
              onChange={(e) => onChange({ ...cr, on: true, p: { ...cr.p, [q.key]: Number(e.target.value) } })}
              className={NUM}
              aria-label={`${q.key} (${q.min} to ${q.max})`}
            />
          );
        })}
      </span>
    </div>
  );
}

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

/** Custom rule blocks under a tab's criteria, for anything the list doesn't have. */
function CustomRules({ list, onChange, join }: { list: Condition[]; onChange: (l: Condition[]) => void; join: string }) {
  return (
    <div className="mt-5 border-t border-line pt-4">
      <p className="text-[13px] font-medium text-ink">Custom rules</p>
      <p className="text-[12px] text-ink-3">Build your own from any two values when the list above doesn&apos;t have it.</p>
      <div className="mt-2 flex flex-col gap-2">
        {list.map((c, k) => (
          <div key={k} className="flex flex-wrap items-center gap-1.5 rounded-lg bg-panel-2/60 p-2">
            <span className="w-9 text-[11px] font-semibold uppercase tracking-wide text-ink-3">{k === 0 ? "If" : join}</span>
            <OperandPicker value={c.left} onChange={(left) => onChange(list.map((x, j) => (j === k ? { ...c, left } : x)))} />
            <select className={SELECT} value={c.op} onChange={(e) => onChange(list.map((x, j) => (j === k ? { ...c, op: e.target.value as Op } : x)))} aria-label="Comparison">
              {OPS.map((o) => (
                <option key={o.op} value={o.op}>
                  {o.label}
                </option>
              ))}
            </select>
            <OperandPicker value={c.right} onChange={(right) => onChange(list.map((x, j) => (j === k ? { ...c, right } : x)))} />
            <button type="button" onClick={() => onChange(list.filter((_, j) => j !== k))} className="ml-auto grid size-7 place-items-center rounded-md text-ink-3 hover:bg-down-soft hover:text-down" aria-label="Remove this rule">
              ✕
            </button>
          </div>
        ))}
      </div>
      {list.length < 8 && (
        <button type="button" onClick={() => onChange([...list, { left: { kind: "close" }, op: "above", right: { kind: "sma", n: 50 } }])} className="mt-2 text-[13px] font-medium text-accent hover:underline">
          + Add a custom rule
        </button>
      )}
    </div>
  );
}

/** A tab of criteria: the ones that are on first, then the rest. */
function CriteriaList({ list, onChange }: { list: Criterion[]; onChange: (l: Criterion[]) => void }) {
  const set = (c: Criterion) => onChange(list.map((x) => (x.id === c.id ? c : x)));
  const onList = list.filter((c) => c.on);
  const offList = list.filter((c) => !c.on);
  return (
    <div className="flex flex-col gap-1.5">
      {onList.map((c) => (
        <CriterionRow key={c.id} cr={c} onChange={set} />
      ))}
      {onList.length > 0 && offList.length > 0 && <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-ink-3">More you can switch on</p>}
      {offList.map((c) => (
        <CriterionRow key={c.id} cr={c} onChange={set} />
      ))}
    </div>
  );
}

function ExitsTab({ g, value, onChange, title, blurb }: { g: Group; value: Exits; onChange: (e: Exits) => void; title: string; blurb: string }) {
  const n = value.criteria.filter((c) => c.on).length + value.custom.length;
  return (
    <div className={`${CARD} p-4`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-medium text-ink">{title}</h2>
          <p className="text-[12.5px] text-ink-3">{blurb}</p>
        </div>
        <div className="w-72">
          <Seg
            label={`${g} trigger`}
            value={value.mode}
            onChange={(mode) => onChange({ ...value, mode })}
            options={[
              ["any", "Any one is true"],
              ["all", "All are true"],
            ]}
          />
        </div>
      </div>
      <p className="mt-2 text-[12px] text-ink-2">
        {n === 0 ? "Nothing switched on: this never fires." : value.mode === "any" ? `Fires when any one of these ${n} is true.` : `Fires only when all ${n} are true at once (checked at the close).`}
      </p>
      <div className="mt-3">
        <CriteriaList list={value.criteria} onChange={(criteria) => onChange({ ...value, criteria })} />
      </div>
      <CustomRules list={value.custom} onChange={(custom) => onChange({ ...value, custom })} join={value.mode === "any" ? "Or" : "And"} />
    </div>
  );
}

function ContractTab({ value, onChange, direction }: { value: Contract; onChange: (c: Contract) => void; direction: "long" | "short" }) {
  const opt = value.kind !== "shares";
  const side = direction === "long" ? "call" : "put";
  const field = (label: string, child: React.ReactNode, hint?: string) => (
    <div>
      <p className="mb-1.5 text-[13px] font-medium text-ink">{label}</p>
      {child}
      {hint && <p className="mt-1 text-[12px] text-ink-3">{hint}</p>}
    </div>
  );
  const summary = !opt
    ? `${direction === "long" ? "Buys" : "Sells short"} shares`
    : `${value.kind === "spread" ? `A ${side} debit spread, ${value.width} strike${value.width === 1 ? "" : "s"} wide` : `A ${side}`}, ${value.expiryRule === "nearest" ? "the expiry nearest" : "the first expiry at least"} ${value.dte} days out, ${
        value.strike.by === "delta" ? `the strike nearest ${value.strike.value} delta` : value.strike.by === "atm" ? "at the money" : `${Math.abs(value.strike.value)}% ${value.strike.value >= 0 ? "out of" : "in"} the money`
      }`;
  const size = value.size.by === "contracts" ? `${value.size.value} ${opt ? (value.size.value === 1 ? "contract" : "contracts") : "shares"}` : value.size.by === "dollars" ? `$${value.size.value.toLocaleString("en-US")} a trade` : `${value.size.value}% of the $25,000 account`;
  return (
    <div className={`${CARD} flex flex-col gap-5 p-4`}>
      {field(
        "What it buys",
        <Seg
          label="Instrument"
          value={value.kind}
          onChange={(kind) => onChange({ ...value, kind, size: kind === "shares" && value.size.by === "contracts" ? { by: "dollars", value: 1000 } : value.size })}
          options={[
            ["single", direction === "long" ? "A call" : "A put"],
            ["spread", "A debit spread"],
            ["shares", "Shares"],
          ]}
        />
      )}
      {opt && (
        <>
          {field(
            "Expiration",
            <div className="flex flex-wrap items-center gap-2 text-[13.5px] text-ink-2">
              <select className={SELECT} value={value.expiryRule} onChange={(e) => onChange({ ...value, expiryRule: e.target.value as Contract["expiryRule"] })} aria-label="Expiry rule">
                <option value="nearest">The expiry nearest</option>
                <option value="atLeast">The first expiry at least</option>
              </select>
              <input type="number" min={1} max={400} className={NUM} value={value.dte} onChange={(e) => onChange({ ...value, dte: Number(e.target.value) })} aria-label="Days to expiry" />
              days out
            </div>,
            "Listed options expire on Fridays (weeklies and monthlies)."
          )}
          {field(
            "Strike",
            <div className="flex flex-wrap items-center gap-2 text-[13.5px] text-ink-2">
              <select
                className={SELECT}
                value={value.strike.by}
                onChange={(e) => {
                  const by = e.target.value as Contract["strike"]["by"];
                  onChange({ ...value, strike: { by, value: by === "delta" ? 0.4 : by === "otmPct" ? 2 : 0 } });
                }}
                aria-label="Strike rule"
              >
                <option value="delta">Nearest a delta of</option>
                <option value="otmPct">A percent from the price</option>
                <option value="atm">At the money</option>
              </select>
              {value.strike.by !== "atm" && (
                <input
                  type="number"
                  step={value.strike.by === "delta" ? 0.05 : 0.5}
                  min={value.strike.by === "delta" ? 0.05 : -30}
                  max={value.strike.by === "delta" ? 0.95 : 30}
                  className={NUM}
                  value={value.strike.value}
                  onChange={(e) => onChange({ ...value, strike: { ...value.strike, value: Number(e.target.value) } })}
                  aria-label="Strike value"
                />
              )}
              {value.strike.by === "otmPct" && <span>% (positive: out of the money)</span>}
            </div>,
            value.strike.by === "delta" ? "0.50 is about at the money; lower is further out (cheaper, less likely to pay)." : undefined
          )}
          {value.kind === "spread" &&
            field(
              "Spread width",
              <div className="flex items-center gap-2 text-[13.5px] text-ink-2">
                Sells the {side}
                <input type="number" min={1} max={10} className={NUM} value={value.width} onChange={(e) => onChange({ ...value, width: Number(e.target.value) })} aria-label="Width in strikes" />
                strike{value.width === 1 ? "" : "s"} further out
              </div>,
              "Caps the gain, and lowers the cost. Paper trading can't hold spreads yet, so live it alerts only."
            )}
        </>
      )}
      {field(
        "Position size",
        <div className="flex flex-wrap items-center gap-2 text-[13.5px] text-ink-2">
          <select
            className={SELECT}
            value={value.size.by}
            onChange={(e) => {
              const by = e.target.value as Contract["size"]["by"];
              onChange({ ...value, size: { by, value: by === "contracts" ? (opt ? 1 : 10) : by === "dollars" ? 1000 : 4 } });
            }}
            aria-label="Size rule"
          >
            <option value="contracts">{opt ? "A number of contracts" : "A number of shares"}</option>
            <option value="dollars">Dollars a trade</option>
            <option value="accountPct">A percent of the account</option>
          </select>
          <input
            type="number"
            min={value.size.by === "contracts" ? 1 : value.size.by === "dollars" ? 50 : 0.5}
            step={value.size.by === "dollars" ? 50 : value.size.by === "accountPct" ? 0.5 : 1}
            className={`${NUM} w-24`}
            value={value.size.value}
            onChange={(e) => onChange({ ...value, size: { ...value.size, value: Number(e.target.value) } })}
            aria-label="Size"
          />
        </div>
      )}
      <p className="rounded-lg bg-panel-2/60 px-3 py-2.5 text-[13px] text-ink">
        {summary}. Size: {size}.
      </p>
    </div>
  );
}

const pct = (n: number | null, digits = 1) => (n == null ? "—" : `${n > 0 ? "+" : ""}${n.toFixed(digits)}%`);
const dollars = (n: number | null) => (n == null ? "—" : `${n > 0 ? "+" : n < 0 ? "−" : ""}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`);
const tone = (n: number | null) => (n == null || n === 0 ? "text-ink-2" : n > 0 ? "text-up" : "text-down");
const REASONS: Record<Trade["reason"], string> = { exit: "Exit", stop: "Stop", expiry: "Expiry", open: "Still open" };

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
  const col = vals[vals.length - 1] >= 0 ? "var(--color-up)" : "var(--color-down)";
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
  initialRules: Spec;
  initialTicker: string;
  template: string | null;
  userId: string;
  initialSettings?: LiveSettings;
  signals?: SignalRow[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("entry");
  const [name, setName] = useState(initialName);
  const [spec, setSpec] = useState<Spec>(() => ({
    ...initialRules,
    entry: { ...initialRules.entry, criteria: fullList("entry", initialRules.entry.criteria) },
    exit: { ...initialRules.exit, criteria: fullList("exit", initialRules.exit.criteria) },
    stop: { ...initialRules.stop, criteria: fullList("stop", initialRules.stop.criteria) },
  }));
  const [ticker, setTicker] = useState(initialTicker);
  const [settings, setSettings] = useState<LiveSettings>(initialSettings);
  const [watchText, setWatchText] = useState(initialSettings.watch.join(", "));
  const [result, setResult] = useState<{ ticker: string; data: Result; newsFrom: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [running, startRun] = useTransition();
  const [saving, startSave] = useTransition();

  const set = (patch: Partial<Spec>) => {
    setSpec((s) => ({ ...s, ...patch }));
    setSaved(null);
  };
  const setLive = (patch: Partial<LiveSettings>) => {
    setSettings((s) => ({ ...s, ...patch }));
    setSaved(null);
  };
  const run = () =>
    startRun(async () => {
      setError(null);
      setTab("backtest");
      const t = ticker.trim().toUpperCase();
      const r = await runBacktest({ rules: spec, ticker: t });
      if ("error" in r) setError(r.error);
      else setResult({ ticker: t, data: r.result, newsFrom: r.newsFrom });
    });
  const save = () =>
    startSave(async () => {
      setError(null);
      const watch = watchText.split(/[\s,]+/).filter(Boolean);
      const r = await saveStrategy({ id, name, rules: spec, ticker, template, settings: { ...settings, watch } });
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

  const count = (g: { criteria: Criterion[]; custom: Condition[] }) => g.criteria.filter((c) => c.on).length + g.custom.length;
  const badge: Record<Tab, string | null> = {
    entry: String(count(spec.entry)),
    contract: spec.contract.kind === "shares" ? "Shares" : spec.contract.kind === "spread" ? "Spread" : spec.direction === "long" ? "Call" : "Put",
    exit: String(count(spec.exit)),
    stop: String(count(spec.stop)),
    backtest: result ? String(result.data.stats.count) : null,
    live: settings.live ? "On" : null,
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Name, side, save */}
      <div className={`${CARD} flex flex-wrap items-center gap-3 p-3`}>
        <div className="w-72">
          <input value={name} onChange={(e) => (setName(e.target.value), setSaved(null))} className={`${INPUT} font-medium`} aria-label="Strategy name" maxLength={80} />
        </div>
        <div className="w-80">
          <Seg
            label="Direction"
            value={spec.direction}
            onChange={(direction) => set({ direction })}
            options={[
              ["long", "Bullish"],
              ["short", "Bearish"],
            ]}
          />
        </div>
        <span className="ml-auto flex items-center gap-3">
          {saved && <span className="text-[13px] text-up">{saved}</span>}
          {id && (
            <button type="button" onClick={remove} className="text-[13px] text-ink-3 hover:text-down">
              Delete
            </button>
          )}
          <button type="button" onClick={save} disabled={saving} className="h-9 rounded-lg bg-accent px-4 text-[14px] font-semibold text-on-accent shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_2px_0_#148a60] disabled:opacity-60">
            {saving ? "Saving…" : id ? "Save" : "Save strategy"}
          </button>
        </span>
      </div>

      {/* Tabs */}
      <nav role="tablist" aria-label="Strategy" className="flex gap-1 overflow-x-auto rounded-xl bg-bg p-1 ring-1 ring-inset ring-line">
        {TABS.map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={`flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-[14px] font-medium transition ${tab === k ? "bg-panel-3 text-ink ring-1 ring-inset ring-line-strong" : "text-ink-3 hover:text-ink"}`}
          >
            {label}
            {badge[k] && <span className={`rounded px-1.5 text-[11px] ${tab === k ? "bg-accent-soft text-accent-ink" : "bg-panel-2 text-ink-3"}`}>{badge[k]}</span>}
          </button>
        ))}
      </nav>
      {error && <p className="rounded-lg border border-down/40 bg-down-soft px-3 py-2 text-[13px] text-down">{error}</p>}

      {tab === "entry" && (
        <div className={`${CARD} p-4`}>
          <h2 className="text-[15px] font-medium text-ink">Enter when all of these are true</h2>
          <p className="text-[12.5px] text-ink-3">Switch on what you want, then set each one&apos;s numbers. Checked at each day&apos;s close.</p>
          <div className="mt-3">
            <CriteriaList list={spec.entry.criteria} onChange={(criteria) => set({ entry: { ...spec.entry, criteria } })} />
          </div>
          <CustomRules list={spec.entry.custom} onChange={(custom) => set({ entry: { ...spec.entry, custom } })} join="And" />
        </div>
      )}
      {tab === "contract" && <ContractTab value={spec.contract} onChange={(contract) => set({ contract })} direction={spec.direction} />}
      {tab === "exit" && <ExitsTab g="exit" value={spec.exit} onChange={(exit) => set({ exit })} title="Take profit" blurb="When to close a trade that's working." />}
      {tab === "stop" && <ExitsTab g="stop" value={spec.stop} onChange={(stop) => set({ stop })} title="Cut the loss" blurb="When to close a trade that isn't. Checked before the exits." />}

      {tab === "backtest" && (
        <div className="flex flex-col gap-4">
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
          {result?.newsFrom && (
            <p className="rounded-lg border border-warn/40 bg-warn-soft px-3 py-2 text-[12.5px] text-ink-2">
              News criteria can only be judged from {result.newsFrom} (where the free news history starts), so this backtest finds trades from then on.
            </p>
          )}
          {!result ? (
            <div className={`${CARD} px-5 py-12 text-center`}>
              <p className="text-sm text-ink-2">Run it to see every trade this strategy would have taken.</p>
              <p className="mt-1 text-[12px] text-ink-3">Enters when {entryText(spec) || "nothing yet: switch something on in Entry"}.</p>
            </div>
          ) : (
            <BacktestResults result={result.data} ticker={result.ticker} direction={spec.direction} userId={userId} />
          )}
        </div>
      )}

      {tab === "live" && (
        <div className={`${CARD} p-4`}>
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-medium text-ink">Live</h2>
            {settings.live ? (
              <span className="flex items-center gap-1.5 rounded-md bg-up-soft px-2 py-0.5 text-[11px] font-medium text-up">
                <span className="size-1.5 rounded-full bg-up" /> Watching
              </span>
            ) : (
              <span className="text-[11px] text-ink-3">Off</span>
            )}
          </div>
          <label className="mt-3 block max-w-xl">
            <span className="mb-1 block text-[12px] text-ink-2">Stocks to watch (up to 25)</span>
            <input value={watchText} onChange={(e) => (setWatchText(e.target.value.toUpperCase()), setSaved(null))} placeholder="SPY, AAPL, NVDA" className={`${INPUT} font-mono-nums uppercase`} />
          </label>
          <div className="mt-4 flex max-w-xl flex-col gap-3">
            {(
              [
                ["live", "Switch it on", "Checked every 5 minutes while the market's open, on today's bar so far."],
                ["alerts", "Alert me", "In the bell and by email when its entry is all true."],
                ["autoTrade", "Paper-trade it by itself", spec.contract.kind === "spread" ? "Spreads alert only for now: paper trading can't hold them yet." : "Buys by its Contract tab, and closes by its Exit and Stop tabs."],
              ] as const
            ).map(([k, label, hint]) => (
              <label key={k} className="flex cursor-pointer items-start gap-3">
                <span className="mt-0.5">
                  <Toggle on={settings[k]} onChange={(v) => setLive({ [k]: v } as Partial<LiveSettings>)} label={label} />
                </span>
                <span>
                  <span className="block text-[13.5px] text-ink">{label}</span>
                  <span className="block text-[12px] text-ink-3">{hint}</span>
                </span>
              </label>
            ))}
          </div>
          {signals.length > 0 && (
            <div className="mt-5 border-t border-line pt-3">
              <p className="text-[12px] font-medium text-ink-2">Recent signals</p>
              <ul className="mt-2 max-w-xl space-y-1.5">
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
          <p className="mt-4 text-[12px] text-ink-3">Save to apply these.</p>
        </div>
      )}

      <p className="text-[12px] text-ink-3">
        New to these? <Link href="/education" className="text-accent hover:underline">Trading School</Link> covers RSI, moving averages and how options move.
      </p>
    </div>
  );
}

/** A backtest's numbers, its running total, the chart with every entry and exit, and the trades. */
export function BacktestResults({ result, ticker, direction, userId }: { result: Result; ticker: string; direction: "long" | "short"; userId?: string }) {
  const s = result.stats;
  const markers = useMemo(
    () =>
      result.trades.flatMap((t) => {
        const m: { t: string; kind: "entry" | "exit"; side: "long" | "short"; win?: boolean }[] = [{ t: t.entryT, kind: "entry", side: direction }];
        if (t.exitT) m.push({ t: t.exitT, kind: "exit", side: direction, win: t.dollars > 0 });
        return m;
      }),
    [result, direction]
  );
  const onOption = result.basis !== "stock";
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          [
            ["Trades", String(s.count), ""],
            ["Win rate", s.winRate == null ? "—" : `${s.winRate}%`, ""],
            ["Average trade", pct(s.expectancy), tone(s.expectancy)],
            ["Total", dollars(s.totalDollars), tone(s.totalDollars)],
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
        {onOption ? `On the ${result.basis === "spread" ? "spread" : "option"}, priced from the stock's own recent swings (estimated, not real past quotes), at the size in the Contract tab. ` : "On the shares, at the size in the Contract tab. "}
        {ticker}, {result.from} to {result.to}. Not a promise of future results.
      </p>

      <div className={`${CARD} p-4`}>
        <p className="text-[13px] font-medium text-ink">Running profit or loss</p>
        <Equity points={result.equity} />
      </div>

      <div className={`${CARD} p-3`}>
        <HighStrikeChart key={ticker} ticker={ticker} userId={userId} height={360} initialTimeframe="D" markers={markers} />
      </div>

      <div className={`${CARD} overflow-x-auto`}>
        <table className="w-full min-w-[820px] text-[13px]">
          <thead className="border-b border-line text-[11px] text-ink-3">
            <tr>
              {["Entered", "Exited", "Why", "Stock", onOption ? "Contract" : "", "Qty", "Result", "P/L"].filter(Boolean).map((h, k) => (
                <th key={h} className={`px-3 py-2.5 font-medium ${k >= 3 ? "text-right" : "text-left"}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {[...result.trades]
              .reverse()
              .slice(0, 150)
              .map((t) => (
                <tr key={t.entryT}>
                  <td className="whitespace-nowrap px-3 py-2 text-ink-2">{t.entryT}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-ink-2">{t.exitT ?? "—"}</td>
                  <td className="px-3 py-2 text-ink-2" title={t.why}>
                    {REASONS[t.reason]}
                    {t.why && t.reason !== "expiry" && <span className="ml-1 text-[11px] text-ink-3">({t.why})</span>}
                  </td>
                  <td className={`px-3 py-2 text-right font-mono-nums ${tone(t.stockPct)}`}>
                    {t.entryPrice.toFixed(2)} → {t.exitPrice.toFixed(2)}
                  </td>
                  {onOption && (
                    <td className="whitespace-nowrap px-3 py-2 text-right font-mono-nums text-ink-2">
                      {t.option ? `$${t.option.strike}${t.option.short != null ? `/${t.option.short}` : ""} ${t.option.type} · ${t.option.entry.toFixed(2)} → ${t.option.exit.toFixed(2)}` : "—"}
                    </td>
                  )}
                  <td className="px-3 py-2 text-right font-mono-nums text-ink-2">{t.qty}</td>
                  <td className={`px-3 py-2 text-right font-mono-nums ${tone(t.pct)}`}>{pct(t.pct)}</td>
                  <td className={`px-3 py-2 text-right font-mono-nums ${tone(t.dollars)}`}>{dollars(t.dollars)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
