import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "Insider Feed — HighStrike",
};

function money(n: number | null) {
  if (n == null) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

export default async function InsidersPage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin?next=/insiders");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, name, avatar_url")
    .eq("id", user.id)
    .single();

  const since30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const since14 = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);

  const [{ data: trades }, { data: buys }] = await Promise.all([
    supabase
      .from("insider_trades")
      .select("accession, ticker, filed_at, owner_name, owner_title, transaction_code, shares, value")
      .gte("filed_at", since30)
      .order("filed_at", { ascending: false })
      .limit(100),
    supabase
      .from("insider_trades")
      .select("ticker, owner_name")
      .eq("transaction_code", "P")
      .gte("filed_at", since14),
  ]);

  const clusterMap = new Map<string, Set<string>>();
  for (const b of buys ?? []) {
    (clusterMap.get(b.ticker) ?? clusterMap.set(b.ticker, new Set()).get(b.ticker)!).add(
      b.owner_name
    );
  }
  const clusters = [...clusterMap.entries()]
    .filter(([, owners]) => owners.size >= 2)
    .sort((a, b) => b[1].size - a[1].size);

  return (
    <AppShell
      email={user.email ?? ""}
      isAdmin={Boolean(profile?.is_admin)}
      active="insiders"
      displayName={profile?.name}
      avatarUrl={profile?.avatar_url}
    >
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs uppercase tracking-wider text-ink-3">Insider Feed</p>
          <h1 className="mt-1 font-display text-2xl font-bold sm:text-3xl">
            Who&apos;s buying their own stock
          </h1>
        </div>
        <p className="text-xs text-ink-3">
          Form 4 open-market trades, ingested nightly from SEC EDGAR.
        </p>
      </div>

      {clusters.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-3">
          {clusters.map(([ticker, owners]) => (
            <Link
              key={ticker}
              href={`/symbol/${ticker}`}
              className="rounded-2xl border border-accent/40 bg-panel px-4 py-3 transition hover:border-accent"
            >
              <span className="font-display text-base font-bold">${ticker}</span>
              <span className="ml-2 text-sm text-ink-2">
                {owners.size} buyers · 14 days
              </span>
              <span className="ml-2 rounded-full bg-accent px-2 py-0.5 font-display text-[10px] font-bold text-bg">
                CLUSTER
              </span>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-panel">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-[10px] uppercase tracking-wider text-ink-3">
              <th className="px-4 py-2.5 font-medium">Filed</th>
              <th className="px-4 py-2.5 font-medium">Ticker</th>
              <th className="px-4 py-2.5 font-medium">Insider</th>
              <th className="px-4 py-2.5 font-medium">Type</th>
              <th className="px-4 py-2.5 text-right font-medium">Shares</th>
              <th className="px-4 py-2.5 text-right font-medium">Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {(trades ?? []).map((t) => (
              <tr key={`${t.accession}-${t.transaction_code}`} className="transition hover:bg-panel-2">
                <td className="whitespace-nowrap px-4 py-2.5 font-mono-nums text-xs text-ink-2">
                  {t.filed_at}
                </td>
                <td className="px-4 py-2.5">
                  <Link
                    href={`/symbol/${t.ticker}`}
                    className="font-display font-semibold transition hover:text-accent"
                  >
                    {t.ticker}
                  </Link>
                </td>
                <td className="max-w-0 truncate px-4 py-2.5 text-ink-2" style={{ minWidth: "180px" }}>
                  {t.owner_name}
                  {t.owner_title && (
                    <span className="ml-1.5 text-xs text-ink-3">· {t.owner_title}</span>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={`rounded-full px-2 py-0.5 font-display text-[10px] font-bold ${
                      t.transaction_code === "P" ? "bg-accent text-bg" : "bg-down/90 text-bg"
                    }`}
                  >
                    {t.transaction_code === "P" ? "BUY" : "SELL"}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right font-mono-nums text-ink-2">
                  {t.shares != null ? Number(t.shares).toLocaleString() : "—"}
                </td>
                <td className="px-4 py-2.5 text-right font-mono-nums text-ink">
                  {money(t.value != null ? Number(t.value) : null)}
                </td>
              </tr>
            ))}
            {(trades ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-ink-3">
                  No filings ingested yet — the first EDGAR sweep runs tonight and
                  filings appear here as insiders report.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-6 text-xs leading-relaxed text-ink-3">
        Source: SEC EDGAR Form 4 filings for the HighStrike symbol universe,
        open-market purchases and sales only (transaction codes P and S),
        aggregated per filing. Clusters flag two or more distinct open-market
        buyers within 14 days. Market commentary, not investment advice.
      </p>
    </AppShell>
  );
}
