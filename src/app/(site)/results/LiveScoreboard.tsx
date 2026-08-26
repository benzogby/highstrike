import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/lib/supabaseConfig";

// Server component: public aggregate stats from the graded setup history.
// Renders honestly at small sample sizes.
export default async function LiveScoreboard() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  const { data } = await supabase.rpc("get_setup_stats");
  const stats = (data as
    | {
        closed_count: number;
        open_count: number;
        win_rate: number | null;
        avg_gain: number | null;
        avg_loss: number | null;
      }[]
    | null)?.[0];

  const tiles = [
    {
      value: stats?.win_rate != null ? `${stats.win_rate}%` : "—",
      label: "Win rate",
      note: "Closed setups that hit their published target.",
    },
    {
      value: stats?.avg_gain != null ? `+${stats.avg_gain}%` : "—",
      label: "Average gain",
      note: "Mean move on winning setups, entry to close.",
    },
    {
      value: stats?.avg_loss != null ? `${stats.avg_loss}%` : "—",
      label: "Average loss",
      note: "Mean move on losing setups — published, not hidden.",
    },
    {
      value: stats ? `${stats.open_count} open / ${stats.closed_count} closed` : "—",
      label: "Sample",
      note: "Every setup since tracking began counts. No cherry-picking.",
    },
  ];

  return (
    <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
      {tiles.map((t) => (
        <div key={t.label} className="bg-panel px-6 py-7">
          <p className="font-display text-3xl font-bold text-accent">{t.value}</p>
          <p className="mt-1 text-xs uppercase tracking-wider text-ink-3">{t.label}</p>
          <p className="mt-2 text-xs leading-relaxed text-ink-2">{t.note}</p>
        </div>
      ))}
    </div>
  );
}
