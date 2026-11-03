"use client";

import { useState, useTransition } from "react";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, CARD, HINT, INPUT, LABEL } from "@/components/ui";
import { STYLES, type Style } from "@/lib/ideas";
import { contractLabel, parseIdea } from "@/lib/pasteIdea";
import { savePasted, type Draft } from "./actions";

const EXAMPLE = "$AAPL 190c 11/15 @ 2.40 target 195 stop 184";

/**
 * Paste an alert, read it, check what was found, fix anything, save. Reading happens right here in the browser with
 * src/lib/pasteIdea.ts's rules; saving makes it the member's own idea and opens it.
 */
export default function PasteForm() {
  const [text, setText] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [found, setFound] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [saving, start] = useTransition();

  const read = () => {
    const p = parseIdea(text);
    setFound(p.found);
    setError("");
    setDraft({
      text,
      ticker: p.ticker ?? "",
      direction: p.direction ?? "long",
      style: p.style,
      timeFrame: p.timeFrame,
      entry: p.entry != null ? String(p.entry) : "",
      target: p.target != null ? String(p.target) : "",
      stop: p.stop != null ? String(p.stop) : "",
      contract: p.option ? contractLabel(p.option) : "",
      expiry: p.option?.expiry ?? "",
    });
  };
  const set = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const field = (label: string, key: keyof Draft, hint?: string, mono = true) => (
    <label className="block">
      <span className={LABEL}>{label}</span>
      <input value={draft?.[key] ?? ""} onChange={(e) => set({ [key]: e.target.value } as Partial<Draft>)} className={`${INPUT} ${mono ? "font-mono-nums" : ""}`} />
      {hint && <span className={`${HINT} mt-1 block text-xs`}>{hint}</span>}
    </label>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className={`${CARD} p-4`}>
        <label htmlFor="paste" className={LABEL}>
          Paste the alert
        </label>
        <textarea
          id="paste"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={7}
          maxLength={1500}
          placeholder={`A tweet, a Discord call, a text from a friend. For example:\n${EXAMPLE}`}
          className={`${INPUT} h-auto py-2 leading-relaxed`}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={read} disabled={!text.trim()} className={BUTTON_PRIMARY}>
            Read it
          </button>
          <button
            type="button"
            className={BUTTON_SECONDARY}
            onClick={() => {
              setText(EXAMPLE);
              setDraft(null);
            }}
          >
            Try an example
          </button>
        </div>
        <p className={`${HINT} mt-3`}>Text only for now. Screenshots aren&apos;t read yet, so type out what the picture says.</p>
        {found.length > 0 && (
          <div className="mt-4 border-t border-line pt-3">
            <p className="text-[13px] font-medium text-ink">What we found</p>
            <ul className="mt-1 space-y-1 text-sm text-ink-2">
              {found.map((f) => (
                <li key={f}>✓ {f}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {draft && (
        <form
          className={`${CARD} p-4`}
          onSubmit={(e) => {
            e.preventDefault();
            setError("");
            start(async () => {
              const r = await savePasted(draft);
              if (r?.error) setError(r.error);
            });
          }}
        >
          <h2 className="text-[15px] font-medium text-ink">Check it, then save</h2>
          <p className={`${HINT} mt-0.5`}>Fix anything that&apos;s wrong. Blank prices are filled from the live price: target 10% away, stop 8%.</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {field("Ticker", "ticker")}
            <label className="block">
              <span className={LABEL}>Side</span>
              <select value={draft.direction} onChange={(e) => set({ direction: e.target.value as Draft["direction"] })} className={INPUT}>
                <option value="long">Long (up)</option>
                <option value="short">Short (down)</option>
              </select>
            </label>
            {field("Entry ($)", "entry", "Blank: the price now")}
            {field("Target ($)", "target")}
            {field("Stop ($)", "stop")}
            {field("Option contract", "contract", "Optional, like 190C 11/15", false)}
            <label className="block">
              <span className={LABEL}>Style</span>
              <select value={draft.style} onChange={(e) => set({ style: e.target.value as Style })} className={INPUT}>
                {(Object.keys(STYLES) as Style[]).map((s) => (
                  <option key={s} value={s}>
                    {STYLES[s]}
                  </option>
                ))}
              </select>
            </label>
            {field("Time frame", "timeFrame", undefined, false)}
          </div>
          {error && <p className="mt-3 text-sm text-down">{error}</p>}
          <button type="submit" disabled={saving} className={`${BUTTON_PRIMARY} mt-4`}>
            {saving ? "Saving…" : "Save and evaluate it"}
          </button>
          <p className={`${HINT} mt-2 text-xs`}>Only you see ideas you paste. It&apos;s followed to its target, stop or time limit like every idea.</p>
        </form>
      )}
    </div>
  );
}
