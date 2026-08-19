"use client";
import { useEffect, useRef, useState } from "react";

// Admin ▸ Traffic — first-party analytics from the page_views table.
// All aggregation happens server-side (/api/admin/traffic); this component
// just renders the summary. Ported from zogby.io's Traffic tab.

type Traffic = {
  days: number;
  capped?: boolean;
  trackingSince: string | null;
  totals: { views: number; visitors: number; sessions: number; postViews: number };
  daily: { date: string; views: number; visitors: number }[];
  pages: { path: string; views: number; visitors: number }[];
  posts: { slug: string; label: string; views: number }[];
  referrers: { key: string; views: number }[];
  devices: { key: string; views: number }[];
  countries: { key: string; views: number }[];
  users?: {
    id: string;
    email: string | null;
    memberSince: string | null;
    views: number;
    lastSeen: string | null;
    pages: { path: string; views: number }[];
  }[];
  sessions?: {
    id: string;
    start: string;
    end: string;
    views: number;
    country: string | null;
    city: string | null;
    region: string | null;
    device: string | null;
    entry: string;
    user?: string | null;
  }[];
};

const PAGE_LABEL: Record<string, string> = {
  "/": "Homepage",
  "/blog/[slug]": "Blog posts (all)",
  "/blog": "Blog index",
  "/results": "Results",
  "/pricing": "Pricing",
  "/about": "About",
  "/company": "Company",
  "/signin": "Sign in",
  "/signup": "Sign up",
  "/dashboard": "Dashboard (app)",
  "/admin": "Admin (app)",
};

