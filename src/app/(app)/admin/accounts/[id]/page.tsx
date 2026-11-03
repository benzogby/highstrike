import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, CARD } from "@/components/ui";
import { DATE, TIME, requireAdmin } from "@/lib/adminGate";
import { accountOf, accountTraffic, membershipBadge } from "@/lib/adminAccounts";
import { paymentsList } from "@/lib/adminPayments";
import { countryOf } from "@/lib/paymentRows";
import PaymentsTable from "../../payments/PaymentsTable";
import AccountActions from "../AccountActions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Account — Admin — HighStrike" };

const when = (iso: string | null) => (iso ? `${DATE.format(new Date(iso))}, ${TIME.format(new Date(iso))} ET` : "—");

/** One account (from getripping.com's account page): who it is, its access, its payments in Stripe, and its pages. */
export default async function AdminAccountPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireAdmin();
  const { id } = await params;
  const a = await accountOf(id);
  if (!a) notFound();
  const [traffic, payments] = await Promise.all([
    accountTraffic(a.id),
    a.stripeCustomer ? paymentsList(a.stripeCustomer).catch(() => null) : Promise.resolve(null),
  ]);
  const c = countryOf(a.country);
  const facts: [string, string][] = [
    ["Name", a.name || "—"],
    ["Sign-in", a.provider === "google" ? "Google" : "Email and password"],
    ["Joined", when(a.joined)],
    ["Last signed in", when(a.lastSignIn)],
    ["Last seen", when(a.lastSeen)],
    ["Country", c ? `${c.flag} ${c.name}` : "—"],
    ["Agreed to the Terms", a.terms ? when(a.terms) : "No record"],
    ["Stripe customer", a.stripeCustomer ?? "—"],
  ];

  return (
    <div className="flex flex-col gap-5">
      <Link href="/admin/accounts" className="text-[13px] text-ink-3 hover:text-ink">
        ← Accounts
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="truncate font-display text-xl text-ink">{a.email}</h2>
          <div className="mt-1.5 flex gap-1">
            <Badge tone={membershipBadge(a).tone}>{membershipBadge(a).label}</Badge>
            {a.admin && <Badge tone="accent">Admin</Badge>}
          </div>
        </div>
        <AccountActions id={a.id} email={a.email} granted={a.granted} admin={a.admin} self={a.id === me.id} />
      </div>

      <dl className={`${CARD} grid divide-y divide-line sm:grid-cols-2 sm:divide-y-0`}>
        {facts.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 border-line px-4 py-2.5 text-sm sm:border-b">
            <dt className="text-ink-3">{k}</dt>
            <dd className="truncate text-right text-ink">
              {k === "Stripe customer" && a.stripeCustomer ? (
                <a href={`https://dashboard.stripe.com/customers/${a.stripeCustomer}`} target="_blank" rel="noreferrer" className="font-mono text-xs hover:underline">
                  {v} ↗
                </a>
              ) : (
                v
              )}
            </dd>
          </div>
        ))}
      </dl>

      {payments ? <PaymentsTable rows={payments.rows} capped={false} compact /> : <p className="text-sm text-ink-3">No payments in Stripe for this account.</p>}

      <section className={CARD}>
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <h3 className="text-sm font-medium text-ink">Pages they open most</h3>
          <span className="text-xs text-ink-3">{traffic.views} page views while signed in</span>
        </div>
        <ul className="divide-y divide-line text-sm">
          {traffic.pages.map(([path, n]) => (
            <li key={path} className="flex justify-between px-4 py-2">
              <span className="font-mono text-xs text-ink-2">{path}</span>
              <span className="font-mono-nums text-ink-2">{n}</span>
            </li>
          ))}
          {traffic.pages.length === 0 && <li className="px-4 py-3 text-ink-3">No visits recorded while signed in.</li>}
        </ul>
      </section>
    </div>
  );
}
