import type { Metadata } from "next";
import { requireMember } from "@/lib/membership";
import { profileOf } from "@/lib/tradingProfile";
import StartQuestions from "./StartQuestions";

export const metadata: Metadata = { title: "Your first idea — HighStrike" };

/**
 * The three first questions (docs/plans/offer-overhaul.md item 3): account size, risk per trade, style, then today's
 * best idea sized for those answers (/start/idea). New members land here from the dashboard; anyone can come back from
 * Settings to change them.
 */
export default async function StartPage() {
  const { supabase, user } = await requireMember("/start");
  const { data } = await supabase.from("profiles").select("account_size, risk_pct, trade_style, onboarded_at").eq("id", user.id).maybeSingle();
  const saved = profileOf(data);
  return <StartQuestions initial={saved} firstTime={!data?.onboarded_at} />;
}
