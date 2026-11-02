import type { Metadata } from "next";
import AppShell from "@/components/AppShell";
import LibraryView from "@/components/education/LibraryView";
import Paywall from "@/components/education/Paywall";
import { educationContext, lessonStates, librarySummary, myProgress, outline, publishedVideos } from "@/lib/education";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Education — HighStrike" };

/**
 * /education: the Highstrike Alpha Mastermind library (Ben, 2026-11-02: "do all the lessons from HighStrike Alpha
 * Mastermind module, split into the sub modules"), laid out like getripping.com's Ripping University. Any paid plan or
 * an admin; anyone else sees what the library is and where to get it. This page only loads; LibraryView draws.
 */
export default async function EducationPage() {
  const { supabase, user, profile, allowed } = await educationContext("/education");
  const shell = (children: React.ReactNode) => (
    <AppShell email={user.email ?? ""} isAdmin={Boolean(profile?.is_admin)} active="education" displayName={profile?.name} avatarUrl={profile?.avatar_url}>
      {children}
    </AppShell>
  );
  if (!allowed) return shell(<Paywall summary={await librarySummary(supabase)} />);
  const [{ modules, lessons }, videos, progress] = await Promise.all([outline(supabase), publishedVideos(supabase), myProgress(supabase, user.id)]);
  return shell(<LibraryView modules={modules} lessons={lessons} states={lessonStates(lessons, videos, progress)} />);
}
