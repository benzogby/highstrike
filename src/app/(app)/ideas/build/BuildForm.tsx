"use client";

import { useState, useTransition } from "react";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, Badge, CARD, HINT, INPUT, LABEL } from "@/components/ui";
import { STYLES, type Style } from "@/lib/ideas";
import { PLAN, SETUPS, type Built, type Want } from "@/lib/buildIdeas";
import { findIdeas, saveBuilt } from "./actions";

const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Pick what you want; get the names that fit right now, each one tap from becoming your idea. */
export default function BuildForm() {
  const [w, setW] = useState<Want>({ side: "any", style: "swing", setup: "any", maxPrice: null, insiders: "any", crowd: "any" });
  const [price, setPrice] = useState("");
  const [result, setResult] = useState<{ ideas: Built[]; scanned: number } | null>(null);
  const [error, setError] = useState("");
  const [finding, find] = useTransition();
  const [saving, setSaving] = useState<string | null>(null);

  const chips = <K extends keyof Want>(key: K, options: [Want[K], string][]) => (
    <div className="flex flex-wrap gap-1.5">
      {options.map(([value, label]) => (
        <button
          key={String(value)}
          type="button"
          aria-pressed={w[key] === value}
          onClick={() => setW((x) => ({ ...x, [key]: value }))}
          className={`rounded-md px-2.5 py-1.5 text-[13px] font-medium transition ${w[key] === value ? "bg-accent-soft text-accent-ink ring-1 ring-inset ring-accent/30" : "bg-panel-2 text-ink-2 hover:text-ink"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );

  const run = () => {
    setError("");
    find(async () => {
      const n = Number(price.replace(/[$,\s]/g, ""));
      const r = await findIdeas({ ...w, maxPrice: price.trim() && n > 0 ? n : null });
      if ("error" in r) {
        setError(r.error);
        setResult(null);
      } else setResult(r);
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      <section className={`${CARD} flex flex-col gap-4 self-start p-4`}>
        <div>
          <p className={LABEL}>Which way?</p>
          {chips("side", [["any", "Either"], ["long", "Long (up)"], ["short", "Short (down)"]])}
        </div>
        <div>
          <p className={LABEL}>How long?</p>
          {chips("style", (Object.keys(STYLES) as Style[]).map((s) => [s, STYLES[s]] as [Style, string]))}
          <p className={`${HINT} mt-1 text-xs`}>
            Target {PLAN[w.style].target}%, stop {PLAN[w.style].stop}%, {PLAN[w.style].timeFrame.toLowerCase()}.
          </p>
        </div>
        <div>
          <p className={LABEL}>What kind of setup?</p>
          {chips("setup", (Object.keys(SETUPS) as Want["setup"][]).map((s) => [s, SETUPS[s]] as [Want["setup"], string]))}
        </div>
        <div>
          <p className={LABEL}>Insiders</p>
          {chips("insiders", [["any", "Doesn't matter"], ["buying", "Insiders buying"]])}
        </div>
        <div>
          <p className={LABEL}>The crowd</p>
          {chips("crowd", [["any", "Doesn't matter"], ["with", "Agrees with me"], ["against", "Against me (contrarian)"]])}
        </div>
        <label className="block">
          <span className={LABEL}>Max share price ($)</span>
          <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder="Any" className={`${INPUT} font-mono-nums`} />
        </label>
        <button type="button" onClick={run} disabled={finding} className={BUTTON_PRIMARY}>
          {finding ? "Scanning…" : "Find ideas"}
        </button>
      </section>

      <section aria-live="polite" className="min-w-0">
        {error && <p className="rounded-lg border border-down/30 bg-down-soft px-3 py-2 text-sm text-down">{error}</p>}
        {!result && !error && (
          <p className={`${CARD} px-5 py-10 text-center text-sm text-ink-3`}>Pick what you want, then Find ideas. It scans the market as it is right now.</p>
        )}
        {result && (
          <>
            <p className="mb-3 text-sm text-ink-2">
              {result.ideas.length === 0
                ? `Nothing in the ${result.scanned} stocks scanned fits all of that right now. Loosen one choice and try again.`
                : `${result.ideas.length} of ${result.scanned} stocks fit, the best first.`}
            </p>
            <ul className="flex flex-col gap-3">
              {result.ideas.map((b) => (
                <li key={b.ticker} className={`${CARD} p-4`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono-nums text-[15px] font-semibold text-ink">{b.ticker}</span>
                    <Badge tone={b.direction === "long" ? "up" : "down"}>{b.direction === "long" ? "Long" : "Short"}</Badge>
                    <span className="truncate text-[13px] text-ink-3">{b.name}</span>
                    <span className="ml-auto font-mono-nums text-[13px] text-ink-2">
                      {money(b.price)} → {money(b.target)} · stop {money(b.stop)}
                    </span>
                  </div>
                  <ul className="mt-2 space-y-1 text-sm text-ink-2">
                    {b.reasons.map((r) => (
                      <li key={r}>✓ {r}</li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    disabled={saving != null}
                    onClick={async () => {
                      setSaving(b.ticker);
                      setError("");
                      const r = await saveBuilt(b);
                      if (r?.error) {
                        setError(r.error);
                        setSaving(null);
                      }
                    }}
                    className={`${BUTTON_SECONDARY} mt-3`}
                  >
                    {saving === b.ticker ? "Saving…" : "Make it my idea"}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
