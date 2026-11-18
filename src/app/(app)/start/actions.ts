"use server";

import { requireMember } from "@/lib/membership";
import { IDEA_COLUMNS, headlineOf, ideasSince, type Idea } from "@/lib/ideas";
import { optionLine } from "@/lib/optionIdea";
import { pickFor, usd, type TradingProfile } from "@/lib/tradingProfile";

// The three first questions' answers (src/lib/tradingProfile.ts), saved as the member through the profile's column
// grants (supabase/migrations/20261118000000_trading_profile.sql). The answer comes back with today's best idea for them
// as a card, which the questions show with confetti (Ben, 2026-11-18); the card opens /start/idea.

export type FirstIdeaCard = {
  id: string;
  ticker: string;
  direction: "long" | "short";
  headline: string;
  entry: number | null;
  target: number | null;
  stop: number | null;
  timeFrame: string;
  /** "2 contracts", "3 shares", or why it doesn't fit. */
  size: string;
  /** The contract, for an option size. */
  detail: string | null;
  risk: string | null;
};

export async function saveAnswers(input: { account: number; riskPct: number; style: string }): Promise<{ error: string } | { card: FirstIdeaCard | null }> {
  const { supabase, user } = await requireMember("/start");
  const account = Math.round(Number(input.account));
  const riskPct = Math.round(Number(input.riskPct) * 100) / 100;
  if (!(account >= 100 && account <= 100_000_000)) return { error: "Enter an account size of $100 or more." };
  if (!(riskPct > 0 && riskPct <= 10)) return { error: "Pick a risk between 0.1% and 10%." };
  if (input.style !== "day" && input.style !== "swing" && input.style !== "long") return { error: "Pick a style." };
  const { error } = await supabase
    .from("profiles")
    .update({ account_size: account, risk_pct: riskPct, trade_style: input.style, onboarded_at: new Date().toISOString() })
    .eq("id", user.id);
  if (error) return { error: "Your answers couldn't be saved. Try again." };

  const profile: TradingProfile = { account, riskPct, style: input.style };
  const { data } = await supabase.from("setups").select(`${IDEA_COLUMNS}, flow_score`).is("owner_id", null).eq("status", "open").gte("report_date", ideasSince(7)).limit(200);
  const { pick } = pickFor((data ?? []) as (Idea & { flow_score: number | null })[], profile);
  if (!pick) return { card: null };
  const { idea, sizing: s } = pick;
  const size =
    s.use === "option" ? `${s.contracts} contract${s.contracts === 1 ? "" : "s"}` : s.shares > 0 ? `${s.shares} share${s.shares === 1 ? "" : "s"}` : "Doesn't fit your risk today";
  return {
    card: {
      id: idea.id,
      ticker: idea.ticker,
      direction: idea.direction,
      headline: headlineOf(idea),
      entry: idea.entry_price,
      target: idea.target_price != null ? Number(idea.target_price) : null,
      stop: s.stop,
      timeFrame: idea.time_frame,
      size,
      detail: s.use === "option" && s.option ? optionLine(s.option) : null,
      risk: s.risk > 0 ? usd(s.risk) : null,
    },
  };
}
