"use server";

import { viewer } from "@/lib/membership";
import { supabaseService } from "@/lib/stripe";
import { deckFor, type DeckCard } from "@/lib/options/deck";

/** Records a swipe: right saves the card to the member's ideas, left passes on it. The card is kept as it was. */
export async function recordSwipe(cardId: string, action: "right" | "left"): Promise<{ ok: true } | { error: string }> {
  const v = await viewer();
  if (!v?.member) return { error: "Sign in to save setups." };
  if (!/^[0-9a-f-]{36}$/i.test(cardId) || (action !== "right" && action !== "left")) return { error: "That card didn't come through." };
  const db = supabaseService();
  const { data: card } = await db.from("swipe_cards").select("*").eq("id", cardId).maybeSingle();
  if (!card) return { error: "That card has been refreshed. Swipe the next one." };
  const { error } = await db.from("swipes").upsert(
    { user_id: v.user.id, card_id: cardId, ticker: card.ticker, structure: card.structure, action, card },
    { onConflict: "user_id,card_id" }
  );
  return error ? { error: error.message } : { ok: true };
}

/** More cards when the member's deck runs low, skipping the ones already on their screen. */
export async function moreCards(skip: string[]): Promise<DeckCard[]> {
  const v = await viewer();
  if (!v?.member) return [];
  return deckFor(supabaseService(), v.user.id, 15, skip.filter((s) => /^[0-9a-f-]{36}$/i.test(s)).slice(0, 200));
}
