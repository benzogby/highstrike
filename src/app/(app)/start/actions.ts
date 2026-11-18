"use server";

import { redirect } from "next/navigation";
import { requireMember } from "@/lib/membership";

// The three first questions' answers (src/lib/tradingProfile.ts), saved as the member through the profile's column
// grants (supabase/migrations/20261118000000_trading_profile.sql). Skip marks the questions seen without answers.

export async function saveAnswers(input: { account: number; riskPct: number; style: string }): Promise<{ error: string } | never> {
  const { supabase, user } = await requireMember("/start");
  const account = Math.round(Number(input.account));
  const riskPct = Math.round(Number(input.riskPct) * 100) / 100;
  if (!(account >= 100 && account <= 100_000_000)) return { error: "Enter an account size of $100 or more." };
  if (!(riskPct > 0 && riskPct <= 10)) return { error: "Pick a risk between 0.1% and 10%." };
  if (!["day", "swing", "long"].includes(input.style)) return { error: "Pick a style." };
  const { error } = await supabase
    .from("profiles")
    .update({ account_size: account, risk_pct: riskPct, trade_style: input.style, onboarded_at: new Date().toISOString() })
    .eq("id", user.id);
  if (error) return { error: "Your answers couldn't be saved. Try again." };
  redirect("/start/idea");
}

export async function skipQuestions() {
  const { supabase, user } = await requireMember("/start");
  await supabase.from("profiles").update({ onboarded_at: new Date().toISOString() }).eq("id", user.id);
  redirect("/dashboard");
}
