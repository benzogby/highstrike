import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/lib/supabaseConfig";
import { newYorkDate, sessionBefore } from "@/lib/marketCalendar";

// Everything the landing page shows, read with the publishable key. Setups and
// prices are members-only tables, so they come through the public RPCs in
// supabase/migrations/20261025160000_public_landing_data.sql and
// 20261026150000_landing_lookup.sql, which expose only what this page draws.
// Every piece falls back to null/empty on failure.

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

export type Close = { date: string; close: number };

export type Week = { week: string; closed: number; hits: number };

export type Mover = { ticker: string; close: number; changePct: number };

// What get_landing_ticker returns for the lookup (null for an unknown ticker).
export type TickerRead = {
  ticker: string;
  closes: Close[] | null;
  today: { direction: string; flow: number | null } | null;
  graded: { date: string; direction: string; status: string; result: number | null } | null;
  insiders: { sells: number; buys: number; sold: number; bought: number } | null;
  chatter: { day: string; perHour: number; bullish: number; bearish: number; watchers: number } | null;
};

// The setup the hero and "How a setup happens" draw: the newest one that hit
// its target and has enough sessions on file to show where it came from.
export type HeroSetup = { setup: ClosedSetup; closes: Close[] };

export type LandingData = {
  report: Report | null;
  today: TodaySetup[];
  closed: ClosedSetup[];
  spy: Close[];
  qqq: Close[];
  stats: SetupStats | null;
  weeks: Week[];
  movers: Mover[];
  hero: HeroSetup | null;
  reads: Record<string, TickerRead>;
  lookup: TickerRead | null;
  badges: { traders: string; countries: string };
  proof: Proof;
  /** The newest report is this morning's (false before the morning run, on weekends and holidays). */
  slateToday: boolean;
  /** HighStrike Trading School, as the membership includes it: each module's title and lesson count (get_landing_education). */
  course: CourseModule[];
};

export type CourseModule = { position: number; title: string; lessons: number };

// The ticker the lookup opens on.
export const LOOKUP_START = "NVDA";

// Same defaults as Admin ▸ Site (src/lib/siteContent.ts), read here on the server.
const DEFAULT_BADGES = { traders: "10,000+", countries: "142" };
/** The star rating and the member photos beside it (Admin → Site → Proof; Ben, 2026-11-02, from HighStrike's own reviews). */
export type Proof = { rating: string; avatars: string[] };
const DEFAULT_PROOF: Proof = { rating: "4.9", avatars: [] };

// Sessions of history the hero needs before a setup's morning to draw it.
const HERO_HISTORY = 10;

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

export function landingClient() {
  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
}

// price_history rows are morning snapshots: the row dated D holds the close of
// the session before D (src/lib/marketCalendar.ts). Label each close with its
// own session, and keep one close per session (the day after a holiday repeats
// the last one).
function bySession(rows: Close[]) {
  const out: Close[] = [];
  for (const r of rows) {
    const date = sessionBefore(r.date);
    if (out.length && out[out.length - 1].date === date) out[out.length - 1] = { date, close: r.close };
    else out.push({ date, close: r.close });
  }
  return out;
}

async function closesFor(sym: string, days: number): Promise<Close[]> {
  try {
    const { data, error } = await landingClient().rpc("get_landing_closes", { sym, days });
    if (error || !data) return [];
    return bySession(
      ((data ?? []) as { price_date: string; close: number }[])
        .map((p) => ({ date: p.price_date, close: Number(p.close) }))
        .sort((a, b) => (a.date < b.date ? -1 : 1))
    );
  } catch {
    return [];
  }
}

export async function getTickerRead(sym: string): Promise<TickerRead | null> {
  try {
    const { data, error } = await landingClient().rpc("get_landing_ticker", { sym });
    if (error || !data) return null;
    const read = data as TickerRead;
    return { ...read, closes: read.closes ? bySession(read.closes.map((c) => ({ date: c.date, close: Number(c.close) }))) : null };
  } catch {
    return null;
  }
}

