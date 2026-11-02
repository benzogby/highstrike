import Link from "next/link";
import { Badge, CARD } from "@/components/ui";
import { DATE, TIME, requireAdmin } from "@/lib/adminGate";
import { supabaseService } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const metadata = { title: "Emails — Admin — HighStrike" };

const PER_PAGE = 20;
const KIND: Record<string, string> = { sale_alert: "Sale alert", payment: "Payment", price_alert: "Price alert" };

/**
 * Admin → Emails (from getripping.com's): every email the site hands to Resend, newest first, twenty a page, logged by
 * src/lib/mail.ts. A row opens the email as it went out.
 */
export default async function AdminEmailsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireAdmin();
  const page = Math.max(1, Math.floor(Number((await searchParams).page ?? 1)) || 1);
  const from = (page - 1) * PER_PAGE;
  const { data, count, error } = await supabaseService()
    .from("email_log")
    .select("id, created_at, to_address, subject, kind, status, error", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + PER_PAGE - 1);
  const rows = (data ?? []) as { id: number; created_at: string; to_address: string; subject: string; kind: string | null; status: string; error: string | null }[];
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const link = (n: number) => (n === 1 ? "/admin/emails" : `/admin/emails?page=${n}`);
  const pager = "rounded-md border border-line-strong px-2.5 py-1 text-xs font-medium text-ink-2 hover:text-ink";

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-2">Every email the site sends, newest first. Click one to see it as it went out. Emails with a sign-in link or a code keep their subject but not their words.</p>
      {error && <p className="rounded-lg border border-down/30 bg-down-soft px-3 py-2 text-sm text-down">The log couldn&apos;t be read: {error.message}</p>}
      <section className={`${CARD} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs font-medium text-ink-3">
              <th className="px-4 py-2 font-medium">Sent</th>
              <th className="px-2 py-2 font-medium">To</th>
              <th className="px-2 py-2 font-medium">Subject</th>
              <th className="px-2 py-2 font-medium">Kind</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.id} className="relative hover:bg-panel-2">
                <td className="whitespace-nowrap px-4 py-2 font-mono-nums text-ink-2">
                  <Link href={`/admin/emails/${r.id}`} prefetch={false} className="after:absolute after:inset-0">
                    {DATE.format(new Date(r.created_at))} <span className="text-ink-3">{TIME.format(new Date(r.created_at))}</span>
                  </Link>
                </td>
                <td className="max-w-[220px] truncate px-2 py-2 text-ink">{r.to_address}</td>
                <td className="max-w-[360px] truncate px-2 py-2 text-ink">{r.subject}</td>
                <td className="whitespace-nowrap px-2 py-2 text-ink-2">{r.kind ? (KIND[r.kind] ?? r.kind) : "—"}</td>
                <td className="px-4 py-2" title={r.error ?? undefined}>
                  {r.status === "sent" ? <Badge tone="up">Sent</Badge> : <Badge tone="down">Failed</Badge>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-4 text-ink-3">
                  No emails logged yet. The log starts on November 2, 2026.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
      {pages > 1 && (
        <div className="flex items-center justify-between text-xs text-ink-3">
          <span>
            Page {page} of {pages} · {total} emails
          </span>
          <span className="flex gap-2">
            {page > 1 && <Link className={pager} href={link(page - 1)}>Newer</Link>}
            {page < pages && <Link className={pager} href={link(page + 1)}>Older</Link>}
          </span>
        </div>
      )}
    </div>
  );
}
