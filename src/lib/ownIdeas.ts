import { supabaseService } from "@/lib/stripe";
import { etToday } from "@/lib/setupEngine";
import type { Source, Style } from "@/lib/ideas";

// A member's own ideas, pasted (piece 3) or built (piece 4): saved with their owner_id so only they see them, their own
// stop, and graded like every idea. One limit across both: ideas a member can save in a day.
export const OWN_PER_DAY = 20;

const money = (n: number) => `$${n.toFixed(2)}`;

export type OwnIdea = {
  ownerId: string;
  source: Extract<Source, "pasted" | "builder">;
  ticker: string;
  direction: "long" | "short";
  style: Style;
  timeFrame: string;
  entry: number;
  target: number;
  stop: number;
  contract?: string | null;
  /** The last day it runs (an option's expiry), else from the style. */
  expires?: string | null;
  headline: string;
  why: string;
  rules?: string[];
};

/** Saves the idea and returns its id, or an error in words. */
export async function saveOwnIdea(i: OwnIdea): Promise<{ id: string } | { error: string }> {
  const db = supabaseService();
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count } = await db.from("setups").select("id", { count: "exact", head: true }).eq("owner_id", i.ownerId).gte("created_at", since);
  if ((count ?? 0) >= OWN_PER_DAY) return { error: `That's ${OWN_PER_DAY} of your own ideas in a day. Save more tomorrow.` };
  const long = i.direction === "long";
  if (long ? i.target <= i.entry : i.target >= i.entry) return { error: `For a ${i.direction}, the target should be ${long ? "above" : "below"} the entry.` };
  if (long ? i.stop >= i.entry : i.stop <= i.entry) return { error: `For a ${i.direction}, the stop should be ${long ? "below" : "above"} the entry.` };

  const today = etToday();
  const add = (days: number) => new Date(Date.parse(`${today}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
  const expires = i.expires ?? (i.style === "day" ? today : i.style === "long" ? add(60) : add(14));
  const contract = i.contract?.trim().slice(0, 60) || null;
  const { data, error } = await db
    .from("setups")
    .insert({
      report_date: today,
      ticker: i.ticker,
      direction: i.direction,
      source: i.source,
      style: i.style,
      owner_id: i.ownerId,
      headline: i.headline.slice(0, 160),
      justification: i.why.slice(0, 2000),
      entry_criteria: i.rules ?? [`Entry around ${money(i.entry)}`, `Stop at ${money(i.stop)}`, ...(contract ? [`Contract: ${contract}`] : [])],
      price_target: money(i.target),
      time_frame: i.timeFrame.trim().slice(0, 40) || "1-2 weeks",
      flow_score: 50,
      model: i.source,
      entry_price: i.entry,
      target_price: i.target,
      stop_price: i.stop,
      contract,
      expires_on: expires,
    })
    .select("id")
    .single();
  if (error || !data) return { error: `The idea couldn't be saved: ${error?.message ?? "unknown error"}` };
  return { id: data.id as string };
}
