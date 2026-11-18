"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, CARD, INPUT, LABEL } from "@/components/ui";
import { ONBOARDING_DEFAULTS, ONBOARDING_FIELDS, ONBOARDING_KEY, onboardingCopy, type OnboardingField } from "@/lib/onboardingCopy";
import StartQuestions from "../../start/StartQuestions";

/**
 * Admin → Onboarding (Ben, 2026-11-18): every line on the three first questions, with the screen beside it as members see
 * it. An empty box uses the default (shown greyed inside it). Saved to site_settings "onboarding_copy"; members see it on
 * their next page.
 */
export default function OnboardingEditor({ saved }: { saved: string | null }) {
  const initial = (() => {
    try {
      return saved ? (JSON.parse(saved) as Partial<Record<OnboardingField, string>>) : {};
    } catch {
      return {};
    }
  })();
  const [values, setValues] = useState<Partial<Record<OnboardingField, string>>>(initial);
  const [screen, setScreen] = useState(0);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const copy = onboardingCopy(JSON.stringify(values));

  async function save(next: Partial<Record<OnboardingField, string>>) {
    setBusy(true);
    setNote(null);
    const clean = Object.fromEntries(Object.entries(next).filter(([k, v]) => typeof v === "string" && v.trim() && v.trim() !== ONBOARDING_DEFAULTS[k as OnboardingField]).map(([k, v]) => [k, (v as string).trim()]));
    const { error } = await supabaseBrowser()
      .from("site_settings")
      .upsert({ key: ONBOARDING_KEY, value: JSON.stringify(clean), updated_at: new Date().toISOString() });
    setBusy(false);
    if (error) return setNote({ ok: false, text: `Couldn't save: ${error.message}` });
    setValues(clean);
    setNote({ ok: true, text: "Saved ✓ — members see it on their next page" });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-5">
        <p className="max-w-2xl text-sm text-ink-2">
          The words on the three questions every new member answers before anything else (a popup over the app). Leave a box empty to use the default.
        </p>
        {ONBOARDING_FIELDS.map((group, gi) => (
          <section key={group.screen} className={`${CARD} p-4`} onFocus={() => gi > 0 && setScreen(gi - 1)}>
            <h2 className="text-[15px] font-medium text-ink">{group.screen}</h2>
            <div className="mt-3 flex flex-col gap-3">
              {group.fields.map((f) => {
                const props = {
                  value: values[f.key] ?? "",
                  placeholder: ONBOARDING_DEFAULTS[f.key],
                  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setValues((v) => ({ ...v, [f.key]: e.target.value })),
                };
                return (
                  <label key={f.key} className="block">
                    <span className={LABEL}>{f.label}</span>
                    {f.long ? (
                      <textarea {...props} rows={2} className={`${INPUT} h-auto py-2 leading-relaxed`} />
                    ) : (
                      <input {...props} className={INPUT} />
                    )}
                  </label>
                );
              })}
            </div>
          </section>
        ))}
        <div className="sticky bottom-4 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-panel/95 p-3 backdrop-blur">
          <button type="button" disabled={busy} onClick={() => save(values)} className={BUTTON_PRIMARY}>
            {busy ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (confirm("Put every line back to the default?")) save({});
            }}
            className={BUTTON_SECONDARY}
          >
            Reset all to default
          </button>
          {note && <span className={`text-sm ${note.ok ? "text-up" : "text-down"}`}>{note.text}</span>}
        </div>
      </div>

      <div className="order-first xl:sticky xl:top-6 xl:order-none xl:self-start">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[15px] font-medium text-ink">Preview</h2>
          <div className="flex gap-1 rounded-lg bg-bg p-1">
            {[0, 1, 2].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setScreen(n)}
                className={`rounded-md px-3 py-1 text-[13px] font-medium transition ${screen === n ? "bg-panel-3 text-ink ring-1 ring-inset ring-line-strong" : "text-ink-3 hover:text-ink"}`}
              >
                Screen {n + 1}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 rounded-2xl border border-line bg-bg/60 p-4 backdrop-blur-md sm:p-6">
          <div className="rounded-2xl border border-line bg-panel p-6 shadow-2xl">
            <StartQuestions key={screen} initial={null} firstTime copy={copy} preview startAt={screen} />
          </div>
        </div>
        <p className="mt-2 text-xs text-ink-3">The preview steps through but doesn&apos;t save answers.</p>
      </div>
    </div>
  );
}
