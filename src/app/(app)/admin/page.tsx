import { supabaseServer } from "@/lib/supabase/server";
import GenerateNowButton from "./GenerateNowButton";

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
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-panel px-5 py-4">
        <div>
          <p className="font-display text-sm font-semibold">Setup Engine</p>
          <p className="text-xs text-ink-3">
            Runs automatically at 8:30 AM ET — or trigger a fresh report now.
          </p>
        </div>
        <GenerateNowButton />
      </div>
      <div className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="bg-panel px-6 py-7">
            <p className="font-display text-4xl font-bold text-accent">{s.value}</p>
            <p className="mt-1 text-xs uppercase tracking-wider text-ink-3">
              {s.label}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-10 grid gap-8 xl:grid-cols-2">
        <section>
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-ink-2">
            Members {members.data ? `(latest ${members.data.length})` : ""}
          </h2>
          <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-panel">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[10px] uppercase tracking-wider text-ink-3">
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
                        <span className="rounded-full bg-accent px-2 py-0.5 font-display text-[10px] font-bold text-bg">
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
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-ink-2">
            Waitlist {waitlist.data ? `(latest ${waitlist.data.length})` : ""}
          </h2>
          <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-panel">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[10px] uppercase tracking-wider text-ink-3">
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
