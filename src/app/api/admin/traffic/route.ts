import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import {
  aggregateTraffic,
  fetchTrafficRows,
  normalizeDays,
  windowStart,
  TrafficNotMigrated,
  type TrafficRow,
} from "@/lib/trafficAggregate";

export const dynamic = "force-dynamic";

// Traffic aggregates for the admin Traffic tab (ported from zogby.io).
// Identity comes from the caller's Supabase session cookie — never a
// client-passed user id — and every read below also passes through RLS,
// which only lets admins select page_views.

type SessionEntry = {
  id: string;
  start: string;
  end: string;
  views: number;
  country: string | null;
  city: string | null;
  region: string | null;
  device: string | null;
  entry: string;
  userId: string | null;
  user?: string | null;
};

export async function POST(req: NextRequest) {
  try {
    const supabase = await supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

    const { data: me } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();
    if (!me?.is_admin) return NextResponse.json({ error: "Admins only." }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const rangeDays = normalizeDays(body.days);
    const since = windowStart(rangeDays);

    let rows: TrafficRow[], capped: boolean;
    try {
      ({ rows, capped } = await fetchTrafficRows(supabase, since));
    } catch (e) {
      if (e instanceof TrafficNotMigrated) {
        return NextResponse.json({ error: "not_migrated" }, { status: 424 });
      }
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Failed." },
        { status: 500 }
      );
    }

    const agg = await aggregateTraffic(supabase, rangeDays, rows, capped);

    // Session log: one entry per session_id, newest first, with location and
    // the pages walked.
    const sessions: SessionEntry[] = (() => {
      try {
        const bySession: Record<string, SessionEntry> = {};
        for (const r of rows) {
          const key =
            r.session_id || (r.visitor_id ? `v:${r.visitor_id}:${(r.created_at || "").slice(0, 10)}` : null);
          if (!key) continue;
          const s0 = (bySession[key] ||= {
            id: key,
            start: r.created_at,
            end: r.created_at,
            views: 0,
            country: null,
            city: null,
            region: null,
            device: null,
            entry: r.path || "/",
            userId: null,
          });
          s0.views++;
          if (r.created_at < s0.start) {
            s0.start = r.created_at;
            s0.entry = r.path || s0.entry;
          }
          if (r.created_at > s0.end) s0.end = r.created_at;
          if (!s0.country && r.country) s0.country = r.country;
          if (!s0.city && r.city) s0.city = r.city;
          if (!s0.region && r.region) s0.region = r.region;
          if (!s0.device && r.device) s0.device = r.device;
          if (!s0.userId && r.user_id) s0.userId = r.user_id;
        }
        return Object.values(bySession)
          .sort((a, b) => String(b.start).localeCompare(String(a.start)))
          .slice(0, 120);
      } catch (e) {
        console.error("[traffic] session log failed:", e);
        return [];
      }
    })();

    // Label signed-in sessions with the account's email.
    try {
      const uids = Array.from(new Set(sessions.map((s0) => s0.userId).filter(Boolean))) as string[];
      if (uids.length) {
        const { data: pr } = await supabase
          .from("profiles")
          .select("id, email")
          .in("id", uids.slice(0, 200));
        const byId: Record<string, { email: string | null }> = {};
        (pr || []).forEach((x) => {
          byId[x.id] = x;
        });
        sessions.forEach((s0) => {
          if (s0.userId && byId[s0.userId]) s0.user = byId[s0.userId].email;
        });
      }
    } catch {
      /* sessions render unlabeled */
    }

    // Per-user activity: pageviews in range grouped by signed-in user, joined
    // with profiles for identity. (No service key here, so "member since"
    // comes from profiles rather than auth's last_sign_in_at.)
    const users = await (async () => {
      try {
        const byUser: Record<string, { views: number; lastSeen: string; pages: Record<string, number> }> = {};
        for (const r of rows) {
          if (!r.user_id) continue;
          const u = (byUser[r.user_id] ||= { views: 0, lastSeen: r.created_at, pages: {} });
          u.views++;
          if (r.created_at > u.lastSeen) u.lastSeen = r.created_at;
          const p = r.path || "/";
          u.pages[p] = (u.pages[p] || 0) + 1;
        }

        const ids = Object.keys(byUser);
        if (ids.length === 0) return [];
        const profs: Record<string, { email: string | null; created_at: string | null }> = {};
        for (let i = 0; i < ids.length; i += 200) {
          const { data: pr } = await supabase
            .from("profiles")
            .select("id, email, created_at")
            .in("id", ids.slice(i, i + 200));
          (pr || []).forEach((x) => {
            profs[x.id] = x;
          });
        }

        return ids
          .filter((id) => profs[id])
          .map((id) => {
            const act = byUser[id];
            const pages = Object.entries(act.pages)
              .map(([path, views]) => ({ path, views }))
              .sort((a, b) => b.views - a.views)
              .slice(0, 12);
            return {
              id,
              email: profs[id]?.email || null,
              memberSince: profs[id]?.created_at || null,
              views: act.views,
              lastSeen: act.lastSeen,
              pages,
            };
          })
          .sort((a, b) => String(b.lastSeen || "").localeCompare(String(a.lastSeen || "")))
          .slice(0, 200);
      } catch (e) {
        console.error("[traffic] user activity failed:", e);
        return [];
      }
    })();

    // Occasional retention prune — admins may delete under RLS.
    if (Math.random() < 0.02) {
      const cutoff = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
      supabase.from("page_views").delete().lt("created_at", cutoff).then(
        () => {},
        () => {}
      );
    }

    return NextResponse.json({ ...agg, sessions, users });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed." },
      { status: 500 }
    );
  }
}