export default function TrafficTab() {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [data, setData] = useState<Traffic | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr("");
      const res = await fetch("/api/admin/traffic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days }),
      });
      const j = await res.json().catch(() => ({}));
      if (!alive) return;
      if (!res.ok) {
        setErr(
          j.error === "not_migrated"
            ? "The page_views table doesn't exist yet — apply the page_views migration."
            : j.error || "Could not load traffic."
        );
        setLoading(false);
        return;
      }
      setData(j);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [days]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {([7, 30, 90] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDays(d)}
            className={`rounded-full border px-4 py-1.5 font-display text-xs font-semibold transition ${
              days === d
                ? "border-accent bg-accent text-bg"
                : "border-line-strong text-ink-2 hover:border-accent/50 hover:text-accent"
            }`}
          >
            Last {d} days
          </button>
        ))}
        {data?.capped && (
          <span className="text-xs text-ink-3">Showing the first 50,000 pageviews in range.</span>
        )}
      </div>

      {err && <p className="text-sm text-down">{err}</p>}
      {loading && !err && <p className="text-sm text-ink-3">Loading traffic…</p>}

      {data && !loading && !err && (
        <div>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-4">
            {[
              { label: "Pageviews", value: data.totals.views },
              { label: "Unique visitors", value: data.totals.visitors },
              { label: "Sessions", value: data.totals.sessions },
              { label: "Blog reads", value: data.totals.postViews },
            ].map((s) => (
              <div key={s.label} className="bg-panel px-5 py-6">
                <p className="text-[10px] uppercase tracking-wider text-ink-3">{s.label}</p>
                <p className="mt-1 font-display text-3xl font-bold text-accent">
                  {s.value.toLocaleString()}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <DailyChart daily={data.daily} />
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <RankCard
              title="Top pages"
              rows={data.pages.map((p) => ({
                label: PAGE_LABEL[p.path] || p.path,
                sub: p.path,
                views: p.views,
                extra: `${p.visitors.toLocaleString()} visitors`,
              }))}
              empty="No pageviews yet."
            />
            <RankCard
              title="Top blog posts"
              rows={data.posts.map((p) => ({ label: p.label, sub: `/blog/${p.slug}`, views: p.views }))}
              empty="No blog reads in this range."
            />
            <RankCard
              title="Referrers"
              rows={data.referrers.map((r) => ({ label: r.key, views: r.views }))}
              empty="No external referrers yet (direct traffic only)."
            />
            <RankCard
              title="Countries"
              rows={data.countries.map((c) => {
                const d = countryDisplay(c.key);
                return { label: `${d.flag} ${d.name}`, sub: d.name, views: c.views };
              })}
              empty="No country data yet (populates on Vercel)."
            />
            <RankCard
              title="Devices"
              rows={data.devices.map((d) => ({
                label: d.key.charAt(0).toUpperCase() + d.key.slice(1),
                views: d.views,
              }))}
              empty="No device data yet."
            />
          </div>

          <SessionLog sessions={data.sessions || []} />
          <UserActivity users={data.users || []} />

          <p className="mt-5 text-xs text-ink-3">
            First-party tracking: one anonymous pageview per route change, bots filtered, no
            cookies, 180-day retention.
            {data.trackingSince &&
              ` Tracking since ${new Date(data.trackingSince).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}.`}
          </p>
        </div>
      )}
    </div>
  );
}

// Session log: one row per visit, newest first, with location detail.
function SessionLog({ sessions }: { sessions: NonNullable<Traffic["sessions"]> }) {
  if (sessions.length === 0) return null;
  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const durationMin = (a: string, b: string) =>
    Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000));
  const locationOf = (s: NonNullable<Traffic["sessions"]>[number]) => {
    const parts = [s.city, s.region].filter(Boolean).join(", ");
    if (!s.country) return parts || "—";
    const d = countryDisplay(s.country);
    return `${d.flag} ${parts ? `${parts} · ` : ""}${d.name}`;
  };
  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-panel">
      <div className="px-5 pb-1 pt-4 font-display text-sm font-semibold">
        Sessions <span className="font-body font-normal text-ink-3">· {sessions.length} most recent</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-[10px] uppercase tracking-wider text-ink-3">
              {["Started", "Location", "Visitor", "Entry page", "Pages", "Duration", "Device"].map((h) => (
                <th key={h} className="whitespace-nowrap px-4 py-2.5 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {sessions.map((s) => (
              <tr key={s.id}>
                <td className="whitespace-nowrap px-4 py-2.5 text-ink-2">{fmtTime(s.start)}</td>
                <td className="whitespace-nowrap px-4 py-2.5">{locationOf(s)}</td>
                <td className={`px-4 py-2.5 ${s.user ? "text-ink" : "text-ink-3"}`}>
                  {s.user || "Visitor"}
                </td>
                <td className="max-w-[220px] truncate px-4 py-2.5 font-mono-nums text-xs text-ink-3">
                  {s.entry}
                </td>
                <td className="px-4 py-2.5 font-mono-nums">{s.views}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-ink-2">
                  {s.views > 1 ? `${durationMin(s.start, s.end)} min` : "—"}
                </td>
                <td className="px-4 py-2.5 capitalize text-ink-2">{s.device || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DailyChart({ daily }: { daily: { date: string; views: number; visitors: number }[] }) {
  const max = Math.max(1, ...daily.map((d) => d.views));
  const W = 900,
    H = 160,
    PAD = 10,
    BASE = H - 18;
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const n = daily.length;
  const step = n > 1 ? (W - PAD * 2) / (n - 1) : 0;
  const px = (i: number) => (n > 1 ? PAD + i * step : W / 2);
  const py = (v: number) => BASE - (v / max) * (H - 34);
  const points = daily.map((d, i) => `${px(i)},${py(d.views)}`).join(" ");
  const area = n > 0 ? `${px(0)},${BASE} ${points} ${px(n - 1)},${BASE}` : "";

  function onMove(e: React.MouseEvent) {
    const el = svgRef.current;
    if (!el || n === 0) return;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const idx = n > 1 ? Math.round((x - PAD) / step) : 0;
    setHover(Math.max(0, Math.min(n - 1, idx)));
  }

  const d = hover != null ? daily[hover] : null;
  const fmtDay = (iso: string) =>
    new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });

  return (
    <div className="rounded-2xl border border-line bg-panel p-5">
      <div className="mb-2.5 flex items-baseline justify-between">
        <p className="font-display text-sm font-semibold">Daily pageviews</p>
        <p className="font-mono-nums text-xs text-ink-3">peak {max.toLocaleString()}/day</p>
      </div>
      <div className="relative">
        {d && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-ink px-3 py-2 text-xs leading-relaxed text-bg shadow-lg"
            style={{ left: `${(px(hover!) / W) * 100}%`, top: -6 }}
          >
            <div className="font-bold">{fmtDay(d.date)}</div>
            <div>
              <span className="font-mono-nums font-bold">{d.views.toLocaleString()}</span> views ·{" "}
              <span className="font-mono-nums font-bold">{d.visitors.toLocaleString()}</span> visitors
            </div>
          </div>
        )}
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
          className="block h-auto w-full cursor-crosshair overflow-visible"
          role="img"
          aria-label="Daily pageviews"
        >
          <defs>
            <linearGradient id="traffic-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <line x1={PAD} y1={BASE} x2={W - PAD} y2={BASE} stroke="var(--color-line)" strokeWidth="1" />
          {n > 1 && <polygon points={area} fill="url(#traffic-fill)" />}
          {n > 1 && (
            <polyline
              points={points}
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
          {n === 1 && <circle cx={px(0)} cy={py(daily[0].views)} r="4" fill="var(--color-accent)" />}
          {d && (
            <g>
              <line
                x1={px(hover!)}
                y1={14}
                x2={px(hover!)}
                y2={BASE}
                stroke="var(--color-line-strong)"
                strokeWidth="1"
                strokeDasharray="3 4"
              />
              <circle
                cx={px(hover!)}
                cy={py(d.views)}
                r="5"
                fill="var(--color-accent)"
                stroke="var(--color-panel)"
                strokeWidth="2.5"
              />
            </g>
          )}
          <text x={PAD} y={H - 4} fontSize="11" fill="var(--color-ink-3)">
            {daily[0]?.date || ""}
          </text>
          <text x={W - PAD} y={H - 4} fontSize="11" fill="var(--color-ink-3)" textAnchor="end">
            {daily[daily.length - 1]?.date || ""}
          </text>
        </svg>
      </div>
    </div>
  );
}

// Country display: turns "US" into a flag emoji + "United States".
let NAME_TO_CODE: Map<string, string> | null = null;
function countryDisplay(key: string): { flag: string; name: string } {
  const k = String(key || "").trim();
  const codeFlag = (cc: string) =>
    String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames(["en"], { type: "region" });
  } catch {
    /* older runtimes */
  }

  if (/^[A-Za-z]{2}$/.test(k)) {
    const cc = k.toUpperCase();
    let name = cc;
    try {
      name = names?.of(cc) || cc;
    } catch {
      /* invalid code */
    }
    return { flag: codeFlag(cc), name };
  }
  if (names && !NAME_TO_CODE) {
    NAME_TO_CODE = new Map();
    for (let a = 65; a <= 90; a++)
      for (let b = 65; b <= 90; b++) {
        const cc = String.fromCharCode(a) + String.fromCharCode(b);
        try {
          const nm = names.of(cc);
          if (nm && nm !== cc) NAME_TO_CODE.set(nm.toLowerCase(), cc);
        } catch {
          /* skip invalid */
        }
      }
  }
  const cc = NAME_TO_CODE?.get(k.toLowerCase());
  return { flag: cc ? codeFlag(cc) : "🌐", name: k };
}

// Per-user activity: signed-in members and what they looked at. Rows expand
// to show the exact pages that user viewed within the selected range.
function UserActivity({ users }: { users: NonNullable<Traffic["users"]> }) {
  const [open, setOpen] = useState<string | null>(null);
  const fmtWhen = (iso: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    const days = (Date.now() - d.getTime()) / 86400000;
    if (days < 1) return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) + " today";
    if (days < 2) return "Yesterday";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div className="mt-6 rounded-2xl border border-line bg-panel p-5">
      <p className="font-display text-sm font-semibold">User activity</p>
      <p className="mb-3 mt-0.5 text-xs text-ink-3">
        Signed-in members and the pages they viewed within the selected range. Click a row for
        their pages.
      </p>
      {users.length === 0 ? (
        <p className="text-sm text-ink-3">
          No signed-in activity recorded yet. Views attribute to members from the moment tracking
          deployed.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[560px]">
            <div className="grid grid-cols-[minmax(160px,2fr)_1fr_1fr_70px_16px] gap-2.5 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-3">
              <span>Member</span>
              <span>Member since</span>
              <span>Last seen</span>
              <span className="text-right">Views</span>
              <span />
            </div>
            {users.map((u) => (
              <div key={u.id} className="border-t border-line">
                <button
                  type="button"
                  onClick={() => setOpen((o) => (o === u.id ? null : u.id))}
                  className="grid w-full grid-cols-[minmax(160px,2fr)_1fr_1fr_70px_16px] items-center gap-2.5 px-2 py-2.5 text-left"
                >
                  <span className="truncate text-sm font-semibold text-ink">
                    {u.email || u.id.slice(0, 8)}
                  </span>
                  <span className="text-xs text-ink-2">{fmtWhen(u.memberSince)}</span>
                  <span className="text-xs text-ink-2">{fmtWhen(u.lastSeen)}</span>
                  <span className="text-right font-mono-nums text-xs font-semibold text-ink">
                    {u.views || 0}
                  </span>
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--color-ink-3)"
                    strokeWidth="2"
                    className={`transition-transform ${open === u.id ? "rotate-180" : ""}`}
                    aria-hidden="true"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {open === u.id && (
                  <div className="px-2 pb-3">
                    {u.pages.length === 0 ? (
                      <p className="text-xs text-ink-3">No pageviews in this range.</p>
                    ) : (
                      <div className="grid grid-cols-[1fr_60px] gap-x-2.5 gap-y-1">
                        {u.pages.map((pg) => (
                          <div key={pg.path} className="contents">
                            <span className="truncate font-mono-nums text-xs text-ink-2">
                              {pg.path}
                            </span>
                            <span className="text-right font-mono-nums text-xs font-semibold text-ink">
                              {pg.views}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RankCard({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: { label: string; sub?: string; views: number; extra?: string }[];
  empty: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.views));
  return (
    <div className="rounded-2xl border border-line bg-panel p-5">
      <p className="mb-3 font-display text-sm font-semibold">{title}</p>
      {rows.length === 0 && <p className="text-sm text-ink-3">{empty}</p>}
      {rows.map((r, i) => (
        <div key={`${r.label}-${i}`} className="mb-2.5">
          <div className="flex justify-between gap-2.5 text-sm">
            <span className="truncate text-ink-2" title={r.sub || r.label}>
              {r.label}
            </span>
            <span className="whitespace-nowrap font-mono-nums font-semibold text-ink">
              {r.views.toLocaleString()}
              {r.extra ? <span className="font-normal text-ink-3"> · {r.extra}</span> : null}
            </span>
          </div>
          <div className="mt-1 h-1 rounded-full bg-panel-2">
            <div
              className="h-1 rounded-full bg-accent"
              style={{ width: `${Math.max(3, Math.round((r.views / max) * 100))}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
