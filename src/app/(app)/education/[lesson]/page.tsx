import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AppShell from "@/components/AppShell";
import LessonView from "@/components/education/LessonView";
import Paywall from "@/components/education/Paywall";
import { supabaseServer } from "@/lib/supabase/server";
import { educationContext, isLessonId, lessonDetail, lessonHref, lessonStates, librarySummary, myProgress, outline, posterUrl, publishedVideos } from "@/lib/education";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ lesson: string }> };

/** The lesson's title in the browser tab, for members who can read it. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lesson } = await params;
  if (!isLessonId(lesson)) return { title: "Education — HighStrike" };
  const supabase = await supabaseServer();
  const { data } = await supabase.from("course_lessons").select("title").eq("id", lesson).maybeSingle();
  return { title: data?.title ? `${data.title} — HighStrike` : "Education — HighStrike" };
}

/**
 * One lesson with its module's panel beside it (LessonView). An id that isn't a lesson is a 404; an account without
 * Education sees the paywall. This page only loads; LessonView draws.
 */
export default async function LessonPage({ params }: Props) {
  const { lesson: id } = await params;
  if (!isLessonId(id)) notFound();
  const { supabase, user, profile, allowed } = await educationContext(lessonHref(id));
  const shell = (children: React.ReactNode) => (
    <AppShell email={user.email ?? ""} isAdmin={Boolean(profile?.is_admin)} active="education" displayName={profile?.name} avatarUrl={profile?.avatar_url}>
      {children}
    </AppShell>
  );
  if (!allowed) return shell(<Paywall summary={await librarySummary(supabase)} />);

  const [{ modules, lessons }, videos, progress, detail] = await Promise.all([outline(supabase), publishedVideos(supabase), myProgress(supabase, user.id), lessonDetail(supabase, id)]);
  const index = lessons.findIndex((l) => l.id === id);
  if (index < 0) notFound();
  const lesson = lessons[index];
  const mod = modules.find((m) => m.id === lesson.moduleId);
  if (!mod) notFound();
  const video = videos.get(id) ?? null;
  const poster = video ? await posterUrl(supabase, video).catch(() => null) : null;
  return shell(
    <LessonView
      lesson={lesson}
      module={mod}
      moduleLessons={lessons.filter((l) => l.moduleId === mod.id)}
      states={lessonStates(lessons, videos, progress)}
      prev={lessons[index - 1] ?? null}
      next={lessons[index + 1] ?? null}
      video={video ? { durationSec: video.durationSec, poster } : null}
      body={detail.body}
      files={detail.files}
    />
  );
}
