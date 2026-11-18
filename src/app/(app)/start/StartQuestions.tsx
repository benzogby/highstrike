"use client";

import { useState, useTransition } from "react";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, INPUT } from "@/components/ui";
import { ACCOUNT_CHOICES, RISK_CHOICES, STYLE_CHOICES, usd, type TradingProfile } from "@/lib/tradingProfile";
import type { Style } from "@/lib/ideas";
import { saveAnswers, skipQuestions } from "./actions";

const choice = (on: boolean) =>
  `press rounded-xl border px-4 py-3.5 text-left transition ${on ? "border-accent bg-accent-soft ring-1 ring-inset ring-accent/40" : "border-line bg-panel hover:border-line-strong hover:bg-panel-2"}`;

/** One question a screen: account size, risk per trade, style. The last one saves and opens today's idea, sized. */
export default function StartQuestions({ initial, firstTime }: { initial: TradingProfile | null; firstTime: boolean }) {
  const [step, setStep] = useState(0);
  const [account, setAccount] = useState<number | null>(initial?.account ?? null);
  const [typed, setTyped] = useState(initial && !ACCOUNT_CHOICES.includes(initial.account) ? String(initial.account) : "");
  const [risk, setRisk] = useState<number>(initial?.riskPct ?? 1);
  const [style, setStyle] = useState<Style | null>(initial?.style ?? null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const typedValue = Number(typed.replace(/[$,\s]/g, ""));
  const acct = typed ? (typedValue >= 100 ? typedValue : null) : account;

  const finish = () => {
    if (!acct || !style) return;
    setError("");
    start(async () => {
      const r = await saveAnswers({ account: acct, riskPct: risk, style });
      if (r?.error) setError(r.error);
    });
  };

  const titles = ["How big is your trading account?", "How much of it will you risk on one trade?", "How do you like to trade?"];

  return (
    <div className="anim-rise mx-auto max-w-xl py-6 sm:py-10">
      <div className="flex items-center gap-2" aria-hidden="true">
        {titles.map((_, i) => (
          <span key={i} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-accent" : "bg-panel-2"}`} />
        ))}
      </div>
      <p className="mt-5 text-[13px] text-ink-3">
        {firstTime && step === 0 ? "Three questions, then today's best idea sized for your account · " : ""}
        {step + 1} of 3
      </p>
      <h1 className="mt-1 font-display text-[26px] leading-tight text-ink sm:text-[28px]">{titles[step]}</h1>

      {step === 0 && (
        <>
          <p className="mt-2 text-sm text-ink-2">The money you trade with, not your savings. Every size HighStrike shows starts here.</p>
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
            <span className="text-[13px] text-ink-3">Or type it</span>
            <input
              inputMode="decimal"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="$7,500"
              className={`${INPUT} mt-1 max-w-48 font-mono-nums`}
            />
          </label>
          {typed && !acct && <p className="mt-2 text-xs text-down">At least $100.</p>}
        </>
      )}

      {step === 1 && acct && (
        <>
          <p className="mt-2 text-sm text-ink-2">
            The most you&apos;re willing to lose if a trade goes wrong. Many traders keep it at 1–2%, so a run of losses never sinks the account.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {RISK_CHOICES.map((r) => (
              <button key={r} type="button" onClick={() => setRisk(r)} className={choice(risk === r)}>
                <span className="block font-mono-nums text-[17px] font-semibold text-ink">{r}%</span>
                <span className="mt-0.5 block font-mono-nums text-xs text-ink-2">{usd((acct * r) / 100)} a trade</span>
              </button>
            ))}
          </div>
          <p className="mt-4 text-xs leading-relaxed text-ink-3">
            At {risk}%, ten losing trades in a row would cost about {Math.round((1 - Math.pow(1 - risk / 100, 10)) * 100)}% of the account.
          </p>
        </>
      )}

      {step === 2 && (
        <div className="mt-6 grid gap-3">
          {STYLE_CHOICES.map((s) => (
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
            Back
          </button>
        )}
        {step < 2 ? (
          <button type="button" disabled={!acct} onClick={() => setStep(step + 1)} className={BUTTON_PRIMARY}>
            Next
          </button>
        ) : (
          <button type="button" disabled={!style || pending} onClick={finish} className={BUTTON_PRIMARY}>
            {pending ? "Sizing today's ideas…" : "Show my first idea"}
          </button>
        )}
        {firstTime && (
          <form action={skipQuestions} className="ml-auto">
            <button type="submit" className="text-[13px] text-ink-3 transition hover:text-ink">
              Skip for now
            </button>
          </form>
        )}
      </div>
      <p className="mt-10 text-xs leading-relaxed text-ink-3">
        Your answers stay on your account and only set the sizes HighStrike shows you. Change them any time in Settings. Education and tools, not investment advice.
      </p>
    </div>
  );
}
