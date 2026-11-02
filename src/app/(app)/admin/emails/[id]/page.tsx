import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, CARD } from "@/components/ui";
import { DATE, TIME, requireAdmin } from "@/lib/adminGate";
import { supabaseService } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const metadata = { title: "Email — Admin — HighStrike" };

/** One email as it went out, in a sandboxed frame so its styles and links stay inside it. */
export default async function AdminEmailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const { data } = await supabaseService().from("email_log").select("*").eq("id", Number(id)).maybeSingle();
  if (!data) notFound();
  const e = data as { created_at: string; to_address: string; from_address: string | null; subject: string; kind: string | null; html: string | null; status: string; error: string | null; resend_id: string | null };
  const at = new Date(e.created_at);
  const facts: [string, string][] = [
    ["To", e.to_address],
    ["From", e.from_address ?? "—"],
    ["Sent", `${DATE.format(at)}, ${TIME.format(at)} ET`],
    ["Resend ID", e.resend_id ?? "—"],
  ];
  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/emails" className="text-[13px] text-ink-3 hover:text-ink">
        ← Emails
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-display text-xl text-ink">{e.subject}</h2>
        {e.status === "sent" ? <Badge tone="up">Sent</Badge> : <Badge tone="down">Failed</Badge>}
      </div>
      {e.error && <p className="rounded-lg border border-down/30 bg-down-soft px-3 py-2 text-sm text-down">{e.error}</p>}
      <dl className={`${CARD} grid divide-y divide-line text-sm`}>
        {facts.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 px-4 py-2">
            <dt className="text-ink-3">{k}</dt>
            <dd className="truncate text-ink">{v}</dd>
          </div>
        ))}
      </dl>
      {e.html ? (
        <iframe title={e.subject} sandbox="" srcDoc={e.html} className="h-[70vh] w-full rounded-xl border border-line bg-white" />
      ) : (
        <p className="text-sm text-ink-3">This email had a sign-in link or a code, so its words weren&apos;t kept.</p>
      )}
    </div>
  );
}
