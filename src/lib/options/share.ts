import { supabaseService } from "@/lib/stripe";
import type { DeckCard } from "./deck";

// A shared setup (step 5 of the swipe app; Ben 2026-11-02: "Shareable cards"): a saved card found by its share code,
// for its public page and image. Only saved (right-swiped) cards can be shared, and nothing about who saved it is shown.
export type Shared = { card: DeckCard; status: "open" | "win" | "loss" | null; pnl: number | null; savedAt: string };

export async function sharedCard(token: string): Promise<Shared | null> {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return null;
  const { data } = await supabaseService().from("swipes").select("card, status, pnl, created_at").eq("share_token", token).eq("action", "right").maybeSingle();
  if (!data) return null;
  return { card: data.card as DeckCard, status: data.status as Shared["status"], pnl: data.pnl == null ? null : Number(data.pnl), savedAt: String(data.created_at) };
}
