import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import { fetchQuotes } from "@/lib/quotes";
import PriceChart from "./PriceChart";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ticker: string }>;
}): Promise<Metadata> {
  const { ticker } = await params;
  return { title: `$${ticker.toUpperCase()} — HighStrike` };
}

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  target_hit: "Target hit",
  stopped: "Stopped",
  expired: "Expired",
};

export default async function SymbolPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker: raw } = await params;
  const ticker = raw.toUpperCase();
  if (!/^[A-Z.-]{1,10}$/.test(ticker)) notFound();

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/signin?next=/symbol/${ticker}`);

  const [{ data: profile }, { data: symbol }, quoteArr, { data: history }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("is_admin, name, avatar_url")
        .eq("id", user.id)
        .single(),
      supabase
        .from("symbols")
        .select("ticker, name, exchange, sector")
        .eq("ticker", ticker)
        .maybeSingle(),
      fetchQuotes([ticker]),
      supabase
        .from("setups")
        .select(
          "report_date, direction, justification, price_target, time_frame, flow_score, status, current_pct, result_pct"
        )
        .eq("ticker", ticker)
        .order("report_date", { ascending: false })
        .limit(10),
    ]);

  if (!symbol) notFound();
  const quote = quoteArr[0];
  const up = (quote?.changePct ?? 0) >= 0;

  return (
    <AppShell
      email={user.email ?? ""}
      isAdmin={Boolean(profile?.is_admin)}
      active="none"
      displayName={profile?.name}
      avatarUrl={profile?.avatar_url}
    >
      {/* Header */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs uppercase tracking-wider text-ink-3">
            {symbol.exchange ?? "US"} · {symbol.sector ?? "Equity"}
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold sm:text-3xl">
            ${symbol.ticker}{" "}
            <span className="text-lg font-medium text-ink-2">{symbol.name}</span>
          </h1>
        </div>
        {quote && (
          <div className="text-right">
            <p className="font-mono-nums text-2xl text-ink">{quote.price.toFixed(2)}</p>
            <p className={`font-mono-nums text-sm ${up ? "text-up" : "text-down"}`}>
              {up ? "▲" : "▼"} {Math.abs(quote.changePct).toFixed(2)}% today
              {!quote.live && (
                <span className="ml-2 text-[10px] uppercase tracking-wider text-ink-3">
                  sample
                </span>
              )}
            </p>
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="mt-6">
        <PriceChart ticker={ticker} />
      </div>

      {/* Setup history for this symbol */}
      <section className="mt-10">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-ink-2">
            Setup history — ${ticker}
          </h2>
          <Link
            href="/setups"
            className="text-xs font-semibold text-accent transition hover:text-accent-2"
          >
            All setups →
          </Link>
        </div>
        {(history ?? []).length === 0 ? (
          <p className="mt-3 rounded-2xl border border-line bg-panel px-5 py-8 text-center text-sm text-ink-3">
            The engine hasn&apos;t published a setup on ${ticker} yet.
          </p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-panel">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[10px] uppercase tracking-wider text-ink-3">
                  <th className="px-5 py-2.5 font-medium">Date</th>
                  <th className="px-3 py-2.5 font-medium">Direction</th>
                  <th className="hidden px-3 py-2.5 font-medium md:table-cell">Target</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-5 py-2.5 text-right font-medium">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {(history ?? []).map((s) => {
                  const pct = s.status === "open" ? s.current_pct : s.result_pct;
                  const pctUp = (pct ?? 0) >= 0;
                  return (
                    <tr key={`${s.report_date}`}>
                      <td className="whitespace-nowrap px-5 py-2.5 font-mono-nums text-xs text-ink-2">
                        {s.report_date}
                      </td>
                      <td
                        className={`px-3 py-2.5 font-mono-nums text-xs ${
                          s.direction === "long" ? "text-up" : "text-down"
                        }`}
                      >
                        {s.direction === "long" ? "▲ Long" : "▼ Short"}
                      </td>
                      <td className="hidden px-3 py-2.5 font-mono-nums text-xs text-ink-2 md:table-cell">
                        {s.price_target}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-ink-2">
                        {STATUS_LABEL[s.status] ?? s.status}
                      </td>
                      <td
                        className={`px-5 py-2.5 text-right font-mono-nums text-xs ${
                          pct == null ? "text-ink-3" : pctUp ? "text-up" : "text-down"
                        }`}
                      >
                        {pct == null
                          ? "—"
                          : `${pctUp ? "+" : ""}${pct.toFixed(2)}%${s.status === "open" ? " so far" : ""}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="mt-8 text-xs text-ink-3">
        Market commentary, not investment advice. History from end-of-day closes.
      </p>
    </AppShell>
  );
}
