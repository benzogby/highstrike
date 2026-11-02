import Link from "next/link";
import { Badge, CARD } from "@/components/ui";
import { DATE, TIME } from "@/lib/adminGate";
import { PAYMENT_STATUS_LABEL, money, stripePaymentUrl, tallyPayments, type PaymentRow, type PaymentStatus } from "@/lib/paymentRows";

const TONE: Record<PaymentStatus, "up" | "down" | "warn" | "accent" | "neutral"> = {
  paid: "up",
  declined: "down",
  disputed: "warn",
  pending: "accent",
  refunded: "neutral",
  partly_refunded: "neutral",
};

/**
 * Admin → Payments' table, as getripping.com's (src/lib/paymentRows.ts): a line each, newest first, with the payer's
 * flag, their address, the amount, where it stands, the card, and, under a decline's reason, everything else Stripe said.
 * `compact` drops the payer column, for one account's page.
 */
export default function PaymentsTable({ rows, capped, compact = false }: { rows: PaymentRow[]; capped: boolean; compact?: boolean }) {
  const t = tallyPayments(rows);
  const th = "px-2 py-2 font-medium";
  return (
    <section className={CARD}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
        <h2 className="text-sm font-medium text-ink">Payments</h2>
        <span className="text-xs text-ink-3">
          {capped ? `The newest ${t.total.toLocaleString("en-US")}` : `${t.total.toLocaleString("en-US")} ${t.total === 1 ? "payment" : "payments"}`} · {t.paid} paid · {t.declined} declined
          {t.refunded > 0 ? ` · ${t.refunded} refunded` : ""} · {money(t.collected, "usd")} collected
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-ink-3">
              <th className="px-4 py-2 font-medium">When</th>
              {!compact && <th className={th} title="The billing address's country, else the country the card was issued in">Payer</th>}
              <th className={`${th} text-right`}>Amount</th>
              <th className={th}>Status</th>
              <th className={th}>Card</th>
              <th className={th}>Details</th>
              <th className="px-4 py-2 font-medium"><span className="sr-only">Stripe</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-line align-top hover:bg-panel-2/60">
                <td className="whitespace-nowrap px-4 py-2 tabular-nums text-ink">
                  {DATE.format(r.at)}
                  <span className="block text-xs text-ink-3">{TIME.format(r.at)} ET</span>
                </td>
                {!compact && (
                  <td className="max-w-[300px] px-2 py-2">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span aria-hidden className="shrink-0 text-base leading-none" title={r.country ? `${r.country.from === "billing" ? "Billing address" : "Card issued"} in ${r.country.name}` : "Country unknown"}>
                        {r.country?.flag ?? "🏳️"}
                      </span>
                      <span className="sr-only">{r.country ? r.country.name : "Country unknown"}</span>
                      {r.userId ? (
                        <Link href={`/admin/accounts/${r.userId}`} prefetch={false} className="truncate font-medium text-ink hover:underline">
                          {r.email || r.userId.slice(0, 8)}
                        </Link>
                      ) : (
                        <span className="truncate font-medium text-ink">{r.email || r.customerId || "Unknown payer"}</span>
                      )}
                      {!r.userId && <Badge className="shrink-0">No account</Badge>}
                    </span>
                  </td>
                )}
                <td className={`whitespace-nowrap px-2 py-2 text-right font-medium tabular-nums ${r.status === "declined" ? "text-ink-3" : "text-ink"}`}>{r.amount}</td>
                <td className="px-2 py-2">
                  <Badge tone={TONE[r.status]}>{PAYMENT_STATUS_LABEL[r.status]}</Badge>
                </td>
                <td className="whitespace-nowrap px-2 py-2 text-ink-2">{r.card ?? "—"}</td>
                <td className="min-w-[240px] px-2 py-2 text-xs leading-relaxed">
                  {r.decline && (
                    <span className="block font-medium text-down" title={r.decline.code ? `Stripe's code: ${r.decline.code}` : undefined}>
                      {r.decline.message}
                    </span>
                  )}
                  {r.details.length > 0 && <span className="block text-ink-3">{r.details.join(" · ")}</span>}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-right text-xs">
                  <a href={stripePaymentUrl("payments", r.paymentIntent ?? r.id, r.livemode)} target="_blank" rel="noreferrer" className="text-ink-2 hover:text-ink hover:underline">
                    Stripe ↗
                  </a>
                  {r.receiptUrl && (
                    <a href={r.receiptUrl} target="_blank" rel="noreferrer" className="ml-3 text-ink-2 hover:text-ink hover:underline">
                      Receipt
                    </a>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-4 text-ink-3">
                  No payments yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
