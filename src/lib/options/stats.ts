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