async function heroSetup(closed: ClosedSetup[]): Promise<HeroSetup | null> {
  const hits = closed
    .filter((c) => c.status === "target_hit")
    .sort((a, b) => (a.reportDate < b.reportDate ? 1 : a.reportDate > b.reportDate ? -1 : 0));
  for (const setup of hits) {
    const closes = await closesFor(setup.ticker, 90);
    if (closes.filter((p) => p.date < setup.reportDate).length >= HERO_HISTORY) return { setup, closes };
  }
  return null;
}

export async function getLandingData(): Promise<LandingData> {
  const supabase = landingClient();
  const [reportRes, todayRes, closedRes, spyRes, qqq, statsRes, weeksRes, moversRes, settingsRes, courseRes] = await Promise.all([
    supabase
      .from("weather_reports")
      .select("report_date, volatility, opportunity, direction, summary")
      .order("report_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.rpc("get_landing_setups_today"),
    supabase.rpc("get_recent_closed_setups", { limit_n: 20 }),
    supabase.rpc("get_landing_closes", { sym: "SPY", days: 90 }),
    closesFor("QQQ", 90),
    supabase.rpc("get_setup_stats"),
    supabase.rpc("get_landing_weekly_record"),
    supabase.rpc("get_landing_movers"),
    supabase.from("site_settings").select("key, value").in("key", ["hero_badges", "proof"]),
    supabase.rpc("get_landing_education"),
  ]);

  const r = reportRes.data;
  const settings = Object.fromEntries(
    (settingsRes.data ?? []).filter((s) => s.value).map((s) => [s.key, s.value as string])
  );
  const s = (statsRes.data as
    | { closed_count: number; open_count: number; win_rate: number | null; avg_gain: number | null; avg_loss: number | null }[]
    | null)?.[0];

  const today = ((todayRes.data ?? []) as { ticker: string; direction: string; flow_score: number | null }[]).map((t) => ({
    ticker: t.ticker,
    direction: t.direction,
    flowScore: t.flow_score,
  }));
  const closed = (
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
  }));

  // The desk reads every name on today's slate and in the recent record, plus
  // the lookup's first ticker: insiders, the crowd and each last close.
  const names = [...new Set([...today.map((t) => t.ticker), ...closed.map((c) => c.ticker), LOOKUP_START])];
  const [hero, readList] = await Promise.all([heroSetup(closed), Promise.all(names.map((n) => getTickerRead(n)))]);
  const reads: Record<string, TickerRead> = {};
  names.forEach((n, i) => {
    const read = readList[i];
    if (read) reads[n] = read;
  });

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
    today,
    closed,
    spy: bySession(
      ((spyRes.data ?? []) as { price_date: string; close: number }[])
        .map((p) => ({ date: p.price_date, close: Number(p.close) }))
        .sort((a, b) => (a.date < b.date ? -1 : 1))
    ),
    qqq,
    stats: s
      ? {
          closedCount: s.closed_count,
          openCount: s.open_count,
          winRate: s.win_rate == null ? null : Number(s.win_rate),
          avgGain: s.avg_gain == null ? null : Number(s.avg_gain),
          avgLoss: s.avg_loss == null ? null : Number(s.avg_loss),
        }
      : null,
    weeks: ((weeksRes.data ?? []) as { week: string; closed: number; hits: number }[]).map((w) => ({
      week: w.week,
      closed: Number(w.closed),
      hits: Number(w.hits),
    })),
    movers: ((moversRes.data ?? []) as { ticker: string; close: number; change_pct: number }[]).map((m) => ({
      ticker: m.ticker,
      close: Number(m.close),
      changePct: Number(m.change_pct),
    })),
    hero,
    reads,
    lookup: reads[LOOKUP_START] ?? null,
    badges: parseSetting(settings.hero_badges, DEFAULT_BADGES),
    proof: parseSetting(settings.proof, DEFAULT_PROOF),
    slateToday: r?.report_date === newYorkDate(Date.now()),
    course: ((courseRes.data ?? []) as { module_position: number; title: string; lessons: number }[]).map((m) => ({
      position: m.module_position,
      title: m.title,
      lessons: Number(m.lessons),
    })),
  };
}
