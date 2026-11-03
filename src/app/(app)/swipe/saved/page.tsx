import type { Metadata } from "next";
import Link from "next/link";
import { requireMember } from "@/lib/membership";
import { Badge, CARD, PageHeader } from "@/components/ui";
import { STRUCTURES } from "@/lib/options/cards";
import type { DeckCard } from "@/lib/options/deck";
import { MiniChart } from "../SetupCard";

export const metadata: Metadata = { title: "Saved setups — HighStrike" };

const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const DATE = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** The setups a member swiped right on: their ideas in the swipe app, newest first, as each card was when saved. */
export default async function SavedPage() {
  const { supabase, user } = await requireMember("/swipe/saved");
  const { data } = await supabase.from("swipes").select("id, created_at, card").eq("user_id", user.id).eq("action", "right").order("created_at", { ascending: false }).limit(200);
  const rows = (data ?? []) as { id: number; created_at: string; card: DeckCard }[];
  return (
    <div className="flex flex-col gap-6">
      <Link href="/swipe" className="text-[13px] text-ink-3 hover:text-ink">
        ← Swipe
      </Link>
      <PageHeader title="Saved setups" subtitle="Everything you swiped right on, as it was when you saved it." />
      {rows.length === 0 && <p className={`${CARD} px-5 py-10 text-center text-sm text-ink-3`}>Nothing saved yet. Swipe right on a setup to keep it here.</p>}
      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map(({ id, created_at, card: c }) => (
          <li key={id} className={`${CARD} p-4`}>
            <div className="flex items-center gap-2">
              <span className="font-mono-nums text-[17px] font-semibold text-ink">{c.ticker}</span>
              <Badge tone={c.bias === "bull" ? "up" : c.bias === "bear" ? "down" : "neutral"}>{STRUCTURES[c.structure]?.label ?? c.structure}</Badge>
              <span className="ml-auto text-xs text-ink-3">Expires {DATE.format(new Date(`${c.expiry}T12:00:00Z`))}</span>
            </div>
            <div className="mt-2 rounded-lg bg-bg/50 p-2">
              <MiniChart c={{ ...c, closes: c.closes ?? [] }} />
            </div>
            <p className="mt-2 font-mono-nums text-[13px] text-ink-2">
              {c.net < 0 ? "Credit" : "Cost"} {usd(Math.abs(Number(c.net)) * 100)} · max loss {usd(Number(c.max_loss))} · {Math.round(Number(c.pop) * 100)}% chance
            </p>
            <p className="mt-1 text-xs text-ink-3">Saved {DATE.format(new Date(created_at))} at {usd(Number(c.spot))}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
