import Link from "next/link";
import { Badge, CARD, Stat } from "@/components/ui";
import { DATE, daysAgo, requireAdmin } from "@/lib/adminGate";
import { growth } from "@/lib/adminGrowth";
import { supabaseService } from "@/lib/stripe";
import { membershipBadge } from "@/lib/adminAccounts";
import { SALE_ALERT_TO } from "@/lib/saleAlert";
import GenerateNowButton from "./GenerateNowButton";
import TestSaleAlertButton from "./TestSaleAlertButton";
import BillingSetup from "./BillingSetup";

export const dynamic = "force-dynamic";

const money = (cents: number) => `$${Math.round(cents / 100).toLocaleString("en-US")}`;
const DAY = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" });

/**
 * Overview, as getripping.com's admin has it: the figures that matter on top (accounts, members, money, errors), the
 * last 14 days a row each, and the newest accounts; with HighStrike's own switches (the setup engine, the sale alert).
 */
export default async function AdminOverviewPage() {
  await requireAdmin();
  const db = supabaseService();
  const [g, accounts7d, errors24h, latest] = await Promise.all([
    growth(14).catch(() => null),
    db.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", daysAgo(7)),
    db.from("error_reports").select("id", { count: "exact", head: true }).gte("created_at", daysAgo(1)),
    db.from("profiles").select("id, email, plan, is_admin, created_at").order("created_at", { ascending: false }).limit(8),
  ]);
  const days = [...(g?.days ?? [])].reverse();
  const revenue14 = days.reduce((s, d) => s + d.revenue, 0);
  const sales14 = days.reduce((s, d) => s + d.sales, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Accounts" value={(g?.accounts ?? 0).toLocaleString("en-US")} note={`${accounts7d.count ?? 0} new in 7 days`} />
        <Stat label="Members" value={(g?.members ?? 0).toLocaleString("en-US")} note={`${sales14} ${sales14 === 1 ? "payment" : "payments"} in 14 days`} />
        <Stat label="Revenue, 14 days" value={money(revenue14)} note="Paid in Stripe, less refunds" />
        <Stat
          label="Errors, 24 hours"
          value={(errors24h.count ?? 0).toLocaleString("en-US")}
          aside={(errors24h.count ?? 0) > 0 ? <Link href="/admin/errors" className="text-xs text-ink-2 hover:text-ink hover:underline">See them</Link> : undefined}
          note="Reported by pages, routes and browsers"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className={CARD}>
          <h2 className="border-b border-line px-4 py-2.5 text-sm font-medium text-ink">By day (14 days)</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs font-medium text-ink-3">
                <th className="px-4 py-2 font-medium">Day</th>
                <th className="px-2 py-2 text-right font-medium">New accounts</th>
                <th className="px-2 py-2 text-right font-medium">Sales</th>
                <th className="px-4 py-2 text-right font-medium">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {days.map((d) => (
                <tr key={d.day}>
                  <td className="px-4 py-1.5 text-ink-2">{DAY.format(new Date(`${d.day}T12:00:00Z`))}</td>
                  <td className="px-2 py-1.5 text-right font-mono-nums text-ink">{d.signups}</td>
                  <td className="px-2 py-1.5 text-right font-mono-nums text-ink">{d.sales}</td>
                  <td className="px-4 py-1.5 text-right font-mono-nums text-ink">{money(d.revenue)}</td>
                </tr>
              ))}
              {days.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-ink-3">
                    The figures couldn&apos;t be read.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <div className="flex flex-col gap-6">
          <section className={CARD}>
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <h2 className="text-sm font-medium text-ink">Newest accounts</h2>
              <Link href="/admin/accounts" className="text-xs text-ink-2 hover:text-ink hover:underline">
                All accounts
              </Link>
            </div>
            <ul className="divide-y divide-line text-sm">
              {((latest.data ?? []) as { id: string; email: string | null; plan: string | null; is_admin: boolean; created_at: string }[]).map((a) => (
                <li key={a.id} className="flex items-center gap-2 px-4 py-2">
                  <Link href={`/admin/accounts/${a.id}`} prefetch={false} className="min-w-0 flex-1 truncate text-ink hover:underline">
                    {a.email ?? a.id.slice(0, 8)}
                  </Link>
                  <Badge tone={membershipBadge({ plan: a.plan, admin: a.is_admin }).tone}>{membershipBadge({ plan: a.plan, admin: a.is_admin }).label}</Badge>
                  <span className="whitespace-nowrap text-xs font-mono-nums text-ink-3">{DATE.format(new Date(a.created_at))}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className={`${CARD} flex flex-wrap items-center justify-between gap-3 px-4 py-3.5`}>
            <div>
              <p className="text-sm font-medium text-ink">Setup engine</p>
              <p className="mt-0.5 text-[13px] text-ink-3">Runs automatically at 8:30 AM ET, or trigger a fresh report now.</p>
            </div>
            <GenerateNowButton />
          </section>
          <section className={`${CARD} flex flex-wrap items-center justify-between gap-3 px-4 py-3.5`}>
            <div>
              <p className="text-sm font-medium text-ink">Trial alerts</p>
              <p className="mt-0.5 text-[13px] text-ink-3">An email for every new $14 week, from payments@mail.highstrike.com.</p>
            </div>
            <TestSaleAlertButton to={SALE_ALERT_TO} />
          </section>
          <section className={`${CARD} flex flex-col gap-3 px-4 py-3.5`}>
            <div>
              <p className="text-sm font-medium text-ink">Billing setup</p>
              <p className="mt-0.5 text-[13px] text-ink-3">The $14 week and $99/month in Stripe: the price, the billing page and the webhook.</p>
            </div>
            <BillingSetup />
          </section>
        </div>
      </div>
    </div>
  );
}
