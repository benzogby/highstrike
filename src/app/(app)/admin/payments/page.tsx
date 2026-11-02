import { requireAdmin } from "@/lib/adminGate";
import { paymentsList } from "@/lib/adminPayments";
import PaymentsTable from "./PaymentsTable";

export const dynamic = "force-dynamic";
export const metadata = { title: "Payments — Admin — HighStrike" };

/** Admin → Payments (from getripping.com's): every payment Stripe has taken or tried, declined ones included. */
export default async function AdminPaymentsPage() {
  await requireAdmin();
  const read = await paymentsList().then(
    (list) => ({ list, why: null as string | null }),
    (e: unknown) => ({ list: null, why: e instanceof Error ? e.message : "Stripe didn't answer." })
  );
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-2">
        Every payment Stripe has taken or tried, declined ones included, newest first. Each card tried is a line of its own. Read from Stripe as the page opens.
      </p>
      {read.why && (
        <p role="alert" className="rounded-lg border border-down/30 bg-down-soft px-3 py-2 text-sm text-down">
          The payments couldn&apos;t be read: {read.why}
        </p>
      )}
      {!read.why && !read.list && <p className="text-sm text-ink-3">Stripe isn&apos;t set up on this site, so there are no payments to list.</p>}
      {read.list && <PaymentsTable rows={read.list.rows} capped={read.list.capped} />}
    </div>
  );
}
