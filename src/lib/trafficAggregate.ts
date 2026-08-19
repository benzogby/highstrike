import type { SupabaseClient } from "@supabase/supabase-js";

// Traffic aggregation for the admin Traffic tab (ported from zogby.io's
// shared aggregation module). One aggregation path so there is never more
// than one answer to "visitors this month".

const SITE_HOST = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.highstrike.com")
  .replace(/^https?:\/\//, "")
  .replace(/\/$/, "");
const MAX_ROWS = 50000; // safety cap per request (paged 1000 at a time)

export type TrafficRow = {
  created_at: string;
  path: string | null;
  referrer: string | null;
  visitor_id: string | null;
  session_id: string | null;
  device: string | null;
  country: string | null;
  city?: string | null;
  region?: string | null;
  user_id: string | null;
};

export type TrafficAggregate = {
  days: number;
  capped: boolean;
  /** Earliest pageview EVER recorded. Anything before it is untracked, not zero. */
  trackingSince: string | null;
  totals: { views: number; visitors: number; sessions: number; postViews: number };
  daily: { date: string; views: number; visitors: number }[];
  pages: { path: string; views: number; visitors: number }[];
  posts: { slug: string; label: string; views: number }[];
  referrers: { key: string; views: number }[];
  devices: { key: string; views: number }[];
  countries: { key: string; views: number }[];
};

export class TrafficNotMigrated extends Error {}

/** Read every pageview in range, paging past Supabase's 1000-row select cap. */
export async function fetchTrafficRows(
  db: SupabaseClient,
  since: string
): Promise<{ rows: TrafficRow[]; capped: boolean }> {
  const rows: TrafficRow[] = [];
  for (let from = 0; from < MAX_ROWS; from += 1000) {
    const { data, error } = await db
      .from("page_views")
      .select("created_at, path, referrer, visitor_id, session_id, device, country, city, region, user_id")
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .range(from, from + 999);
    if (error) {
      if (/page_views/.test(error.message)) throw new TrafficNotMigrated(error.message);
      throw new Error(error.message);
    }
    rows.push(...((data || []) as TrafficRow[]));
    if (!data || data.length < 1000) break;
  }
  return { rows, capped: rows.length >= MAX_ROWS };
}

export async function aggregateTraffic(
  db: SupabaseClient,
  rangeDays: number,
  rows: TrafficRow[],
  capped: boolean
): Promise<TrafficAggregate> {
  const dayKey = (iso: string) => iso.slice(0, 10);
  const daily: Record<string, { views: number; visitors: Set<string> }> = {};
  for (let i = rangeDays - 1; i >= 0; i--) {
    daily[dayKey(new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString())] = {
      views: 0,
      visitors: new Set(),
    };
  }

  const visitors = new Set<string>();
  const sessions = new Set<string>();
  const pages: Record<string, { views: number; visitors: Set<string> }> = {};
  const postViews: Record<string, number> = {};
  const referrers: Record<string, number> = {};
  const devices: Record<string, number> = {};
  const countries: Record<string, number> = {};
  let totalViews = 0;
  let totalPostViews = 0;

  for (const r of rows) {
    totalViews++;
    const vid = r.visitor_id || "unknown";
    if (r.visitor_id) visitors.add(r.visitor_id);
    if (r.session_id) sessions.add(r.session_id);

    const d = daily[dayKey(r.created_at)];
    if (d) {
      d.views++;
      if (r.visitor_id) d.visitors.add(r.visitor_id);
    }

    // Collapse blog post pages into one "pages" row, track each post separately.
    const postMatch = /^\/blog\/([^/?#]+)/.exec(r.path || "");
    const pageKey = postMatch ? "/blog/[slug]" : r.path || "/";
    if (!pages[pageKey]) pages[pageKey] = { views: 0, visitors: new Set() };
    pages[pageKey].views++;
    if (r.visitor_id) pages[pageKey].visitors.add(vid);
    if (postMatch) {
      totalPostViews++;
      postViews[postMatch[1]] = (postViews[postMatch[1]] || 0) + 1;
    }

    // External referrers only (internal navs are recorded as "/path").
    const ref = r.referrer || "";
    if (ref && !ref.startsWith("/")) {
      try {
        const host = new URL(ref).hostname.replace(/^www\./, "");
        if (host && host !== SITE_HOST.replace(/^www\./, "")) {
          referrers[host] = (referrers[host] || 0) + 1;
        }
      } catch {
        /* unparseable referrer */
      }
    }

    if (r.device) devices[r.device] = (devices[r.device] || 0) + 1;
    if (r.country) countries[r.country] = (countries[r.country] || 0) + 1;
  }

  // The first pageview ever recorded. Without this a 30-day chart draws zeros
  // for the days before tracking existed, which reads as "nobody visited"
  // rather than "we weren't counting".
  let trackingSince: string | null = null;
  try {
    const { data } = await db
      .from("page_views")
      .select("created_at")
      .order("created_at", { ascending: true })
      .limit(1);
    trackingSince = data?.[0]?.created_at || null;
  } catch {
    /* leave null — the client treats null as "unknown", not "always tracked" */
  }

  const top = (m: Record<string, number>, n: number) =>
    Object.entries(m)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([key, views]) => ({ key, views }));

  const slugLabel = (slug: string) =>
    slug.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase());

  return {
    days: rangeDays,
    capped,
    trackingSince,
    totals: {
      views: totalViews,
      visitors: visitors.size,
      sessions: sessions.size,
      postViews: totalPostViews,
    },
    daily: Object.entries(daily).map(([date, v]) => ({
      date,
      views: v.views,
      visitors: v.visitors.size,
    })),
    pages: Object.entries(pages)
      .sort((a, b) => b[1].views - a[1].views)
      .slice(0, 15)
      .map(([path, v]) => ({ path, views: v.views, visitors: v.visitors.size })),
    posts: top(postViews, 10).map(({ key, views }) => ({
      slug: key,
      label: slugLabel(key),
      views,
    })),
    referrers: top(referrers, 10),
    devices: top(devices, 5),
    countries: top(countries, 10),
  };
}

export function normalizeDays(days: unknown): number {
  return [7, 30, 90].includes(Number(days)) ? Number(days) : 30;
}

// The start of the window, ALIGNED TO A UTC DAY BOUNDARY, so the daily chart's
// buckets and the KPI totals describe exactly the same set of rows.
export function windowStart(rangeDays: number): string {
  const d = new Date(Date.now() - (rangeDays - 1) * 24 * 60 * 60 * 1000);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();
}
