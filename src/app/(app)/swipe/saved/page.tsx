import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminPage } from "@/lib/membership";
import { Badge, CARD, PageHeader, Stat } from "@/components/ui";
import { STRUCTURES } from "@/lib/options/cards";
import type { DeckCard } from "@/lib/options/deck";
import { myRecord } from "@/lib/options/stats";
import { MiniChart } from "../SetupCard";
import ShareButton from "./ShareButton";

export const metadata: Metadata = { title: "Saved setups — HighStrike" };

const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const signed = (n: number) => `${n >= 0 ? "+" : "−"}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;
const DATE = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const REASON = { take_profit: "hit its take profit", stop: "hit its stop", expiry: "expired" } as const;

type Row = { id: number; created_at: string; share_token: string; card: DeckCard; status: "open" | "win" | "loss" | null; pnl: number | null; close_reason: keyof typeof REASON | null };

/**
 * The setups a member swiped right on, followed to their take profit, stop or expiry (step 3 of the swipe app): the
 * record on top, then each card as it was saved, with how it's doing (estimated, per contract).
 */
export default async function SavedPage() {
  const { supabase, user } = await requireAdminPage("/swipe/saved");
  const [{ data }, rec] = await Promise.all([
    supabase.from("swipes").select("id, created_at, share_token, card, status, pnl, close_reason").eq("user_id", user.id).eq("action", "right").order("created_at", { ascending: false }).limit(200),
    myRecord(supabase, user.id),
  ]);
  const rows = (data ?? []) as Row[];
  return (
    <div className="flex flex-col gap-6">
      <Link href="/swipe" className="text-[13px] text-ink-3 hover:text-ink">
        ← Swipe
      </Link>
      <PageHeader
        title="Saved setups"
        subtitle="Everything you swiped right on, followed to its take profit, stop or expiry. Results are estimates per contract."
        actions={
          <Link href="/swipe/board" className="text-[13px] font-medium text-ink-2 hover:text-ink">
            Scoreboard →
          </Link>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Streak" value={`${rec.streak} day${rec.streak === 1 ? "" : "s"}`} note={rec.streak ? "Swipe today to keep it" : "Swipe today to start one"} />
        <Stat label="Saved" value={rec.saved} note={`${rec.open} still open`} />
        <Stat label="Win rate" value={rec.winRate != null ? `${rec.winRate}%` : "—"} note={`${rec.wins} won, ${rec.losses} lost`} />
        <Stat label="Closed result" value={signed(rec.pnl)} note={`Open: ${signed(rec.openPnl)}`} />
      </div>
      {rows.length === 0 && <p className={`${CARD} px-5 py-10 text-center text-sm text-ink-3`}>Nothing saved yet. Swipe right on a setup to keep it here.</p>}
      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map(({ id, created_at, share_token, card: c, status, pnl, close_reason }) => (
          <li key={id} className={`${CARD} p-4`}>
            <div className="flex items-center gap-2">
              <span className="font-mono-nums text-[17px] font-semibold text-ink">{c.ticker}</span>
              <Badge tone={c.bias === "bull" ? "up" : c.bias === "bear" ? "down" : "neutral"}>{STRUCTURES[c.structure]?.label ?? c.structure}</Badge>
              <span className="ml-auto">
                {status === "win" ? <Badge tone="up">Won</Badge> : status === "loss" ? <Badge tone="down">Lost</Badge> : <Badge>Open</Badge>}
              </span>
            </div>
            <div className="mt-2 rounded-lg bg-bg/50 p-2">
              <MiniChart c={{ ...c, closes: c.closes ?? [] }} />
            </div>
            <p className="mt-2 flex items-baseline justify-between gap-2 text-[13px]">
              <span className="text-ink-2">{status === "open" || !status ? "So far" : `Closed: ${close_reason ? REASON[close_reason] : "done"}`}</span>
              <span className={`font-mono-nums text-[15px] ${pnl == null ? "text-ink-3" : pnl >= 0 ? "text-up" : "text-down"}`}>{pnl == null ? "Not checked yet" : signed(Number(pnl))}</span>
            </p>
            <p className="mt-1 font-mono-nums text-xs text-ink-3">
              {c.net < 0 ? "Credit" : "Cost"} {usd(Math.abs(Number(c.net)) * 100)} · max loss {usd(Number(c.max_loss))} · expires {DATE.format(new Date(`${c.expiry}T12:00:00Z`))}
            </p>
            <div className="mt-1 flex items-center justify-between">
              <p className="text-xs text-ink-3">Saved {DATE.format(new Date(created_at))} at {usd(Number(c.spot))}</p>
              <ShareButton token={share_token} title={`${c.ticker} ${STRUCTURES[c.structure]?.label ?? "setup"} on HighStrike`} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
