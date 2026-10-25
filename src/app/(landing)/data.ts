import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/lib/supabaseConfig";

// Everything the landing page shows, read with the publishable key. Setups and
// prices are members-only tables, so they come through the public RPCs in
// supabase/migrations/20261025160000_public_landing_data.sql, which expose only
// what this page draws. Every piece falls back to null/empty on failure.

export type Report = {
  date: string;
  dateLabel: string;
  volatility: number;
  opportunity: number;
  direction: number;
  summary: string;
};

export type TodaySetup = { ticker: string; direction: string; flowScore: number | null };

export type ClosedSetup = {
  ticker: string;
  direction: string;
  entry: number;
  target: number;
  timeFrame: string | null;
  criteria: string[];
  status: string;
  resultPct: number | null;
  reportDate: string;
};

export type SetupStats = {
  closedCount: number;
  openCount: number;
  winRate: number | null;
  avgGain: number | null;
  avgLoss: number | null;
};

export type PastTrade = { ticker: string; status: string; result: string; daysAgo: number };

export type LandingData = {
  report: Report | null;
  today: TodaySetup[];
  closed: ClosedSetup[];
  spy: number[];
  stats: SetupStats | null;
  badges: { traders: string; countries: string };
  scoreboard: { stats: { value: string; label: string }[]; trades: PastTrade[] };
  logo: string | null;
};

// Same defaults as Admin ▸ Site (src/lib/siteContent.ts), read here on the server.
const DEFAULT_BADGES = { traders: "10,000+", countries: "142" };
const DEFAULT_SCOREBOARD = {
  stats: [
    { value: "39%", label: "Average gain" },
    { value: "64%", label: "Win rate" },
    { value: "-19%", label: "Average loss" },
  ],
  trades: [
    { ticker: "DELL", status: "Target Hit", result: "+956%", daysAgo: 2 },
    { ticker: "SMCI", status: "Closed", result: "+121%", daysAgo: 5 },
  ],
};

function parseSetting<T>(raw: string | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function dateLabel(isoDate: string) {
  return new Date(`${isoDate}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export async function getLandingData(): Promise<LandingData> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  const [reportRes, todayRes, closedRes, spyRes, statsRes, settingsRes] = await Promise.all([
    supabase
      .from("weather_reports")
      .select("report_date, volatility, opportunity, direction, summary")
      .order("report_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.rpc("get_landing_setups_today"),
    supabase.rpc("get_recent_closed_setups", { limit_n: 6 }),
    supabase.rpc("get_landing_closes", { sym: "SPY", days: 60 }),
    supabase.rpc("get_setup_stats"),
    supabase
      .from("site_settings")
      .select("key, value")
      .in("key", ["hero_badges", "scoreboard", "logo_dark", "logo"]),
  ]);

  const r = reportRes.data;
  const settings = Object.fromEntries(
    (settingsRes.data ?? []).filter((s) => s.value).map((s) => [s.key, s.value as string])
  );
  const s = (statsRes.data as
    | { closed_count: number; open_count: number; win_rate: number | null; avg_gain: number | null; avg_loss: number | null }[]
    | null)?.[0];

  return {
    report: r
      ? {
          date: r.report_date,
          dateLabel: dateLabel(r.report_date),
          volatility: r.volatility,
          opportunity: r.opportunity,
          direction: r.direction,
          summary: r.summary,
        }
      : null,
    today: ((todayRes.data ?? []) as { ticker: string; direction: string; flow_score: number | null }[]).map((t) => ({
      ticker: t.ticker,
      direction: t.direction,
      flowScore: t.flow_score,
    })),
    closed: (
      (closedRes.data ?? []) as {
        ticker: string;
        direction: string;
        entry_price: number;
        target_price: number;
        time_frame: string | null;
        entry_criteria: string[] | null;
        status: string;
        result_pct: number | null;
        report_date: string;
      }[]
    ).map((c) => ({
      ticker: c.ticker,
      direction: c.direction,
      entry: Number(c.entry_price),
      target: Number(c.target_price),
      timeFrame: c.time_frame,
      criteria: c.entry_criteria ?? [],
      status: c.status,
      resultPct: c.result_pct == null ? null : Number(c.result_pct),
      reportDate: c.report_date,
    })),
    spy: ((spyRes.data ?? []) as { close: number }[]).map((p) => Number(p.close)),
    stats: s
      ? {
          closedCount: s.closed_count,
          openCount: s.open_count,
          winRate: s.win_rate == null ? null : Number(s.win_rate),
          avgGain: s.avg_gain == null ? null : Number(s.avg_gain),
          avgLoss: s.avg_loss == null ? null : Number(s.avg_loss),
        }
      : null,
    badges: parseSetting(settings.hero_badges, DEFAULT_BADGES),
    scoreboard: parseSetting(settings.scoreboard, DEFAULT_SCOREBOARD),
    logo: settings.logo_dark ?? settings.logo ?? null,
  };
}

export function formatDateShort(isoDate: string) {
  return dateLabel(isoDate);
}
