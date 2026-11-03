// What HighStrike sells (Ben, 2026-11-03: "Make the pricing Try it for a week for $14 and then $99/month thereafter"):
// one membership, everything in it, $14 for the first week and then $99 a month until it's cancelled. One week per
// person; someone who had theirs starts at $99. Shared by the homepage, its popup, the paywall over the app and the
// server that charges it (src/lib/billing.ts), so the prices are written once.

export const MEMBERSHIP = {
  /** profiles.plan while the subscription is in its week or paid up (supabase/migrations/20261103150000_monthly_membership.sql). */
  plan: "monthly",
  name: "HighStrike Membership",
  trialCents: 1400,
  trialDays: 7,
  monthlyCents: 9900,
} as const;

/** Free access an admin grants (Admin → Accounts); the name is from the $397 days. */
export const GRANTED_PLAN = "lifetime";

/** The plans that open the app (with admins). */
export const MEMBER_PLANS: readonly string[] = [MEMBERSHIP.plan, GRANTED_PLAN];

/** "$14", or "$14.50" when there are cents. */
export function dollars(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

export const TRIAL_PRICE = dollars(MEMBERSHIP.trialCents);
export const MONTHLY_PRICE = dollars(MEMBERSHIP.monthlyCents);

/** The offer in one line, as the page's smaller print says it. */
export const OFFER_LINE = `${TRIAL_PRICE} for your first week, then ${MONTHLY_PRICE}/month. Cancel anytime.`;

/** The day the week ends for a week that starts at `from`, as "Nov 10". */
export function trialEndLabel(from = new Date()) {
  const end = new Date(from.getTime() + MEMBERSHIP.trialDays * 86_400_000);
  return end.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** HighStrike Trading School's size, for the lines that say what's included (get_landing_education / education_summary). */
export type Library = { modules: number; lessons: number };

/** What the membership includes, in the popup's and the paywall's words (`full`: starting at $99, with no week). */
export function membershipIncludes(library: Library | null, full = false) {
  return [
    "The smart scanner's trade ideas at 8:30 AM ET every trading day, each with an entry, a target, a stop and a suggested option",
    "12 pro tools to find, check, size and track trades, with alerts at your target and stop and the app on your phone",
    library && library.lessons > 0
      ? `HighStrike Trading School: ${library.modules} modules and ${library.lessons} lessons, the live recordings included`
      : "HighStrike Trading School, every module and the live recordings",
    full ? "Everything from the first minute, and every update after" : "Everything from the first minute of your week, and every update after",
  ];
}
