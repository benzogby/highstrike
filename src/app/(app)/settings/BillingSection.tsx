import type { BillingState } from "@/lib/billing";
import { MONTHLY_PRICE } from "@/lib/offer";

/** "Nov 10, 2026", in New York. */
function date(at: string) {
  return new Date(at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" });
}

/** The account's membership in words: a name, a line, a badge. */
function describe(state: BillingState): { name: string; line: string; badge: string; tone: "up" | "warn" | "plain" } {
  switch (state.kind) {
    case "admin":
      return { name: "Admin access", line: "Everything in HighStrike is open to this account.", badge: "Active", tone: "up" };
    case "granted":
      return { name: "Free access", line: "HighStrike gave this account access, with nothing to pay.", badge: "Active", tone: "up" };
    case "trial":
      return state.cancels
        ? { name: "Your week", line: `Cancelled. Everything stays open until ${date(state.until)}, and no ${MONTHLY_PRICE} is charged.`, badge: "Ends soon", tone: "warn" }
        : { name: "Your week", line: `Your week runs until ${date(state.until)}. Then it's ${MONTHLY_PRICE}/month until you cancel.`, badge: "Trial", tone: "up" };
    case "active":
      return state.cancels
        ? { name: "Membership", line: `Cancelled. Everything stays open until ${date(state.until)}.`, badge: "Ends soon", tone: "warn" }
        : { name: "Membership", line: `${MONTHLY_PRICE}/month, next on ${date(state.until)}.`, badge: "Active", tone: "up" };
    case "owed":
      return { name: "Membership", line: "Your last payment didn't go through.", badge: "Payment failed", tone: "warn" };
    case "none":
      return { name: "Membership", line: "No membership on this account.", badge: "Inactive", tone: "plain" };
  }
}

const BADGE = {
  up: "bg-accent-soft text-accent-ink ring-accent/25",
  warn: "bg-warn-soft text-warn ring-warn/25",
  plain: "bg-panel-3 text-ink-2 ring-line-strong",
};

/**
 * Settings → Billing (Ben, 2026-11-03: "Settings -> Billing -> Link to Stripe billing portal"): where the membership
 * stands, and Manage billing, which opens Stripe's billing page (change the card, invoices, cancel at the end of what's
 * paid for). A plain form POST, so it works before the page's script has loaded.
 */
export default function BillingSection({ state, unavailable }: { state: BillingState; unavailable: boolean }) {
  const d = describe(state);
  const managed = state.kind === "trial" || state.kind === "active" || state.kind === "owed" || state.kind === "none";
  return (
    <section id="billing" className="scroll-mt-20 rounded-xl border border-line bg-panel p-6">
      <h2 className="font-display text-[15px] text-ink">Billing</h2>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-panel-2 px-4 py-3.5">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">{d.name}</p>
          <p className="mt-0.5 text-sm text-ink-2">{d.line}</p>
        </div>
        <span className={`rounded-md px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset ${BADGE[d.tone]}`}>{d.badge}</span>
      </div>
      {managed && (
        <form action="/api/billing/portal" method="post" className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            className="inline-flex h-9 items-center justify-center rounded-lg border border-line-strong bg-panel-2 px-3.5 text-sm font-medium text-ink transition hover:bg-panel-3"
          >
            Manage billing
          </button>
          <span className="text-sm text-ink-3">Change your card, see invoices or cancel, on Stripe&apos;s secure page.</span>
        </form>
      )}
      {unavailable && (
        <p role="alert" className="mt-3 text-sm text-down">
          Billing couldn&apos;t open just now. Try again in a minute, or write to support@highstrike.com.
        </p>
      )}
    </section>
  );
}
