import type { Metadata } from "next";
import Link from "next/link";
import { requireMember } from "@/lib/membership";
import { fetchQuotes } from "@/lib/quotes";
import { CARD, PageHeader, Stat } from "@/components/ui";
import { TRADE_COLUMNS, markOf, money, nyToday, pnl, record, signedMoney, signedPct, sizeLabel, tradeName, type Trade } from "@/lib/trades";
import LogTrade from "./LogTrade";
import TradeRow, { type Row } from "./TradeRow";

export const metadata: Metadata = { title: "My trades — HighStrike" };

const DAY = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" });
const day = (iso: string) => DAY.format(new Date(`${iso}T12:00:00Z`));

/**
 * My trades (Ben, 2026-11-03: "Yes: track + journal"): every trade the member took, from an idea's "I took this" or
 * logged here, private to them (src/lib/trades.ts). Open trades show what they're worth now (live prices; an option at
 * its est. value) and their levels to watch; closed ones their result; each keeps its own notes. On top, the record:
 * open profit or loss, how many closed, the win rate and the money made.
 */
export default async function JournalPage() {
  const { supabase } = await requireMember("/journal");
  const { data } = await supabase.from("trades").select(TRADE_COLUMNS).order("opened_on", { ascending: false }).order("created_at", { ascending: false }).limit(500);
  const trades = (data ?? []) as Trade[];
  const open = trades.filter((t) => t.status === "open");
  const quotes = open.length ? await fetchQuotes([...new Set(open.map((t) => t.ticker))]).catch(() => []) : [];
  const spot = new Map(quotes.filter((q) => q.live).map((q) => [q.symbol, q.price]));
  const today = nyToday();

  const rows: Row[] = trades.map((t) => {
    const mark = t.status === "open" ? markOf(t, spot.get(t.ticker), today) : null;
    const at = t.status === "closed" && t.exit_price != null ? Number(t.exit_price) : mark?.price ?? null;
    const result = at != null ? pnl(t, at) : null;
    return {
      id: t.id,
      setupId: t.setup_id,
      name: tradeName(t),
      side: t.instrument === "option" ? null : t.direction,
      size: sizeLabel(t),
      open: t.status === "open",
      opened: day(t.opened_on),
      closed: t.closed_on ? day(t.closed_on) : null,
      entry: money(Number(t.entry_price)),
      now: at != null ? money(at) : null,
      est: Boolean(mark?.est),
      markPrice: mark ? mark.price : null,
      pnl: result ? signedMoney(result.dollars) : null,
      pct: result ? signedPct(result.pct) : null,
      up: result ? result.dollars >= 0 : null,
      levels: [t.target != null ? `Target ${money(Number(t.target))}` : null, t.stop != null ? `Stop ${money(Number(t.stop))}` : null].filter(Boolean).join(" · ") || null,
      hit: t.alerted,
      notes: t.notes ?? "",
    };
  });

  const stats = record(trades);
  const openPnl = open.reduce((s, t) => {
    const mark = markOf(t, spot.get(t.ticker), today);
    return mark ? s + pnl(t, mark.price).dollars : s;
  }, 0);
  const priced = open.filter((t) => markOf(t, spot.get(t.ticker), today)).length;
  const openRows = rows.filter((r) => r.open);
  const closedRows = rows.filter((r) => !r.open);

  return (
    <>
      <PageHeader title="My trades" subtitle="The trades you took, what they're worth now, and your notes. Only you can see them." actions={<LogTrade />} />

      <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Open trades" value={open.length.toLocaleString("en-US")} note={open.length ? "Marked at live prices" : "Take one from any idea"} />
        <Stat
          label="Open profit or loss"
          value={<span className={openPnl > 0 ? "text-up" : openPnl < 0 ? "text-down" : ""}>{priced ? signedMoney(openPnl) : "—"}</span>}
          note={priced < open.length ? `${open.length - priced} without a live price right now` : "Options at est. value"}
        />
        <Stat label="Win rate" value={stats.winRate != null ? `${stats.winRate}%` : "—"} note={`${stats.wins} of ${stats.closed} closed trades`} />
        <Stat
          label="Made on closed trades"
          value={<span className={stats.realized > 0 ? "text-up" : stats.realized < 0 ? "text-down" : ""}>{stats.closed ? signedMoney(stats.realized) : "—"}</span>}
          note="After you close them"
        />
      </div>

      <section className="mt-8">
        <h2 className="font-display text-[15px] text-ink">Open</h2>
        {openRows.length ? (
          <ul className={`${CARD} mt-3 divide-y divide-line`}>
            {openRows.map((r) => (
              <TradeRow key={r.id} row={r} />
            ))}
          </ul>
        ) : (
          <div className={`${CARD} mt-3 px-5 py-8 text-center`}>
            <p className="text-sm text-ink-2">No open trades yet.</p>
            <p className="mt-1 text-[13px] text-ink-3">
              Open any idea and press <b className="font-medium text-ink-2">I took this</b>, or log a trade of your own.
            </p>
            <Link href="/ideas" className="mt-4 inline-flex text-sm font-medium text-accent hover:underline">
              See today&apos;s ideas
            </Link>
          </div>
        )}
      </section>

      {closedRows.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-[15px] text-ink">Closed</h2>
          <ul className={`${CARD} mt-3 divide-y divide-line`}>
            {closedRows.map((r) => (
              <TradeRow key={r.id} row={r} />
            ))}
          </ul>
        </section>
      )}

      <p className="mt-8 text-xs leading-relaxed text-ink-3">
        For your own records. An option&apos;s value is estimated from the stock&apos;s live price and its own past moves, not a live option quote, so
        your broker&apos;s number is the real one.
      </p>
    </>
  );
}
