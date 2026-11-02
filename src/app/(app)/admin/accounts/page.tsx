import Link from "next/link";
import { Badge, CARD, INPUT } from "@/components/ui";
import { DATE, requireAdmin } from "@/lib/adminGate";
import { accountsList, type Account } from "@/lib/adminAccounts";
import { countryOf } from "@/lib/paymentRows";

export const dynamic = "force-dynamic";
export const metadata = { title: "Accounts — Admin — HighStrike" };

const SHOW = { all: "All", members: "Members", free: "Not paid", admins: "Admins" } as const;
type Show = keyof typeof SHOW;

const ago = (iso: string | null) => {
  if (!iso) return "—";
  const d = (Date.now() - Date.parse(iso)) / 86_400_000;
  return d < 1 ? "Today" : d < 2 ? "Yesterday" : d < 30 ? `${Math.floor(d)}d ago` : DATE.format(new Date(iso));
};

/**
 * Admin → Accounts (from getripping.com's): every account, newest first, with its sign-in, membership, country and last
 * visit; search by email or name, filter by membership, and open one for its payments, pages and buttons.
 */
export default async function AdminAccountsPage({ searchParams }: { searchParams: Promise<{ q?: string; show?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().toLowerCase();
  const show: Show = sp.show && sp.show in SHOW ? (sp.show as Show) : "all";
  const all = await accountsList();
  const keep = (a: Account) =>
    (show === "all" || (show === "members" && a.member) || (show === "free" && !a.member && !a.admin) || (show === "admins" && a.admin)) &&
    (!q || a.email.toLowerCase().includes(q) || (a.name ?? "").toLowerCase().includes(q));
  const rows = all.filter(keep);
  const members = all.filter((a) => a.member).length;
  const link = (s: Show) => `/admin/accounts?${new URLSearchParams({ ...(q ? { q } : {}), ...(s !== "all" ? { show: s } : {}) })}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <form className="min-w-[220px] flex-1 sm:max-w-xs">
          {show !== "all" && <input type="hidden" name="show" value={show} />}
          <input name="q" defaultValue={sp.q ?? ""} placeholder="Search email or name" className={INPUT} aria-label="Search accounts" />
        </form>
        <nav className="flex flex-wrap gap-1.5" aria-label="Filter">
          {(Object.keys(SHOW) as Show[]).map((s) => (
            <Link
              key={s}
              href={link(s)}
              aria-current={s === show ? "page" : undefined}
              className={`rounded-md px-2.5 py-1 text-[13px] font-medium transition ${s === show ? "bg-panel-2 text-ink ring-1 ring-inset ring-line-strong" : "text-ink-3 hover:text-ink"}`}
            >
              {SHOW[s]}
            </Link>
          ))}
        </nav>
        <span className="text-xs text-ink-3 sm:ml-auto">
          {all.length} accounts · {members} with lifetime access
        </span>
      </div>

      <section className={`${CARD} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-ink-3">
              <th className="px-4 py-2 font-medium">Account</th>
              <th className="px-2 py-2 font-medium">Access</th>
              <th className="px-2 py-2 font-medium">Sign-in</th>
              <th className="px-2 py-2 font-medium">Country</th>
              <th className="px-2 py-2 font-medium">Last seen</th>
              <th className="px-4 py-2 text-right font-medium">Joined</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => {
              const c = countryOf(a.country);
              return (
                <tr key={a.id} className="border-t border-line hover:bg-panel-2/60">
                  <td className="max-w-[320px] px-4 py-2">
                    <Link href={`/admin/accounts/${a.id}`} prefetch={false} className="block truncate font-medium text-ink hover:underline">
                      {a.email || a.id.slice(0, 8)}
                    </Link>
                    {a.name && <span className="block truncate text-xs text-ink-3">{a.name}</span>}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2">
                    <span className="flex gap-1">
                      {a.member ? <Badge tone="up">Lifetime</Badge> : <Badge>Not paid</Badge>}
                      {a.admin && <Badge tone="accent">Admin</Badge>}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-ink-2">{a.provider === "google" ? "Google" : "Email"}</td>
                  <td className="whitespace-nowrap px-2 py-2 text-ink-2">{c ? `${c.flag} ${c.name}` : "—"}</td>
                  <td className="whitespace-nowrap px-2 py-2 text-ink-2">{ago(a.lastSeen ?? a.lastSignIn)}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums text-ink-2">{DATE.format(new Date(a.joined))}</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-4 text-ink-3">
                  No accounts match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
