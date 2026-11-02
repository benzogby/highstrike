import { supabaseServer } from "@/lib/supabase/server";
import { outline, publishedVideos } from "@/lib/education";
import EducationManager, { type AdminLesson } from "./EducationManager";

export const metadata = {
  title: "Trading School — Admin — HighStrike",
};

export const dynamic = "force-dynamic";

/** Admin → Trading School: every module and lesson of HighStrike Trading School, to edit (the admin layout has already checked is_admin). */
export default async function AdminEducationPage() {
  const supabase = await supabaseServer();
  const [{ modules, lessons }, videos] = await Promise.all([outline(supabase), publishedVideos(supabase)]);
  const rows: AdminLesson[] = lessons.map((l) => {
    const video = videos.get(l.id);
    return {
      id: l.id,
      moduleId: l.moduleId,
      title: l.title,
      kind: video ? "video" : l.youtubeId ? "youtube" : l.durationSec ? "processing" : "text",
      durationSec: video?.durationSec || l.durationSec || null,
    };
  });
  return <EducationManager modules={modules} lessons={rows} />;
}
