import type { Metadata } from "next";
import { requireMember } from "@/lib/membership";
import { profileOf } from "@/lib/tradingProfile";
import { ONBOARDING_KEY, onboardingCopy } from "@/lib/onboardingCopy";
import StartQuestions from "./StartQuestions";

export const metadata: Metadata = { title: "Your first idea — HighStrike" };

/**
 * The three first questions (docs/plans/offer-overhaul.md item 3): account size, risk per trade, style, then today's
 * best idea sized for those answers (/start/idea). New members get them as a popup over the app (OnboardingGate); anyone
 * can come back here from Settings to change them.
 */
export default async function StartPage() {
  const { supabase, user } = await requireMember("/start");
  const [{ data }, { data: words }] = await Promise.all([
    supabase.from("profiles").select("account_size, risk_pct, trade_style, onboarded_at").eq("id", user.id).maybeSingle(),
    supabase.from("site_settings").select("value").eq("key", ONBOARDING_KEY).maybeSingle(),
  ]);
  return (
    <div className="anim-rise py-6 sm:py-10">
      <StartQuestions initial={profileOf(data)} firstTime={!data?.onboarded_at} copy={onboardingCopy(words?.value)} />
    </div>
  );
}
