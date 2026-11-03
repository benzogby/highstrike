import type { Metadata } from "next";
import Link from "next/link";
import { requireMember } from "@/lib/membership";
import { supabaseService } from "@/lib/stripe";
import { CARD, PageHeader } from "@/components/ui";
import { scoreboard } from "@/lib/options/stats";

export const metadata: Metadata = { title: "Scoreboard — HighStrike" };

const signed = (n: number) => `${n >= 0 ? "+" : "−"}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;

/**
 * The scoreboard (step 3 of the swipe app; Ben 2026-11-02: "Streaks + scoreboard"): everyone whose saved setups have
 * closed, ranked by their total estimated result per contract, with win rate and streak. Names are the profile name,
 * else "Trader" and four characters of the account, never an email.
 */
export default async function BoardPage() {
  const { user } = await requireMember("/swipe/board");
  const rows = await scoreboard(supabaseService());
  const mine = rows.findIndex((r) => r.id === user.id);
  return (
    <div className="flex flex-col gap-6">
      <Link href="/swipe" className="text-[13px] text-ink-3 hover:text-ink">
        ← Swipe
      </Link>
      <PageHeader
        title="Scoreboard"
        subtitle="Ranked by the total result of each trader's saved setups once they close, one contract each, on estimated prices."
        actions={
          mine >= 0 ? <span className="text-[13px] text-ink-2">You&apos;re #{mine + 1} of {rows.length}</span> : <span className="text-[13px] text-ink-3">You&apos;ll appear once a saved setup closes</span>
        }
      />
      <section className={`${CARD} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs font-medium text-ink-3">
              <th className="px-4 py-2 font-medium">#</th>
              <th className="px-2 py-2 font-medium">Trader</th>
              <th className="px-2 py-2 text-right font-medium">Result</th>
              <th className="px-2 py-2 text-right font-medium">Win rate</th>
              <th className="px-2 py-2 text-right font-medium">Closed</th>
              <th className="px-4 py-2 text-right font-medium">Streak</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.slice(0, 100).map((r, i) => (
              <tr key={r.id} className={r.id === user.id ? "bg-accent-soft/40" : "hover:bg-panel-2"}>
                <td className="px-4 py-2 font-mono-nums text-ink-3">{i + 1}</td>
                <td className="px-2 py-2 text-ink">
                  {r.name}
                  {r.id === user.id && <span className="ml-2 text-xs text-accent-ink">You</span>}
                </td>
                <td className={`px-2 py-2 text-right font-mono-nums ${r.pnl >= 0 ? "text-up" : "text-down"}`}>{signed(r.pnl)}</td>
                <td className="px-2 py-2 text-right font-mono-nums text-ink-2">{r.winRate != null ? `${r.winRate}%` : "—"}</td>
                <td className="px-2 py-2 text-right font-mono-nums text-ink-2">{r.wins + r.losses}</td>
                <td className="px-4 py-2 text-right font-mono-nums text-ink-2">{r.streak ? `🔥 ${r.streak}` : "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-ink-3">
                  No saved setups have closed yet. The first results land as setups reach their take profit, stop or expiry.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
      <p className="text-xs leading-relaxed text-ink-3">Results use the same estimated option prices as the cards, not real fills. For fun and learning, not investment advice.</p>
    </div>
  );
}
