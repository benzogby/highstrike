"use client";

import { useState, useTransition } from "react";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, INPUT } from "@/components/ui";
import { ACCOUNT_CHOICES, RISK_CHOICES, usd, type TradingProfile } from "@/lib/tradingProfile";
import { ONBOARDING_DEFAULTS, type OnboardingCopy } from "@/lib/onboardingCopy";
import type { Style } from "@/lib/ideas";
import { saveAnswers } from "./actions";

const choice = (on: boolean) =>
  `press rounded-xl border px-4 py-3.5 text-left transition ${on ? "border-accent bg-accent-soft ring-1 ring-inset ring-accent/40" : "border-line bg-panel hover:border-line-strong hover:bg-panel-2"}`;

/**
 * One question a screen: account size, risk per trade, style. The last one saves and opens today's idea, sized. The words
 * are Admin → Onboarding's (src/lib/onboardingCopy.ts). `preview` (Admin) steps through without saving; `startAt` opens a
 * given screen.
 */
export default function StartQuestions({
  initial,
  firstTime,
  copy = ONBOARDING_DEFAULTS,
  preview = false,
  startAt = 0,
}: {
  initial: TradingProfile | null;
  firstTime: boolean;
  copy?: OnboardingCopy;
  preview?: boolean;
  startAt?: number;
}) {
  const [step, setStep] = useState(startAt);
  const [account, setAccount] = useState<number | null>(initial?.account ?? (preview ? 5_000 : null));
  const [typed, setTyped] = useState(initial && !ACCOUNT_CHOICES.includes(initial.account) ? String(initial.account) : "");
  const [risk, setRisk] = useState<number>(initial?.riskPct ?? 1);
  const [style, setStyle] = useState<Style | null>(initial?.style ?? null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const typedValue = Number(typed.replace(/[$,\s]/g, ""));
  const acct = typed ? (typedValue >= 100 ? typedValue : null) : account;

  const finish = () => {
    if (!acct || !style || preview) return;
    setError("");
    start(async () => {
      const r = await saveAnswers({ account: acct, riskPct: risk, style });
      if (r?.error) setError(r.error);
    });
  };

  const titles = [copy.accountTitle, copy.riskTitle, copy.styleTitle];
  const styles: { key: Style; title: string; body: string }[] = [
    { key: "day", title: copy.dayTitle, body: copy.dayBody },
    { key: "swing", title: copy.swingTitle, body: copy.swingBody },
    { key: "long", title: copy.longTitle, body: copy.longBody },
  ];
  const tenLosses = Math.round((1 - Math.pow(1 - risk / 100, 10)) * 100);

  return (
    <div className="mx-auto max-w-xl">
      <div className="flex items-center gap-2" aria-hidden="true">
        {titles.map((_, i) => (
          <span key={i} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-accent" : "bg-panel-2"}`} />
        ))}
      </div>
      <p className="mt-5 text-[13px] text-ink-3">
        {firstTime && step === 0 && copy.intro ? `${copy.intro} · ` : ""}
        {step + 1} of 3
      </p>
      <h1 className="mt-1 font-display text-[26px] leading-tight text-ink sm:text-[28px]">{titles[step]}</h1>

      {step === 0 && (
        <>
          <p className="mt-2 text-sm text-ink-2">{copy.accountBody}</p>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {ACCOUNT_CHOICES.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => {
                  setAccount(a);
                  setTyped("");
                }}
                className={choice(!typed && account === a)}
              >
                <span className="font-mono-nums text-[17px] font-semibold text-ink">{a >= 50_000 ? `${usd(a)}+` : usd(a)}</span>
              </button>
            ))}
          </div>
          <label className="mt-4 block">
            <span className="text-[13px] text-ink-3">{copy.accountTyped}</span>
            <input inputMode="decimal" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="$7,500" className={`${INPUT} mt-1 max-w-48 font-mono-nums`} />
          </label>
          {typed && !acct && <p className="mt-2 text-xs text-down">At least $100.</p>}
        </>
      )}

      {step === 1 && acct && (
        <>
          <p className="mt-2 text-sm text-ink-2">{copy.riskBody}</p>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {RISK_CHOICES.map((r) => (
              <button key={r} type="button" onClick={() => setRisk(r)} className={choice(risk === r)}>
                <span className="block font-mono-nums text-[17px] font-semibold text-ink">{r}%</span>
                <span className="mt-0.5 block font-mono-nums text-xs text-ink-2">{usd((acct * r) / 100)} a trade</span>
              </button>
            ))}
          </div>
          <p className="mt-4 text-xs leading-relaxed text-ink-3">{copy.riskNote.replaceAll("{risk}", String(risk)).replaceAll("{loss}", String(tenLosses))}</p>
        </>
      )}

      {step === 2 && (
        <div className="mt-6 grid gap-3">
          {styles.map((s) => (
            <button key={s.key} type="button" onClick={() => setStyle(s.key)} className={choice(style === s.key)}>
              <span className="block text-[15px] font-medium text-ink">{s.title}</span>
              <span className="mt-0.5 block text-sm text-ink-2">{s.body}</span>
            </button>
          ))}
        </div>
      )}

      {error && <p className="mt-4 rounded-lg border border-down/40 bg-down-soft px-4 py-3 text-sm text-down">{error}</p>}

      <div className="mt-8 flex items-center gap-3">
        {step > 0 && (
          <button type="button" onClick={() => setStep(step - 1)} className={BUTTON_SECONDARY}>
            {copy.back}
          </button>
        )}
        {step < 2 ? (
          <button type="button" disabled={!acct} onClick={() => setStep(step + 1)} className={BUTTON_PRIMARY}>
            {copy.next}
          </button>
        ) : (
          <button type="button" disabled={!style || pending || preview} onClick={finish} className={BUTTON_PRIMARY}>
            {pending ? "Sizing today's ideas…" : copy.finish}
          </button>
        )}
      </div>
      <p className="mt-8 text-xs leading-relaxed text-ink-3">{copy.footer}</p>
    </div>
  );
}
