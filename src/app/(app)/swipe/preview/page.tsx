import { notFound } from "next/navigation";
import { cardsFor } from "@/lib/options/cards";
import type { DeckCard } from "@/lib/options/deck";
import SwipeDeck from "../SwipeDeck";

// Development only: the swipe deck with made-up cards, to check the screen before the engine's first refresh. Never
// served in production.
export default async function SwipePreview() {
  if (process.env.NODE_ENV === "production") notFound();
  const walk = (start: number, drift: number) => Array.from({ length: 30 }, (_, i) => +(start * (1 + drift * i + 0.02 * Math.sin(i / 2))).toFixed(2));
  const today = new Date();
  const cards: DeckCard[] = [
    { ticker: "NVDA", spot: 204.64, vol: 0.48, changePct: 3.1, rangePos: 0.85, mom5: 4.2, closes: walk(185, 0.0035) },
    { ticker: "SPY", spot: 690.5, vol: 0.16, changePct: 0.1, rangePos: 0.5, mom5: 0.3, closes: walk(684, 0.0003) },
    { ticker: "SOFI", spot: 16.76, vol: 0.6, changePct: -2.4, rangePos: 0.2, mom5: -6, closes: walk(18.4, -0.003) },
  ].flatMap((u) => cardsFor(u, 4, today).map((c, i) => ({ ...c, id: `${u.ticker}-${i}-0000-0000-000000000000`, max_profit: c.maxProfit, max_loss: c.maxLoss, reward_risk: c.rewardRisk, take_profit: c.takeProfit, stop_loss: c.stopLoss, tier: 1, closes: u.closes, crowd: i % 2 ? null : { right: 17 - i * 4, total: 25 } })));
  async function save() {
    "use server";
    return { ok: true as const };
  }
  async function more() {
    "use server";
    return [] as DeckCard[];
  }
  return (
    <div className="pt-2">
      <SwipeDeck initial={cards} save={save} more={more} favorites={["credit spreads", "trades risking under $500"]} />
    </div>
  );
}
