import type { Metadata } from "next";
import AppShell from "@/components/AppShell";
import LibraryView from "@/components/education/LibraryView";
import { lessonStates, myProgress, outline, publishedVideos } from "@/lib/education";
import { requireMember } from "@/lib/membership";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Education — HighStrike" };

/**
 * /education: the Highstrike Alpha Mastermind library (Ben, 2026-11-02: "do all the lessons from HighStrike Alpha
 * Mastermind module, split into the sub modules"), laid out like getripping.com's Ripping University. Part of the $397
 * membership (src/lib/membership.ts); anyone else is sent to the paywall. This page only loads; LibraryView draws.
 */
export default async function EducationPage() {
  const { supabase, user, profile } = await requireMember("/education");
  const [{ modules, lessons }, videos, progress] = await Promise.all([outline(supabase), publishedVideos(supabase), myProgress(supabase, user.id)]);
  return (
    <AppShell email={user.email ?? ""} isAdmin={Boolean(profile?.is_admin)} active="education" displayName={profile?.name} avatarUrl={profile?.avatar_url}>
      <LibraryView modules={modules} lessons={lessons} states={lessonStates(lessons, videos, progress)} />
    </AppShell>
  );
}
