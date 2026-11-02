import { CARD } from "@/components/ui";
import { DATE, TIME, requireAdmin } from "@/lib/adminGate";
import { supabaseService } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const metadata = { title: "Waitlist — Admin — HighStrike" };

/** Admin → Waitlist (from getripping.com's): everyone who left their email, newest first, and whether they've joined since. */
export default async function AdminWaitlistPage() {
  await requireAdmin();
  const db = supabaseService();
  const { data, error } = await db.from("waitlist_signups").select("id, email, source, created_at").order("created_at", { ascending: false }).limit(5000);
  const rows = (data ?? []) as { id: string; email: string; source: string | null; created_at: string }[];
  const { data: joined } = rows.length
    ? await db.from("profiles").select("email, plan").in("email", rows.map((r) => r.email.toLowerCase()).slice(0, 1000))
    : { data: [] };
  const account = new Map(((joined ?? []) as { email: string; plan: string | null }[]).map((p) => [p.email.toLowerCase(), p.plan]));
  const signedUp = rows.filter((r) => account.has(r.email.toLowerCase())).length;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-2">
        {rows.length} on the waitlist · {signedUp} have an account since.
      </p>
      {error && <p className="rounded-lg border border-down/30 bg-down-soft px-3 py-2 text-sm text-down">The waitlist couldn&apos;t be read: {error.message}</p>}
      <section className={`${CARD} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs font-medium text-ink-3">
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-2 py-2 font-medium">Source</th>
              <th className="px-2 py-2 font-medium">Account</th>
              <th className="px-4 py-2 text-right font-medium">Signed up</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => {
              const plan = account.get(r.email.toLowerCase());
              return (
                <tr key={r.id}>
                  <td className="px-4 py-2 text-ink">{r.email}</td>
                  <td className="px-2 py-2 text-ink-2">{r.source ?? "—"}</td>
                  <td className="px-2 py-2 text-ink-2">{plan === undefined ? "—" : plan === "lifetime" ? "Lifetime member" : "Account, not paid"}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-right font-mono-nums text-ink-2">
                    {DATE.format(new Date(r.created_at))} <span className="text-ink-3">{TIME.format(new Date(r.created_at))}</span>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-4 text-ink-3">
                  Nobody on the waitlist.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
