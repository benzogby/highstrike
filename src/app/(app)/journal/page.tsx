import type { Metadata } from "next";
import Link from "next/link";
import { requireMember } from "@/lib/membership";
import { paperState } from "@/lib/paper";
import { fetchQuotes } from "@/lib/quotes";
import { CARD, PageHeader, Stat } from "@/components/ui";
import { TRADE_COLUMNS, markOf, money, nyToday, pnl, record, signedMoney, signedPct, sizeLabel, tradeName, type Trade } from "@/lib/trades";
import LogTrade from "./LogTrade";
import TradeRow, { type Row } from "./TradeRow";

export const metadata: Metadata = { title: "Positions — HighStrike" };

const WHEN = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const usd = (n: number) => `$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const signed = (n: number | null) => (n == null ? "—" : `${n > 0 ? "+" : n < 0 ? "−" : ""}${usd(n)}`);
const tone = (n: number | null) => (n == null || n === 0 ? "text-ink-2" : n > 0 ? "text-up" : "text-down");

const DAY = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" });
const day = (iso: string) => DAY.format(new Date(`${iso}T12:00:00Z`));

/**
 * My trades (Ben, 2026-11-03: "Yes: track + journal"): every trade the member took, from an idea's "I took this" or
 * logged here, private to them (src/lib/trades.ts). Open trades show what they're worth now (live prices; an option at
 * its est. value) and their levels to watch; closed ones their result; each keeps its own notes. On top, the record:
 * open profit or loss, how many closed, the win rate and the money made.
 */
export default async function JournalPage() {
  const { supabase, user } = await requireMember("/journal");
  // The paper account's positions (Ben, 2026-11-18: "Rename My Trades to Positions, and show all positions, sorted by
  // dateTime entered"), newest first.
  const paper = await paperState(user.id).catch(() => null);
  const positions = [...(paper?.positions ?? [])].sort((a, b) => (a.openedAt < b.openedAt ? 1 : a.openedAt > b.openedAt ? -1 : 0));
  const totalOpen = positions.reduce((s, p) => s + (p.pnl ?? 0), 0);
  const totalDay = positions.reduce((s, p) => s + (p.dayPnl ?? 0), 0);
  const totalCost = positions.reduce((s, p) => s + p.cost, 0);
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
      <PageHeader title="Positions" subtitle="Everything you hold in your paper account, newest first, then the trades you've logged. Only you can see them." />

      <section className="mt-8">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-[15px] text-ink">Paper account</h2>
          <Link href="/dashboard?panel=positions" className="text-[13px] font-medium text-accent hover:underline">
            Trade on the desk
          </Link>
        </div>
        {positions.length ? (
          <div className={`${CARD} mt-3 overflow-x-auto`}>
            <table className="w-full min-w-[820px] text-[13px]">
              <thead className="border-b border-line text-[11px] text-ink-3">
                <tr>
                  {["Entered", "Type", "Underlying", "Contract", "Qty", "Position size", "P/L open", "P/L day"].map((h, i) => (
                    <th key={h} className={`px-4 py-2.5 font-medium ${i >= 4 ? "text-right" : "text-left"}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {positions.map((p) => {
                  const type = p.kind === "stock" ? (p.qty < 0 ? "Short stock" : "Stock") : p.optionType === "put" ? "Put" : "Call";
                  const contract =
                    p.kind === "option" && p.expiry && p.strike != null
                      ? `${day(p.expiry)} $${Number.isInteger(p.strike) ? p.strike : p.strike.toFixed(2)} ${p.optionType ?? ""}`
                      : null;
                  return (
                    <tr key={p.symbol} className="hover:bg-panel-2/50">
                      <td className="whitespace-nowrap px-4 py-2.5 text-ink-2">{WHEN.format(new Date(p.openedAt))}</td>
                      <td className="px-4 py-2.5 text-ink">{type}</td>
                      <td className="px-4 py-2.5">
                        <Link href={`/dashboard?t=${p.underlying}${p.kind === "option" ? "&trade=options" : ""}`} className="font-mono-nums font-medium text-ink hover:text-accent">
                          {p.underlying}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-ink-2">{contract ?? <span className="text-ink-3">—</span>}</td>
                      <td className="px-4 py-2.5 text-right font-mono-nums text-ink">
                        {p.qty > 0 ? "+" : "−"}
                        {Math.abs(p.qty).toLocaleString("en-US")}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono-nums text-ink">{usd(p.cost)}</td>
                      <td className={`px-4 py-2.5 text-right font-mono-nums ${tone(p.pnl)}`}>
                        {signed(p.pnl)}
                        {p.pnlPct != null && <span className="ml-1.5 text-[11px] opacity-80">{p.pnlPct > 0 ? "+" : ""}{p.pnlPct}%</span>}
                      </td>
                      <td className={`px-4 py-2.5 text-right font-mono-nums ${tone(p.dayPnl)}`}>{signed(p.dayPnl)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t border-line-strong text-ink">
                <tr>
                  <td colSpan={5} className="px-4 py-2.5 text-[12px] font-medium text-ink-2">
                    {positions.length} {positions.length === 1 ? "position" : "positions"}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono-nums">{usd(totalCost)}</td>
                  <td className={`px-4 py-2.5 text-right font-mono-nums ${tone(totalOpen)}`}>{signed(totalOpen)}</td>
                  <td className={`px-4 py-2.5 text-right font-mono-nums ${tone(totalDay)}`}>{signed(totalDay)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className={`${CARD} mt-3 px-5 py-8 text-center`}>
            <p className="text-sm text-ink-2">No positions in your paper account.</p>
            <Link href="/dashboard" className="mt-3 inline-flex text-sm font-medium text-accent hover:underline">
              Open the desk
            </Link>
          </div>
        )}
        <p className="mt-2 text-[11px] text-ink-3">Position size is what it cost to open. Options are priced at their live mid where there is one, else estimated.</p>
      </section>

      <div className="mt-12 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-[17px] text-ink">Trades you logged</h2>
          <p className="mt-0.5 text-[13px] text-ink-3">From an idea&apos;s &ldquo;I took this&rdquo; or added here, with your notes.</p>
        </div>
        <LogTrade />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
