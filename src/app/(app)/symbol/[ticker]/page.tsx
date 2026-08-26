import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import { fetchQuotes } from "@/lib/quotes";
import PriceChart from "./PriceChart";
import AlertPanel from "./AlertPanel";

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

  const { data: insiders } = await supabase
    .from("insider_trades")
    .select("accession, filed_at, owner_name, owner_title, transaction_code, shares, value")
    .eq("ticker", ticker)
    .order("filed_at", { ascending: false })
    .limit(8);

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

      <AlertPanel
        ticker={ticker}
        userId={user.id}
        currentPrice={quote?.price ?? null}
      />

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
          <div className="mt-3 overflow-x-auto rounded-2xl border border-line bg-panel">
            <table className="w-full min-w-[480px] text-sm">
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

      {/* Insider activity */}
      <section className="mt-10">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-ink-2">
            Insider activity — ${ticker}
          </h2>
          <Link
            href="/insiders"
            className="text-xs font-semibold text-accent transition hover:text-accent-2"
          >
            Full insider feed →
          </Link>
        </div>
        {(insiders ?? []).length === 0 ? (
          <p className="mt-3 rounded-2xl border border-line bg-panel px-5 py-6 text-center text-sm text-ink-3">
            No recent Form 4 open-market trades on file for ${ticker}.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-panel">
            {(insiders ?? []).map((t) => (
              <li
                key={`${t.accession}-${t.transaction_code}`}
                className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm"
              >
                <span className="min-w-0">
                  <span
                    className={`mr-2 rounded-full px-2 py-0.5 font-display text-[10px] font-bold ${
                      t.transaction_code === "P" ? "bg-accent text-bg" : "bg-down/90 text-bg"
                    }`}
                  >
                    {t.transaction_code === "P" ? "BUY" : "SELL"}
                  </span>
                  <span className="text-ink">{t.owner_name}</span>
                  {t.owner_title && (
                    <span className="ml-1.5 text-xs text-ink-3">· {t.owner_title}</span>
                  )}
                </span>
                <span className="font-mono-nums text-xs text-ink-2">
                  {t.shares != null ? Number(t.shares).toLocaleString() : "—"} sh
                  {t.value != null && ` · $${Math.round(Number(t.value)).toLocaleString()}`}
                  {" · "}
                  {t.filed_at}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-8 text-xs text-ink-3">
        Market commentary, not investment advice. History from end-of-day closes;
        insider data from SEC EDGAR Form 4 filings.
      </p>
    </AppShell>
  );
}
