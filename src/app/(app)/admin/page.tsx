import { supabaseServer } from "@/lib/supabase/server";
import GenerateNowButton from "./GenerateNowButton";
import TestSaleAlertButton from "./TestSaleAlertButton";
import { SALE_ALERT_TO } from "@/lib/saleAlert";

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  });
}

export default async function AdminOverviewPage() {
  const supabase = await supabaseServer();
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

  const [members, waitlist, memberCount, weekCount, waitlistCount] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("email, is_admin, created_at")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("waitlist_signups")
        .select("email, source, created_at")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .gte("created_at", weekAgo),
      supabase
        .from("waitlist_signups")
        .select("id", { count: "exact", head: true }),
    ]);

  const stats = [
    { label: "Total members", value: memberCount.count ?? 0 },
    { label: "New this week", value: weekCount.count ?? 0 },
    { label: "Waitlist signups", value: waitlistCount.count ?? 0 },
  ];

  return (
    <>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-panel px-5 py-4">
        <div>
          <p className="font-display text-[15px] text-ink">Setup engine</p>
          <p className="mt-0.5 text-[13px] text-ink-3">
            Runs automatically at 8:30 AM ET — or trigger a fresh report now.
          </p>
        </div>
        <GenerateNowButton />
      </div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-panel px-5 py-4">
        <div>
          <p className="font-display text-[15px] text-ink">Sale alerts</p>
          <p className="mt-0.5 text-[13px] text-ink-3">An email for every $397 purchase, from payments@mail.highstrike.com.</p>
        </div>
        <TestSaleAlertButton to={SALE_ALERT_TO} />
      </div>
      <div className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="bg-panel px-5 py-4">
            <p className="text-[13px] text-ink-3">{s.label}</p>
            <p className="mt-1 font-display text-3xl leading-none text-ink">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 grid gap-8 xl:grid-cols-2">
        <section>
          <h2 className="font-display text-[15px] text-ink">
            Members {members.data ? `(latest ${members.data.length})` : ""}
          </h2>
          <div className="mt-3 overflow-hidden rounded-xl border border-line bg-panel">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink-3 font-medium">
                  <th className="w-full px-5 py-2.5 font-medium">Email</th>
                  <th className="px-3 py-2.5 font-medium">Role</th>
                  <th className="px-5 py-2.5 text-right font-medium">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {(members.data ?? []).map((m) => (
                  <tr key={m.email}>
                    <td className="px-5 py-2.5 text-ink">{m.email}</td>
                    <td className="px-3 py-2.5">
                      {m.is_admin ? (
                        <span className="rounded-md bg-accent-soft px-1.5 py-0.5 text-xs font-medium text-accent-ink ring-1 ring-inset ring-accent/25">
                          ADMIN
                        </span>
                      ) : (
                        <span className="text-xs text-ink-3">Member</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-5 py-2.5 text-right font-mono-nums text-xs text-ink-2">
                      {formatWhen(m.created_at)}
                    </td>
                  </tr>
                ))}
                {(members.data ?? []).length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-5 py-6 text-center text-sm text-ink-3">
                      No members yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="font-display text-[15px] text-ink">
            Waitlist {waitlist.data ? `(latest ${waitlist.data.length})` : ""}
          </h2>
          <div className="mt-3 overflow-hidden rounded-xl border border-line bg-panel">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink-3 font-medium">
                  <th className="w-full px-5 py-2.5 font-medium">Email</th>
                  <th className="px-3 py-2.5 font-medium">Source</th>
                  <th className="px-5 py-2.5 text-right font-medium">Signed up</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {(waitlist.data ?? []).map((w) => (
                  <tr key={w.email}>
                    <td className="px-5 py-2.5 text-ink">{w.email}</td>
                    <td className="px-3 py-2.5 text-xs text-ink-3">{w.source ?? "—"}</td>
                    <td className="whitespace-nowrap px-5 py-2.5 text-right font-mono-nums text-xs text-ink-2">
                      {formatWhen(w.created_at)}
                    </td>
                  </tr>
                ))}
                {(waitlist.data ?? []).length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-5 py-6 text-center text-sm text-ink-3">
                      No waitlist signups yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
