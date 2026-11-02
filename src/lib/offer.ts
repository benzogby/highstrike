// The one thing HighStrike sells (Ben, 2026-11-02: "Put up a $397 lifetime access paywall for new users. One time
// payment, instant access"): one payment, everything for life. Shared by the homepage, its popup, the paywall over the
// app and the server that charges it (src/lib/lifetime.ts), so the price is written once.

export const LIFETIME = {
  /** profiles.plan once it's paid (supabase/migrations/20261102200000_lifetime_membership.sql). */
  plan: "lifetime",
  cents: 39700,
  name: "HighStrike Lifetime Access",
} as const;

/** "$397", or "$397.50" when there are cents. */
export function dollars(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

export const LIFETIME_PRICE = dollars(LIFETIME.cents);

/** HighStrike Trading School's size, for the lines that say what's included (get_landing_education / education_summary). */
export type Library = { modules: number; lessons: number };

/** What the membership includes, in the popup's and the paywall's words. */
export function lifetimeIncludes(library: Library | null) {
  return [
    "The daily trades: every setup with its entry, target and reasoning, out before the bell",
    "The tools: the AI terminal, the flow scanner, alerts, insider filings and the crowd",
    library && library.lessons > 0
      ? `HighStrike Trading School: ${library.modules} modules and ${library.lessons} lessons, the live recordings included`
      : "HighStrike Trading School, every module and the live recordings",
    "Every update to all of it, with nothing more to pay",
  ];
}
