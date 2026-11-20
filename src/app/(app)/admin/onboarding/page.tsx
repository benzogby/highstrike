import { requireAdmin } from "@/lib/adminGate";
import { supabaseServer } from "@/lib/supabase/server";
import { ONBOARDING_KEY } from "@/lib/onboardingCopy";
import OnboardingEditor from "./OnboardingEditor";

export const metadata = { title: "Onboarding — Admin — HighStrike" };

/** Admin → Onboarding: the words on the three first questions (src/lib/onboardingCopy.ts). The admin layout checks access. */
export default async function AdminOnboardingPage() {
  await requireAdmin();
  const supabase = await supabaseServer();
  const { data } = await supabase.from("site_settings").select("value").eq("key", ONBOARDING_KEY).maybeSingle();
  return <OnboardingEditor saved={data?.value ?? null} />;
}
