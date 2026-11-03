import type { Metadata } from "next";
import { requireAccount } from "@/lib/membership";
import { supabaseService } from "@/lib/stripe";
import { deckFor, tasteFor } from "@/lib/options/deck";
import { myRecord } from "@/lib/options/stats";
import { moreCards, recordSwipe } from "./actions";
import SwipeDeck from "./SwipeDeck";

export const metadata: Metadata = { title: "Swipe — HighStrike" };

/** The swipe deck (step 2 of the swipe app, Ben 2026-11-02): options setups, one card at a time. */
export default async function SwipePage() {
  const { user } = await requireAccount("/swipe");
  const db = supabaseService();
  const [initial, rec, favorites] = await Promise.all([deckFor(db, user.id, 15), myRecord(db, user.id), tasteFor(db, user.id)]);
  return (
    <div className="pt-2">
      <SwipeDeck initial={initial} save={recordSwipe} more={moreCards} streak={rec.streak} swipedToday={rec.today} favorites={favorites} />
    </div>
  );
}
