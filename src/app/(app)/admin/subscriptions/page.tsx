import Link from "next/link";
import { Badge, CARD, Stat } from "@/components/ui";
import { DATE, requireAdmin } from "@/lib/adminGate";
import { subscriptionsList, type SubRow } from "@/lib/adminSubscriptions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Subscriptions — Admin — HighStrike" };

const money = (cents: number) => `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
const day = (s: number | null) => (s ? DATE.format(new Date(s * 1000)) : "—");

const STATE: Record<SubRow["state"], { label: string; tone: "up" | "accent" | "warn" | "down" | "neutral" }> = {
  week: { label: "In their week", tone: "accent" },
  member: { label: "Member", tone: "up" },
  cancelling: { label: "Cancelled", tone: "warn" },
  failed: { label: "Payment failed", tone: "down" },
  ended: { label: "Ended", tone: "neutral" },
};

/** What happens next for a membership, in words. */
function nextOf(r: SubRow) {
  if (r.state === "week") return `First ${money(r.cents)} on ${day(r.next)}`;
  if (r.state === "member") return `${money(r.cents)} on ${day(r.next)}`;
  if (r.state === "cancelling") return `Access until ${day(r.next)}`;
  if (r.state === "failed") return "Locked until paid";
  return `Ended ${day(r.ended)}`;
}

/**
 * Admin → Subscriptions (Ben, 2026-11-03: "Yes, like Ripping's"): every membership, read from Stripe as the page opens
 * (src/lib/adminSubscriptions.ts): the money each month, who's in their week and when their first $99 comes, members and
 * their renewals, cancellations, failed payments and the ones that ended. Soonest charge first.
 */
export default async function AdminSubscriptionsPage() {
  await requireAdmin();
  const read = await subscriptionsList().then(
    (list) => ({ list, why: null as string | null }),
    (e: unknown) => ({ list: null, why: e instanceof Error ? e.message : "Stripe didn't answer." })
  );
  const list = read.list;
  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-ink-2">Every membership in Stripe, read as the page opens: the $14 weeks, the $99 members, cancellations and failed payments.</p>
      {read.why && (
        <p role="alert" className="rounded-lg border border-down/30 bg-down-soft px-3 py-2 text-sm text-down">
          The subscriptions couldn&apos;t be read: {read.why}
        </p>
      )}
      {!read.why && !list && <p className="text-sm text-ink-3">Stripe isn&apos;t set up on this site, so there are no subscriptions to list.</p>}
      {list && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Each month" value={money(list.monthly)} note={`${list.counts.member} paying ${list.counts.member === 1 ? "member" : "members"}`} />
            <Stat label="In their week" value={list.counts.week.toLocaleString("en-US")} note="Their first $99 is coming" />
            <Stat
              label="Weeks that became $99"
              value={list.weeks.over ? `${Math.round((list.weeks.paying / list.weeks.over) * 100)}%` : "—"}
              note={`${list.weeks.paying} of ${list.weeks.over} weeks that are over`}
            />
            <Stat
              label="Needs a look"
              value={(list.counts.failed + list.counts.cancelling).toLocaleString("en-US")}
              note={`${list.counts.failed} payment failed · ${list.counts.cancelling} cancelled`}
            />
          </div>
          {list.rows.length ? (
            <div className={`${CARD} overflow-x-auto`}>
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-ink-3">
                    <th className="px-4 py-2.5 font-medium">Member</th>
                    <th className="px-2 py-2.5 font-medium">Status</th>
                    <th className="px-2 py-2.5 font-medium">Next</th>
                    <th className="px-2 py-2.5 font-medium">Started</th>
                    <th className="px-4 py-2.5 text-right font-medium">Stripe</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {list.rows.map((r) => (
                    <tr key={r.id}>
                      <td className="max-w-[260px] truncate px-4 py-2.5 text-ink">
                        {r.userId ? (
                          <Link href={`/admin/accounts/${r.userId}`} prefetch={false} className="hover:underline">
                            {r.email}
                          </Link>
                        ) : (
                          r.email
                        )}
                      </td>
                      <td className="px-2 py-2.5">
                        <Badge tone={STATE[r.state].tone}>{STATE[r.state].label}</Badge>
                      </td>
                      <td className="whitespace-nowrap px-2 py-2.5 text-ink-2">{nextOf(r)}</td>
                      <td className="whitespace-nowrap px-2 py-2.5 font-mono-nums text-ink-3">{day(r.started)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <a
                          href={`https://dashboard.stripe.com/${r.live ? "" : "test/"}subscriptions/${r.id}`}
                          target="_blank"
                          rel="noopener"
                          className="text-xs text-ink-2 hover:text-ink hover:underline"
                        >
                          Open
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className={`${CARD} px-4 py-8 text-center text-sm text-ink-3`}>No memberships yet. The first $14 week shows here the moment it&apos;s paid.</p>
          )}
          {list.capped && <p className="text-xs text-ink-3">Showing the newest 1,000 subscriptions in Stripe.</p>}
        </>
      )}
    </div>
  );
}
