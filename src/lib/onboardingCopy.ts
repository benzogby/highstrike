// The words on the three first questions (src/app/(app)/start/StartQuestions.tsx), editable in Admin → Onboarding
// (Ben, 2026-11-18: "Allow me to edit the exact copy shown on the questions"). Saved as one JSON value in
// public.site_settings under "onboarding_copy"; anything left empty uses the default below.
// {risk} and {loss} in riskNote are filled in: the % picked and what ten losses in a row would cost.

export const ONBOARDING_KEY = "onboarding_copy";

export const ONBOARDING_DEFAULTS = {
  intro: "Three questions, then today's best idea sized for your account",
  accountTitle: "How big is your trading account?",
  accountBody: "The money you trade with, not your savings. Every size HighStrike shows starts here.",
  accountTyped: "Or type it",
  riskTitle: "How much of it will you risk on one trade?",
  riskBody: "The most you're willing to lose if a trade goes wrong. Many traders keep it at 1–2%, so a run of losses never sinks the account.",
  riskNote: "At {risk}%, ten losing trades in a row would cost about {loss}% of the account.",
  styleTitle: "How do you like to trade?",
  dayTitle: "Day trades",
  dayBody: "In and out the same day. Needs you at the screen.",
  swingTitle: "Swing trades",
  swingBody: "A few days to a few weeks. Check in once or twice a day.",
  longTitle: "Longer holds",
  longBody: "One to three months. The least screen time.",
  next: "Next",
  back: "Back",
  finish: "Show my first idea",
  footer: "Your answers stay on your account and only set the sizes HighStrike shows you. Change them any time in Settings. Education and tools, not investment advice.",
};

export type OnboardingCopy = typeof ONBOARDING_DEFAULTS;
export type OnboardingField = keyof OnboardingCopy;

/** The fields as Admin lists them, by screen. */
export const ONBOARDING_FIELDS: { screen: string; fields: { key: OnboardingField; label: string; long?: boolean }[] }[] = [
  { screen: "Every screen", fields: [{ key: "intro", label: "Line over the first question" }, { key: "next", label: "Next button" }, { key: "back", label: "Back button" }, { key: "footer", label: "Small print at the bottom", long: true }] },
  { screen: "1 · Account size", fields: [{ key: "accountTitle", label: "Question" }, { key: "accountBody", label: "Line under it", long: true }, { key: "accountTyped", label: "Label over the type-it box" }] },
  {
    screen: "2 · Risk per trade",
    fields: [
      { key: "riskTitle", label: "Question" },
      { key: "riskBody", label: "Line under it", long: true },
      { key: "riskNote", label: "Note under the choices ({risk} and {loss} are filled in)", long: true },
    ],
  },
  {
    screen: "3 · Style",
    fields: [
      { key: "styleTitle", label: "Question" },
      { key: "dayTitle", label: "Day trades: name" },
      { key: "dayBody", label: "Day trades: line" },
      { key: "swingTitle", label: "Swing trades: name" },
      { key: "swingBody", label: "Swing trades: line" },
      { key: "longTitle", label: "Longer holds: name" },
      { key: "longBody", label: "Longer holds: line" },
      { key: "finish", label: "Last button" },
    ],
  },
];

/** The saved copy over the defaults: an empty or missing field is the default. */
export function onboardingCopy(raw: string | null | undefined): OnboardingCopy {
  let saved: Record<string, unknown> = {};
  try {
    saved = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {}
  const out = { ...ONBOARDING_DEFAULTS };
  for (const k of Object.keys(out) as OnboardingField[]) {
    const v = saved[k];
    if (typeof v === "string" && v.trim()) out[k] = v.trim();
  }
  return out;
}
