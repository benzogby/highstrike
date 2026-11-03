import type { Metadata } from "next";
import { requireMember } from "@/lib/membership";
import { supabaseService } from "@/lib/stripe";
import { deckFor } from "@/lib/options/deck";
import { moreCards, recordSwipe } from "./actions";
import SwipeDeck from "./SwipeDeck";

export const metadata: Metadata = { title: "Swipe — HighStrike" };

/** The swipe deck (step 2 of the swipe app, Ben 2026-11-02): options setups, one card at a time. */
export default async function SwipePage() {
  const { user } = await requireMember("/swipe");
  const initial = await deckFor(supabaseService(), user.id, 15);
  return (
    <div className="pt-2">
      <SwipeDeck initial={initial} save={recordSwipe} more={moreCards} />
    </div>
  );
}
