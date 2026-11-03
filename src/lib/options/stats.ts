import type { SupabaseClient } from "@supabase/supabase-js";
import { nyDay } from "@/lib/adminGate";
import { etToday } from "@/lib/setupEngine";
import { streak } from "./track";

// A member's swipe record (step 3 of the swipe app): saved setups, how the closed ones did (estimated, per contract),
// and their daily streak. The scoreboard ranks members on the same numbers.

export type SwipeRecord = { saved: number; open: number; wins: number; losses: number; winRate: number | null; pnl: number; openPnl: number; streak: number; swipes: number; today: boolean };

type Row = { user_id: string; action: string; status: string | null; pnl: number | null; created_at: string };

export function recordOf(rows: Row[], today = etToday()): SwipeRecord {
  const saved = rows.filter((r) => r.action === "right");
  const closed = saved.filter((r) => r.status === "win" || r.status === "loss");
  const wins = closed.filter((r) => r.status === "win").length;
  return {
    saved: saved.length,
    open: saved.filter((r) => r.status === "open").length,
    wins,
    losses: closed.length - wins,
    winRate: closed.length ? Math.round((wins / closed.length) * 100) : null,
    pnl: closed.reduce((s, r) => s + Number(r.pnl ?? 0), 0),
    openPnl: saved.filter((r) => r.status === "open").reduce((s, r) => s + Number(r.pnl ?? 0), 0),
    streak: streak([...new Set(rows.map((r) => nyDay(r.created_at)))], today),
    swipes: rows.length,
    today: rows.some((r) => nyDay(r.created_at) === today),
  };
}

const COLS = "user_id, action, status, pnl, created_at";

/** Every matching swipe, a page of 1,000 at a time (the API's most per request), up to `max`. */
async function all(db: SupabaseClient, userId: string | null, max = 50_000) {
  const out: Row[] = [];
  for (let from = 0; from < max; from += 1000) {
    let q = db.from("swipes").select(COLS).order("id").range(from, from + 999);
    if (userId) q = q.eq("user_id", userId);
    const { data } = await q;
    out.push(...((data ?? []) as Row[]));
    if ((data?.length ?? 0) < 1000) break;
  }
  return out;
}

export async function myRecord(db: SupabaseClient, userId: string) {
  return recordOf(await all(db, userId));
}

/** Every member with a closed saved setup, best total first (ties: more wins). Service role: reads everyone's swipes. */
export async function scoreboard(db: SupabaseClient) {
  const byUser = new Map<string, Row[]>();
  for (const r of await all(db, null)) byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r]);
  const ids = [...byUser.keys()];
  const { data: people } = ids.length ? await db.from("profiles").select("id, name").in("id", ids) : { data: [] };
  const nameOf = new Map(((people ?? []) as { id: string; name: string | null }[]).map((p) => [p.id, p.name?.trim() || null]));
  return ids
    .map((id) => ({ id, name: nameOf.get(id) ?? `Trader ${id.slice(0, 4).toUpperCase()}`, ...recordOf(byUser.get(id)!) }))
    .filter((r) => r.wins + r.losses > 0)
    .sort((a, b) => b.pnl - a.pnl || b.wins - a.wins);
}

/** The Monday (New York) that starts the week holding `day` (YYYY-MM-DD). */
export function weekStart(day: string) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

export type Standing = { id: string; name: string; saved: number; wins: number; closed: number; pnl: number };

/** The minimum saves in a week to be ranked in its contest. */
export const CONTEST_MIN = 3;

/**
 * A week's contest (step 5 of the swipe app; Ben 2026-11-02: "Leaderboard contests"): every setup saved that week, one
 * contract each, scored by its result so far (closed results and open ones at their estimated value); at least three
 * saves to be ranked. Service role: reads everyone's swipes.
 */
export async function weekStandings(db: SupabaseClient, start: string): Promise<Standing[]> {
  const from = new Date(`${start}T05:00:00Z`).toISOString();
  const to = new Date(`${addDays(start, 7)}T05:00:00Z`).toISOString();
  const rows: { user_id: string; status: string | null; pnl: number | null }[] = [];
  for (let i = 0; i < 50; i++) {
    const { data } = await db.from("swipes").select("user_id, status, pnl").eq("action", "right").gte("created_at", from).lt("created_at", to).order("id").range(i * 1000, i * 1000 + 999);
    rows.push(...((data ?? []) as typeof rows));
    if ((data?.length ?? 0) < 1000) break;
  }
  const by = new Map<string, Standing>();
  for (const r of rows) {
    const s = by.get(r.user_id) ?? { id: r.user_id, name: "", saved: 0, wins: 0, closed: 0, pnl: 0 };
    s.saved++;
    s.pnl += Number(r.pnl ?? 0);
    if (r.status === "win" || r.status === "loss") s.closed++;
    if (r.status === "win") s.wins++;
    by.set(r.user_id, s);
  }
  const ranked = [...by.values()].filter((s) => s.saved >= CONTEST_MIN);
  const { data: people } = ranked.length ? await db.from("profiles").select("id, name").in("id", ranked.map((r) => r.id)) : { data: [] };
  const nameOf = new Map(((people ?? []) as { id: string; name: string | null }[]).map((p) => [p.id, p.name?.trim() || null]));
  return ranked.map((s) => ({ ...s, name: nameOf.get(s.id) ?? `Trader ${s.id.slice(0, 4).toUpperCase()}` })).sort((a, b) => b.pnl - a.pnl || b.wins - a.wins);
}

/** Freezes last week's contest once it's over (idempotent; called by the deck's refresh). */
export async function freezeLastWeek(db: SupabaseClient) {
  const last = addDays(weekStart(etToday()), -7);
  const { data: done } = await db.from("contest_weeks").select("week_start").eq("week_start", last).maybeSingle();
  if (done) return { week: last, frozen: false };
  const standings = await weekStandings(db, last);
  await db.from("contest_weeks").insert({ week_start: last, standings });
  return { week: last, frozen: true, entrants: standings.length };
}
