"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Anchor, Candle, Drawing, DrawingKind, HouseLevels } from "@/lib/chart/types";
import { FIB_LEVELS, niceTicks, priceLabel, rsi, sma, timeScale, toWeekly, volumeLabel } from "@/lib/chart/math";
import { planNumbers } from "@/lib/chart/plan";

// HighStrike Chart (Ben, 2026-11-17: "Our own custom charts, with our UI, and deep markup ability"): daily and weekly
// candles from /api/candles, the 9/21/50/200 moving averages, volume and RSI, and markup the member draws on it: levels,
// trend lines, zones, notes, arrows, a measure, a Fibonacci retracement and long/short trade plans whose reward:risk
// and estimated option value update as they're dragged. A member's drawings are theirs alone, saved per ticker in
// public.chart_drawings. An idea's own entry, target and stop come in as `levels` and are drawn but not editable.
// All SVG, sized to its box; mouse, pen and touch through pointer events.

type Tool = "cursor" | DrawingKind | "plan-long" | "plan-short";

const COLORS: Record<string, string> = {
  green: "var(--color-accent)",
  blue: "var(--color-glyph-7)",
  amber: "var(--color-glyph-2)",
  red: "var(--color-down)",
  purple: "var(--color-glyph-9)",
  white: "var(--color-ink)",
};
const colorOf = (c: string) => COLORS[c] ?? COLORS.blue;

const MAS = [
  { n: 9, color: "var(--color-glyph-6)" },
  { n: 21, color: "var(--color-glyph-2)" },
  { n: 50, color: "var(--color-glyph-9)" },
  { n: 200, color: "var(--color-ink-2)" },
] as const;

const AXIS_W = 64;
const TIME_H = 22;
const RSI_H = 84;
const GAP = 6;
const HIT = 7;

type Settings = { weekly: boolean; mas: number[]; volume: boolean; rsi: boolean };
const DEFAULT_SETTINGS: Settings = { weekly: false, mas: [21, 50, 200], volume: true, rsi: true };
const SETTINGS_KEY = "hs-chart-settings";

const TOOLS: { key: Tool; label: string; icon: string }[] = [
  { key: "cursor", label: "Select and move", icon: "M5 3l14 8-6 2-2 6z" },
  { key: "hline", label: "Price level", icon: "M3 12h18M7 9v6" },
  { key: "trend", label: "Trend line", icon: "M4 19L20 5M4 19a1.5 1.5 0 100-.01M20 5a1.5 1.5 0 100-.01" },
  { key: "zone", label: "Zone", icon: "M4 8h16v8H4z" },
  { key: "note", label: "Note", icon: "M5 5h14v10H9l-4 4z" },
  { key: "arrow", label: "Arrow", icon: "M5 19L19 5m0 0h-7m7 0v7" },
  { key: "measure", label: "Measure", icon: "M4 20V4m16 16V4M4 12h16m-3-3l3 3-3 3M7 9l-3 3 3 3" },
  { key: "fib", label: "Fibonacci retracement", icon: "M4 5h16M4 9h16M4 13h16M4 19h16" },
  { key: "plan-long", label: "Long trade plan", icon: "M4 15h16M4 15V5h16v10M4 15v4h16v-4" },
  { key: "plan-short", label: "Short trade plan", icon: "M4 9h16M4 9v10h16V9M4 9V5h16v4" },
];

const TWO_POINT: Tool[] = ["trend", "zone", "arrow", "measure", "fib"];

const uid = () => Math.random().toString(36).slice(2, 10);

type Props = {
  ticker: string;
  userId?: string;
  levels?: HouseLevels | null;
  height?: number;
  /** Fill the box's height (the desk's full-screen chart) instead of a fixed height. */
  fill?: boolean;
};

export default function HighStrikeChart({ ticker, userId, levels, height, fill = false }: Props) {
  const [data, setData] = useState<{ candles: Candle[]; source: string; stale: boolean } | null>(null);
  const [failed, setFailed] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [width, setWidth] = useState(0);
  // With `fill`: the height of the plot area, measured.
  const [areaH, setAreaH] = useState(0);
  const areaRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<{ end: number; count: number } | null>(null);
  // Ben, 2026-11-18: "Allow me to scale the axes by clicking and dragging". A price range set by dragging the price
  // axis (for this ticker and timeframe only); null fits the visible bars. Double-click an axis to go back to automatic.
  const [yRange, setYRange] = useState<{ key: string; lo: number; hi: number } | null>(null);
  const [overAxis, setOverAxis] = useState<"price" | "time" | null>(null);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>("cursor");
  const [draft, setDraft] = useState<Drawing | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [color, setColor] = useState("blue");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [loadedDrawings, setLoadedDrawings] = useState(false);

  const boxRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<
    | null
    | { mode: "pan"; startX: number; startY: number; end: number; moved: boolean; lo: number; hi: number }
    | { mode: "yscale"; startY: number; lo: number; hi: number }
    | { mode: "xscale"; startX: number; end: number; count: number }
    | { mode: "move"; id: string; start: Anchor; orig: Anchor[]; moved: boolean }
    | { mode: "handle"; id: string; h: number }
    | { mode: "draw"; startX: number; startY: number }
  >(null);
  const history = useRef<Drawing[][]>([]);

  // Settings remembered in this browser (a convenience; the chart works without them).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reading the browser's saved settings once, on mount
      if (raw) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) });
    } catch {}
  }, []);
  const changeSettings = (s: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...s };
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
    if (s.weekly !== undefined) setView(null);
  };

  // Candles.
  useEffect(() => {
    let alive = true;
    fetch(`/api/candles?symbol=${encodeURIComponent(ticker)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => alive && setData({ candles: d.candles ?? [], source: d.source, stale: d.stale }))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [ticker]);

  // The member's drawings on this ticker.
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    supabaseBrowser()
      .from("chart_drawings")
      .select("drawings")
      .eq("ticker", ticker)
      .maybeSingle()
      .then(({ data: row }) => {
        if (!alive) return;
        setDrawings(Array.isArray(row?.drawings) ? (row.drawings as Drawing[]) : []);
        setLoadedDrawings(true);
      });
    return () => {
      alive = false;
    };
  }, [ticker, userId]);

  // Save shortly after the last change.
  const dirty = useRef(false);
  useEffect(() => {
    if (!userId || !loadedDrawings || !dirty.current) return;
    const timer = setTimeout(async () => {
      setSaveState("saving");
      const { error } = await supabaseBrowser()
        .from("chart_drawings")
        .upsert({ user_id: userId, ticker, drawings, updated_at: new Date().toISOString() });
      setSaveState(error ? "error" : "saved");
      dirty.current = false;
    }, 700);
    return () => clearTimeout(timer);
  }, [drawings, userId, ticker, loadedDrawings]);

  const commit = useCallback((next: Drawing[] | ((prev: Drawing[]) => Drawing[])) => {
    setDrawings((prev) => {
      history.current.push(prev);
      if (history.current.length > 60) history.current.shift();
      dirty.current = true;
      return typeof next === "function" ? next(prev) : next;
    });
  }, []);
  const undo = useCallback(() => {
    const prev = history.current.pop();
    if (prev) {
      dirty.current = true;
      setDrawings(prev);
    }
  }, []);

  // Width of the box.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const el = areaRef.current;
    if (!fill || !el) return;
    const ro = new ResizeObserver(([e]) => setAreaH(Math.floor(e.contentRect.height)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [fill]);

  const bars = useMemo(() => (data ? (settings.weekly ? toWeekly(data.candles) : data.candles) : []), [data, settings.weekly]);
  const ts = useMemo(() => timeScale(bars, settings.weekly), [bars, settings.weekly]);
  const maLines = useMemo(() => MAS.filter((m) => settings.mas.includes(m.n)).map((m) => ({ ...m, values: sma(bars, m.n) })), [bars, settings.mas]);
  const rsiValues = useMemo(() => (settings.rsi ? rsi(bars) : []), [bars, settings.rsi]);
  const closes = useMemo(() => (data?.candles ?? []).map((c) => c.c), [data]);

  const narrow = width > 0 && width < 640;
  const drawn = Boolean(data && bars.length > 0 && width > 0);
  // Filling: the plot area less the legend (20px), the time axis and the RSI pane when it's on.
  const filled = fill && areaH > 0 ? Math.max(180, areaH - 20 - TIME_H - (settings.rsi ? RSI_H + GAP : 0)) : null;
  const priceH = filled ?? height ?? (narrow ? 300 : 420);
  // The tool rail takes 40px of the box (w-8 + gap-2) beside the chart; on a phone it's a row above it.
  const chartW = Math.max(160, narrow ? width : width - 40);
  const plotW = chartW - AXIS_W;
  const rsiTop = priceH + TIME_H + GAP;
  const totalH = priceH + TIME_H + (settings.rsi ? RSI_H + GAP : 0);

  const defaultCount = settings.weekly ? (narrow ? 45 : 80) : narrow ? 60 : 130;
  const v = useMemo(
    () => view ?? { end: bars.length - 1 + (settings.weekly ? 4 : 8), count: Math.min(defaultCount, Math.max(20, bars.length + 8)) },
    [view, bars.length, settings.weekly, defaultCount]
  );
  const left = v.end - v.count;
  const barW = plotW / v.count;
  const x = (i: number) => (i - left + 0.5) * barW;
  const invX = (px: number) => px / barW - 0.5 + left;

  // Price range over the visible bars (and the idea's levels, so they're always on screen).
  const rangeKey = `${ticker}:${settings.weekly ? "w" : "d"}`;
  const manual = yRange && yRange.key === rangeKey ? yRange : null;
  const auto = useMemo(() => {
    let l = Infinity;
    let h = -Infinity;
    const from = Math.max(0, Math.floor(left));
    const to = Math.min(bars.length - 1, Math.ceil(v.end));
    for (let i = from; i <= to; i++) {
      l = Math.min(l, bars[i].l);
      h = Math.max(h, bars[i].h);
    }
    if (levels) {
      for (const p of [levels.entry, levels.target, levels.stop]) {
        if (p == null || !(p > 0)) continue;
        l = Math.min(l, p);
        h = Math.max(h, p);
      }
    }
    if (!Number.isFinite(l)) return { lo: 0, hi: 1 };
    const pad = (h - l) * 0.07 || h * 0.02 || 1;
    return { lo: l - pad, hi: h + pad };
  }, [bars, left, v.end, levels]);
  const { lo, hi } = manual ?? auto;
  const y = (p: number) => ((hi - p) / (hi - lo)) * priceH;
  const invY = (py: number) => hi - (py / priceH) * (hi - lo);

  const anchorAt = (px: number, py: number): Anchor => ({ t: ts.date(Math.round(invX(px))), p: Number(invY(py).toFixed(2)) });
  const ax = (a: Anchor) => x(ts.index(a.t));
  const ay = (a: Anchor) => y(a.p);

  // Zoom (wheel, buttons, pinch-free): keep the bar under the pointer where it is.
  const zoom = useCallback(
    (factor: number, atPx?: number) => {
      setView((cur) => {
        const c = cur ?? v;
        const count = Math.max(15, Math.min(Math.max(60, bars.length + 40), c.count * factor));
        const anchorPx = atPx ?? plotW;
        const anchorIdx = anchorPx / (plotW / c.count) - 0.5 + (c.end - c.count);
        const end = anchorIdx + (c.end - anchorIdx) * (count / c.count);
        return { end, count };
      });
    },
    [v, bars.length, plotW]
  );
  const zoomRef = useRef(zoom);
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    // Ben, 2026-11-18: "Scroll and zoom are way too sensitive". A trackpad sends many small wheel events per swipe and a
    // mouse a few big ones, so zoom follows how far the wheel moved (about 10% a mouse notch, a little per trackpad
    // event, never more than 12% at once) and a sideways swipe pans at half its distance.
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const unit = e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? r.height : 1;
      const dx = e.deltaX * unit;
      const dy = e.deltaY * unit;
      if (Math.abs(dx) > Math.abs(dy)) {
        setView((cur) => (cur ? { ...cur, end: cur.end + (dx / r.width) * cur.count * 0.5 } : cur));
        return;
      }
      const factor = Math.min(1.12, Math.max(1 / 1.12, Math.exp(dy * 0.001)));
      if (Math.abs(factor - 1) < 0.0005) return;
      zoomRef.current(factor, e.clientX - r.left);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // Re-attached once the plot is actually drawn (it waits for the box's width as well as the prices).
  }, [data, drawn]);

  // ---- Hit testing --------------------------------------------------------------------------------------------------

  const handlesOf = (d: Drawing): { x: number; y: number; apply: (a: Anchor, pts: Anchor[]) => Anchor[] }[] => {
    if (d.kind === "plan") {
      const [e, s, t] = d.pts;
      const x0 = ax(e);
      const x1 = ax(s);
      return [
        { x: x0, y: ay(e), apply: (a, p) => [{ t: a.t, p: a.p }, p[1], p[2]] },
        { x: x0, y: ay(s), apply: (a, p) => [p[0], { ...p[1], p: a.p }, p[2]] },
        { x: x0, y: ay(t), apply: (a, p) => [p[0], p[1], { ...p[2], p: a.p }] },
        { x: x1, y: ay(e), apply: (a, p) => [p[0], { ...p[1], t: a.t }, { ...p[2], t: a.t }] },
      ];
    }
    if (d.kind === "hline") return [{ x: Math.min(plotW - 30, Math.max(30, ax(d.pts[0]))), y: ay(d.pts[0]), apply: (a) => [a] }];
    return d.pts.map((p, i) => ({ x: ax(p), y: ay(p), apply: (a: Anchor, pts: Anchor[]) => pts.map((q, j) => (j === i ? a : q)) }));
  };

  const distSeg = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = dx * dx + dy * dy;
    const t = len ? Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len)) : 0;
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  };

  const hits = (d: Drawing, px: number, py: number) => {
    const [a, b] = d.pts;
    switch (d.kind) {
      case "hline":
        return Math.abs(py - ay(a)) < HIT;
      case "trend":
      case "arrow":
        return distSeg(px, py, ax(a), ay(a), ax(b), ay(b)) < HIT;
      case "note": {
        const w = Math.max(40, (d.text ?? "").length * 7 + 16);
        return px >= ax(a) - 4 && px <= ax(a) + w && py >= ay(a) - 26 && py <= ay(a) + 4;
      }
      case "zone":
      case "measure":
      case "fib":
        return px >= Math.min(ax(a), ax(b)) - HIT && px <= Math.max(ax(a), ax(b)) + HIT && py >= Math.min(ay(a), ay(b)) - HIT && py <= Math.max(ay(a), ay(b)) + HIT;
      case "plan": {
        const [e, s, t] = d.pts;
        const top = Math.min(ay(s), ay(t));
        const bot = Math.max(ay(s), ay(t));
        return px >= ax(e) - HIT && px <= ax(s) + HIT && py >= top - HIT && py <= bot + HIT && ay(e) > -1;
      }
    }
  };

  // ---- Pointer --------------------------------------------------------------------------------------------------

  const local = (e: React.PointerEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { px: e.clientX - r.left, py: e.clientY - r.top };
  };

  const finishDraft = (d: Drawing) => {
    commit((prev) => [...prev, d]);
    setDraft(null);
    setSelected(d.id);
    setTool("cursor");
  };

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!bars.length) return;
    const { px, py } = local(e);
    // The price axis (right of the plot) stretches prices; the time axis (under it) stretches time.
    if (!draft && px > plotW && py <= priceH) {
      svgRef.current?.setPointerCapture(e.pointerId);
      drag.current = { mode: "yscale", startY: py, lo, hi };
      return;
    }
    if (!draft && px <= plotW && py > priceH && py <= priceH + TIME_H) {
      svgRef.current?.setPointerCapture(e.pointerId);
      drag.current = { mode: "xscale", startX: px, end: v.end, count: v.count };
      return;
    }
    if (py > priceH || px > plotW) return;
    svgRef.current?.setPointerCapture(e.pointerId);
    const a = anchorAt(px, py);

    if (draft) {
      // Second click of a click-click drawing.
      finishDraft({ ...draft, pts: [draft.pts[0], a] });
      drag.current = null;
      return;
    }

    if (tool !== "cursor") {
      if (tool === "hline") return finishDraft({ id: uid(), kind: "hline", pts: [a], color });
      if (tool === "note") return finishDraft({ id: uid(), kind: "note", pts: [a], color, text: "Note" });
      if (tool === "plan-long" || tool === "plan-short") {
        const side = tool === "plan-long" ? "long" : "short";
        const sign = side === "long" ? 1 : -1;
        const span = (hi - lo) * 0.08;
        const end = ts.date(Math.round(invX(px)) + (settings.weekly ? 6 : 20));
        return finishDraft({
          id: uid(),
          kind: "plan",
          side,
          color: side === "long" ? "green" : "red",
          pts: [a, { t: end, p: Number((a.p - sign * span).toFixed(2)) }, { t: end, p: Number((a.p + sign * span * 2).toFixed(2)) }],
        });
      }
      if (TWO_POINT.includes(tool)) {
        setDraft({ id: uid(), kind: tool as DrawingKind, pts: [a, a], color });
        drag.current = { mode: "draw", startX: px, startY: py };
      }
      return;
    }

    // Cursor: a handle of the selected drawing, else any drawing (topmost first), else pan.
    const sel = drawings.find((d) => d.id === selected);
    if (sel) {
      const hIdx = handlesOf(sel).findIndex((h) => Math.hypot(h.x - px, h.y - py) < HIT + 3);
      if (hIdx >= 0) {
        history.current.push(drawings);
        drag.current = { mode: "handle", id: sel.id, h: hIdx };
        return;
      }
    }
    const hit = [...drawings].reverse().find((d) => hits(d, px, py));
    if (hit) {
      setSelected(hit.id);
      history.current.push(drawings);
      drag.current = { mode: "move", id: hit.id, start: { t: String(invX(px)), p: invY(py) }, orig: hit.pts, moved: false };
      return;
    }
    setSelected(null);
    drag.current = { mode: "pan", startX: px, startY: py, end: v.end, moved: false, lo, hi };
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const { px, py } = local(e);
    setHover(px <= plotW && py <= totalH ? { x: px, y: py } : null);
    const axis = px > plotW && py <= priceH ? "price" : px <= plotW && py > priceH && py <= priceH + TIME_H ? "time" : null;
    if (axis !== overAxis) setOverAxis(axis);
    const g = drag.current;
    if (g?.mode === "yscale") {
      // Down widens the range (smaller candles), up narrows it (taller candles), about the middle.
      const k = Math.exp((py - g.startY) * 0.006);
      const mid = (g.lo + g.hi) / 2;
      const half = Math.max(((g.hi - g.lo) / 2) * k, mid * 0.0005);
      setYRange({ key: rangeKey, lo: mid - half, hi: mid + half });
      return;
    }
    if (g?.mode === "xscale") {
      // Right shows fewer bars (wider), left more (narrower), keeping the right edge where it is.
      const count = Math.max(15, Math.min(Math.max(60, bars.length + 40), g.count * Math.exp(-(px - g.startX) * 0.005)));
      setView({ end: g.end, count });
      return;
    }
    if (draft && (!g || g.mode === "draw")) {
      setDraft({ ...draft, pts: [draft.pts[0], anchorAt(px, py)] });
      return;
    }
    if (!g) return;
    if (g.mode === "pan") {
      const dx = px - g.startX;
      if (Math.abs(dx) > 2) g.moved = true;
      setView({ end: g.end - dx / barW, count: v.count });
      // With a price range of its own the chart pans up and down as well.
      if (manual) {
        const dp = ((py - g.startY) / priceH) * (g.hi - g.lo);
        setYRange({ key: rangeKey, lo: g.lo + dp, hi: g.hi + dp });
      }
      return;
    }
    if (g.mode === "handle") {
      const a = anchorAt(px, py);
      setDrawings((prev) => prev.map((d) => (d.id === g.id ? { ...d, pts: handlesOf(d)[g.h].apply(a, d.pts) } : d)));
      dirty.current = true;
      return;
    }
    if (g.mode === "move") {
      g.moved = true;
      const di = invX(px) - Number(g.start.t);
      const dp = invY(py) - g.start.p;
      setDrawings((prev) =>
        prev.map((d) =>
          d.id === g.id ? { ...d, pts: g.orig.map((p) => ({ t: ts.date(Math.round(ts.index(p.t) + di)), p: Number((p.p + dp).toFixed(2)) })) } : d
        )
      );
      dirty.current = true;
    }
  };

  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    const g = drag.current;
    drag.current = null;
    if (g?.mode === "draw" && draft) {
      const { px, py } = local(e);
      // A drag draws it in one go; a click leaves it waiting for the second click.
      if (Math.hypot(px - g.startX, py - g.startY) > 6) finishDraft({ ...draft, pts: [draft.pts[0], anchorAt(px, py)] });
    }
  };

  // Keys: Escape lets go, Delete removes the selected drawing, Cmd/Ctrl+Z undoes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA");
      if (typing) return;
      if (e.key === "Escape") {
        setDraft(null);
        setTool("cursor");
        setSelected(null);
      } else if ((e.key === "Delete" || e.key === "Backspace") && selected) {
        e.preventDefault();
        commit((prev) => prev.filter((d) => d.id !== selected));
        setSelected(null);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        if (!boxRef.current?.contains(document.activeElement) && document.activeElement !== document.body) return;
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, commit, undo]);

  const selectedDrawing = drawings.find((d) => d.id === selected) ?? null;
  const updateSelected = (patch: Partial<Drawing>) => selected && commit((prev) => prev.map((d) => (d.id === selected ? { ...d, ...patch } : d)));

  // ---- Render -------------------------------------------------------------------------------------------------------

  const hoverIdx = hover ? Math.round(invX(hover.x)) : null;
  const shown = hoverIdx != null && hoverIdx >= 0 && hoverIdx < bars.length ? bars[hoverIdx] : bars[bars.length - 1];
  const shownIdx = hoverIdx != null && hoverIdx >= 0 && hoverIdx < bars.length ? hoverIdx : bars.length - 1;
  const prevClose = shownIdx > 0 ? bars[shownIdx - 1]?.c : undefined;
  const last = bars[bars.length - 1];

  const visible: number[] = [];
  for (let i = Math.max(0, Math.floor(left)); i <= Math.min(bars.length - 1, Math.ceil(v.end)); i++) visible.push(i);
  const maxVol = Math.max(1, ...visible.map((i) => bars[i].v));
  const volH = priceH * 0.16;
  const bodyW = Math.max(1, Math.min(14, barW * 0.68));

  const ticks = niceTicks(lo, hi, narrow ? 5 : 8);
  const timeTicks = useMemo(() => {
    const out: { i: number; label: string }[] = [];
    let prevKey = "";
    const minGap = narrow ? 60 : 80;
    let lastX = -Infinity;
    for (const i of visible) {
      const t = bars[i].t;
      const key = settings.weekly || v.count > 300 ? t.slice(0, 4) + (v.count > 300 ? "" : t.slice(5, 7)) : t.slice(0, 7);
      if (key !== prevKey) {
        const px = x(i);
        if (px - lastX >= minGap && prevKey) {
          const d = new Date(`${t}T12:00:00Z`);
          const label = d.getUTCMonth() === 0 ? String(d.getUTCFullYear()) : d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
          out.push({ i, label });
          lastX = px;
        }
        prevKey = key;
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recomputed from the visible window's own inputs
  }, [bars, left, v.end, v.count, plotW, settings.weekly, narrow]);

  const path = (vals: (number | null)[], yf: (n: number) => number) => {
    let dStr = "";
    let pen = false;
    for (const i of visible) {
      const val = vals[i];
      if (val == null) {
        pen = false;
        continue;
      }
      dStr += `${pen ? "L" : "M"}${x(i).toFixed(1)},${yf(val).toFixed(1)}`;
      pen = true;
    }
    return dStr;
  };

  const rsiY = (r: number) => rsiTop + ((100 - r) / 100) * RSI_H;

  const dateLabel = (t: string) =>
    new Date(`${t}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

  const all = draft ? [...drawings, draft] : drawings;
  const cursor = overAxis === "price" ? "ns-resize" : overAxis === "time" ? "ew-resize" : tool !== "cursor" || draft ? "crosshair" : "default";

  return (
    <div ref={boxRef} className={`relative select-none ${fill ? "flex h-full flex-col" : ""}`}>
      {/* Top bar: timeframe, indicators, zoom, save state */}
      <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs">
        <Seg options={[["D", false], ["W", true]] as const} value={settings.weekly} onChange={(w) => changeSettings({ weekly: w })} label="Timeframe" />
        <span className="mx-1 h-4 w-px bg-line" />
        {MAS.map((m) => (
          <Chip key={m.n} on={settings.mas.includes(m.n)} color={m.color} onClick={() => changeSettings({ mas: settings.mas.includes(m.n) ? settings.mas.filter((n) => n !== m.n) : [...settings.mas, m.n] })}>
            MA {m.n}
          </Chip>
        ))}
        <Chip on={settings.volume} onClick={() => changeSettings({ volume: !settings.volume })}>
          Vol
        </Chip>
        <Chip on={settings.rsi} onClick={() => changeSettings({ rsi: !settings.rsi })}>
          RSI
        </Chip>
        <span className="ml-auto flex items-center gap-1">
          {userId && (
            <span className="mr-2 text-[11px] text-ink-3" aria-live="polite">
              {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Drawings saved" : saveState === "error" ? "Couldn’t save" : ""}
            </span>
          )}
          <IconButton label="Zoom out" onClick={() => zoom(1.25)} d="M5 12h14" />
          <IconButton label="Zoom in" onClick={() => zoom(0.8)} d="M12 5v14M5 12h14" />
          {manual && (
            <button
              type="button"
              onClick={() => setYRange(null)}
              title="Fit prices to the bars again (or double-click the price axis)"
              className="mr-1 rounded-md border border-accent/40 bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent-ink"
            >
              Auto scale
            </button>
          )}
          <IconButton
            label="Reset view"
            onClick={() => {
              setView(null);
              setYRange(null);
            }}
            d="M4 4v6h6M20 20v-6h-6M5 15a7 7 0 0012 3M19 9A7 7 0 007 6"
          />
        </span>
      </div>

      <div className={`flex gap-2 ${narrow ? "flex-col" : ""} ${fill ? "min-h-0 flex-1" : ""}`}>
        {/* Drawing tools */}
        <div className={`flex shrink-0 gap-1 ${narrow ? "-mx-1 overflow-x-auto px-1 pb-1" : "flex-col"}`} role="toolbar" aria-label="Drawing tools">
          {TOOLS.map((t) => (
            <button
              key={t.key}
              type="button"
              title={t.label}
              aria-label={t.label}
              aria-pressed={tool === t.key}
              onClick={() => {
                setDraft(null);
                setTool(t.key);
                if (t.key !== "cursor") setSelected(null);
              }}
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-md border transition-colors ${
                tool === t.key ? "border-accent/60 bg-accent-soft text-accent-ink" : "border-transparent text-ink-3 hover:bg-panel-2 hover:text-ink"
              }`}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d={t.icon} />
              </svg>
            </button>
          ))}
          <span className={narrow ? "mx-1 h-8 w-px shrink-0 bg-line" : "my-1 h-px w-8 bg-line"} />
          <button
            type="button"
            title="Undo"
            aria-label="Undo"
            onClick={undo}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-ink-3 hover:bg-panel-2 hover:text-ink"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true">
              <path d="M9 14L4 9l5-5M4 9h11a5 5 0 010 10h-3" />
            </svg>
          </button>
          {drawings.length > 0 && (
            <button
              type="button"
              title="Remove all drawings"
              aria-label="Remove all drawings"
              onClick={() => {
                if (window.confirm(`Remove all ${drawings.length} drawings on ${ticker}?`)) {
                  commit([]);
                  setSelected(null);
                }
              }}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-ink-3 hover:bg-down-soft hover:text-down"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true">
                <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12M9 7V4h6v3" />
              </svg>
            </button>
          )}
        </div>

        <div ref={areaRef} className={`relative min-w-0 flex-1 ${fill ? "min-h-0" : ""}`}>
          {!data && !failed && <div className="animate-pulse rounded-lg bg-panel-2" style={{ height: priceH + TIME_H }} />}
          {(failed || (data && bars.length === 0)) && (
            <div className="grid place-items-center rounded-lg border border-dashed border-line-strong text-center" style={{ height: priceH + TIME_H }}>
              <div className="max-w-xs px-4">
                <p className="text-sm font-medium text-ink">Chart data isn&apos;t available for ${ticker} right now</p>
                <p className="mt-1 text-xs text-ink-3">We don&apos;t draw sample prices. Try again in a few minutes.</p>
              </div>
            </div>
          )}
          {data && bars.length > 0 && width > 0 && (
            <>
              {/* Legend: always one line (Ben, 2026-11-18: wrapping to a second line jolted the chart's height); what
                  doesn't fit is cut off at the right, the moving averages first. */}
              <div className="mb-1 flex h-4 flex-nowrap items-center gap-x-3 overflow-hidden whitespace-nowrap font-mono text-[11px] leading-4 tabular-nums text-ink-2 [&>*]:shrink-0">
                <span className="text-ink-3">{dateLabel(shown.t)}</span>
                {!narrow && (
                  <>
                    <span>O {priceLabel(shown.o)}</span>
                    <span>H {priceLabel(shown.h)}</span>
                    <span>L {priceLabel(shown.l)}</span>
                  </>
                )}
                <span className={shown.c >= (prevClose ?? shown.o) ? "text-up" : "text-down"}>
                  C {priceLabel(shown.c)}
                  {prevClose ? ` (${shown.c >= prevClose ? "+" : ""}${(((shown.c - prevClose) / prevClose) * 100).toFixed(2)}%)` : ""}
                </span>
                {!narrow && settings.volume && shown.v > 0 && <span className="text-ink-3">Vol {volumeLabel(shown.v)}</span>}
                {!narrow && maLines.map((m) => {
                  const val = m.values[shownIdx];
                  return val != null ? (
                    <span key={m.n} style={{ color: m.color }}>
                      MA{m.n} {priceLabel(val)}
                    </span>
                  ) : null;
                })}
              </div>

              <svg
                ref={svgRef}
                width={chartW}
                height={totalH}
                className="block"
                style={{ cursor, touchAction: tool === "cursor" && !draft ? "pan-y" : "none", width: "100%" }}
                viewBox={`0 0 ${chartW} ${totalH}`}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerLeave={() => {
                  setHover(null);
                  setOverAxis(null);
                }}
                onDoubleClick={(e) => {
                  const r = svgRef.current!.getBoundingClientRect();
                  const px = e.clientX - r.left;
                  const py = e.clientY - r.top;
                  if (px > plotW && py <= priceH) setYRange(null);
                  else if (py > priceH && py <= priceH + TIME_H) setView(null);
                }}
                role="img"
                aria-label={`${ticker} ${settings.weekly ? "weekly" : "daily"} candle chart`}
              >
                <defs>
                  <clipPath id={`plot-${ticker}`}>
                    <rect x={0} y={0} width={plotW} height={priceH} />
                  </clipPath>
                  <marker id={`arrow-${ticker}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                    <path d="M0,0 L10,5 L0,10 z" fill="context-stroke" />
                  </marker>
                </defs>

                {/* Grid */}
                {ticks.map((t) => (
                  <line key={t} x1={0} x2={plotW} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeWidth={1} />
                ))}
                {timeTicks.map((t) => (
                  <line key={t.i} x1={x(t.i)} x2={x(t.i)} y1={0} y2={priceH} stroke="var(--color-line)" strokeWidth={1} opacity={0.6} />
                ))}

                <g clipPath={`url(#plot-${ticker})`}>
                  {/* Volume */}
                  {settings.volume &&
                    visible.map((i) => {
                      const b = bars[i];
                      const h = (b.v / maxVol) * volH;
                      return (
                        <rect
                          key={`v${i}`}
                          x={x(i) - bodyW / 2}
                          y={priceH - h}
                          width={bodyW}
                          height={h}
                          fill={b.c >= b.o ? "var(--color-up)" : "var(--color-down)"}
                          opacity={0.22}
                        />
                      );
                    })}

                  {/* Candles */}
                  {visible.map((i) => {
                    const b = bars[i];
                    const up = b.c >= b.o;
                    const col = up ? "var(--color-up)" : "var(--color-down)";
                    const top = y(Math.max(b.o, b.c));
                    const bh = Math.max(1, Math.abs(y(b.o) - y(b.c)));
                    return (
                      <g key={i} opacity={b.live ? 0.85 : 1}>
                        <line x1={x(i)} x2={x(i)} y1={y(b.h)} y2={y(b.l)} stroke={col} strokeWidth={1} />
                        <rect x={x(i) - bodyW / 2} y={top} width={bodyW} height={bh} fill={up ? col : col} rx={bodyW > 4 ? 1 : 0} />
                      </g>
                    );
                  })}

                  {/* Moving averages */}
                  {maLines.map((m) => (
                    <path key={m.n} d={path(m.values, y)} fill="none" stroke={m.color} strokeWidth={1.4} opacity={0.9} />
                  ))}

                  {/* The idea's own levels */}
                  {levels && <HouseLines levels={levels} plotW={plotW} y={y} x0={levels.from ? Math.max(0, x(ts.index(levels.from))) : 0} />}

                  {/* Markup */}
                  {all.map((d) => (
                    <DrawingShape
                      key={d.id}
                      d={d}
                      ax={ax}
                      ay={ay}
                      y={y}
                      plotW={plotW}
                      ts={ts}
                      closes={closes}
                      weekly={settings.weekly}
                      selected={d.id === selected}
                      markerId={`arrow-${ticker}`}
                    />
                  ))}
                </g>

                {/* Handles of the selected drawing */}
                {selectedDrawing &&
                  handlesOf(selectedDrawing).map((h, i) => (
                    <circle key={i} cx={h.x} cy={h.y} r={5} fill="var(--color-bg)" stroke={colorOf(selectedDrawing.color)} strokeWidth={2} style={{ cursor: "grab" }} />
                  ))}

                {/* Price axis */}
                <rect x={plotW} y={0} width={AXIS_W} height={priceH} fill="var(--color-panel)" />
                <line x1={plotW} x2={plotW} y1={0} y2={priceH} stroke="var(--color-line-strong)" />
                {ticks.map((t) => (
                  <text key={t} x={plotW + 8} y={y(t) + 4} className="fill-ink-3 font-mono text-[10.5px] tabular-nums">
                    {priceLabel(t)}
                  </text>
                ))}
                {drawings
                  .filter((d) => d.kind === "hline")
                  .map((d) => (
                    <AxisTag key={d.id} x={plotW} y={ay(d.pts[0])} fill={colorOf(d.color)} text={priceLabel(d.pts[0].p)} />
                  ))}
                {last && <AxisTag x={plotW} y={y(last.c)} fill={last.c >= (bars[bars.length - 2]?.c ?? last.o) ? "var(--color-up)" : "var(--color-down)"} text={priceLabel(last.c)} />}

                {/* Time axis */}
                <line x1={0} x2={plotW} y1={priceH} y2={priceH} stroke="var(--color-line-strong)" />
                {timeTicks.map((t) => (
                  <text key={t.i} x={x(t.i)} y={priceH + 15} textAnchor="middle" className="fill-ink-3 text-[10.5px]">
                    {t.label}
                  </text>
                ))}

                {/* RSI */}
                {settings.rsi && (
                  <g>
                    <rect x={0} y={rsiTop} width={plotW} height={RSI_H} fill="none" stroke="var(--color-line)" />
                    <rect x={0} y={rsiY(70)} width={plotW} height={rsiY(30) - rsiY(70)} fill="var(--color-glyph-9)" opacity={0.05} />
                    {[30, 70].map((l) => (
                      <g key={l}>
                        <line x1={0} x2={plotW} y1={rsiY(l)} y2={rsiY(l)} stroke="var(--color-line-strong)" strokeDasharray="3 3" />
                        <text x={plotW + 8} y={rsiY(l) + 4} className="fill-ink-3 font-mono text-[10.5px]">
                          {l}
                        </text>
                      </g>
                    ))}
                    <path d={path(rsiValues, rsiY)} fill="none" stroke="var(--color-glyph-9)" strokeWidth={1.4} />
                    <text x={6} y={rsiTop + 13} className="fill-ink-3 font-mono text-[10.5px]">
                      RSI 14 {rsiValues[shownIdx] != null ? rsiValues[shownIdx]!.toFixed(1) : ""}
                    </text>
                  </g>
                )}

                {/* Crosshair */}
                {hover && hover.y <= priceH && (
                  <g pointerEvents="none">
                    <line x1={0} x2={plotW} y1={hover.y} y2={hover.y} stroke="var(--color-ink-3)" strokeDasharray="3 3" strokeWidth={0.8} />
                    <line x1={x(Math.round(invX(hover.x)))} x2={x(Math.round(invX(hover.x)))} y1={0} y2={totalH} stroke="var(--color-ink-3)" strokeDasharray="3 3" strokeWidth={0.8} />
                    <AxisTag x={plotW} y={hover.y} fill="var(--color-panel-3)" text={priceLabel(invY(hover.y))} ink="var(--color-ink)" />
                  </g>
                )}
              </svg>

              {data.stale && <p className="mt-1 text-[11px] text-ink-3">Showing the last saved prices; the feed didn’t answer just now.</p>}
            </>
          )}

          {/* The selected drawing's options */}
          {selectedDrawing && (
            <div className={`absolute z-20 flex ${narrow ? "left-0 right-0 top-6 flex-wrap" : "right-[72px] top-7"} items-center gap-1.5 rounded-lg border border-line-strong bg-panel-2 p-1.5 shadow-[var(--shadow-pop)]`}>
              {selectedDrawing.kind !== "plan" &&
                Object.keys(COLORS).map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Color ${c}`}
                    onClick={() => {
                      setColor(c);
                      updateSelected({ color: c });
                    }}
                    className={`h-5 w-5 rounded-full border-2 ${selectedDrawing.color === c ? "border-ink" : "border-transparent"}`}
                    style={{ background: colorOf(c) }}
                  />
                ))}
              {selectedDrawing.kind === "note" && (
                <input
                  aria-label="Note text"
                  defaultValue={selectedDrawing.text}
                  key={selectedDrawing.id}
                  maxLength={80}
                  autoFocus
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => {
                    const text = e.target.value;
                    setDrawings((prev) => prev.map((d) => (d.id === selectedDrawing.id ? { ...d, text } : d)));
                    dirty.current = true;
                  }}
                  className="h-7 w-40 rounded-md border border-line-strong bg-panel px-2 text-xs text-ink outline-none focus:border-accent"
                />
              )}
              {selectedDrawing.kind === "plan" && (
                <button
                  type="button"
                  onClick={() => updateSelected({ side: selectedDrawing.side === "long" ? "short" : "long", color: selectedDrawing.side === "long" ? "red" : "green" })}
                  className="h-7 rounded-md px-2 text-xs text-ink-2 hover:bg-panel-3 hover:text-ink"
                >
                  Flip to {selectedDrawing.side === "long" ? "short" : "long"}
                </button>
              )}
              <button
                type="button"
                aria-label="Delete drawing"
                title="Delete (Del)"
                onClick={() => {
                  commit((prev) => prev.filter((d) => d.id !== selectedDrawing.id));
                  setSelected(null);
                }}
                className="grid h-7 w-7 place-items-center rounded-md text-ink-3 hover:bg-down-soft hover:text-down"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
          )}

          {draft && <p className="mt-1 text-[11px] text-accent-ink">Click the second point (Esc to cancel).</p>}
          {tool !== "cursor" && !draft && (
            <p className="mt-1 text-[11px] text-ink-3">
              {tool === "hline" || tool === "note" ? "Click where it goes." : tool.startsWith("plan") ? "Click your entry; then drag the stop, target and end." : "Drag, or click two points."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Pieces ---------------------------------------------------------------------------------------------------------

function DrawingShape({
  d,
  ax,
  ay,
  y,
  plotW,
  ts,
  closes,
  weekly,
  selected,
  markerId,
}: {
  d: Drawing;
  ax: (a: Anchor) => number;
  ay: (a: Anchor) => number;
  y: (p: number) => number;
  plotW: number;
  ts: ReturnType<typeof timeScale>;
  closes: number[];
  weekly: boolean;
  selected: boolean;
  markerId: string;
}) {
  const c = colorOf(d.color);
  const sw = selected ? 2.2 : 1.5;
  const [a, b] = d.pts;
  switch (d.kind) {
    case "hline":
      return <line x1={0} x2={plotW} y1={ay(a)} y2={ay(a)} stroke={c} strokeWidth={sw} />;
    case "trend":
      return <line x1={ax(a)} y1={ay(a)} x2={ax(b)} y2={ay(b)} stroke={c} strokeWidth={sw} strokeLinecap="round" />;
    case "arrow":
      return <line x1={ax(a)} y1={ay(a)} x2={ax(b)} y2={ay(b)} stroke={c} strokeWidth={sw + 0.4} markerEnd={`url(#${markerId})`} strokeLinecap="round" />;
    case "zone": {
      const x0 = Math.min(ax(a), ax(b));
      const y0 = Math.min(ay(a), ay(b));
      return (
        <rect x={x0} y={y0} width={Math.abs(ax(b) - ax(a))} height={Math.abs(ay(b) - ay(a))} fill={c} fillOpacity={0.12} stroke={c} strokeOpacity={selected ? 0.9 : 0.5} strokeWidth={1} />
      );
    }
    case "note": {
      const text = d.text || "Note";
      const w = Math.max(40, text.length * 7 + 16);
      return (
        <g>
          <circle cx={ax(a)} cy={ay(a)} r={3} fill={c} />
          <rect x={ax(a) - 4} y={ay(a) - 26} width={w} height={20} rx={5} fill="var(--color-panel-2)" stroke={c} strokeWidth={selected ? 1.6 : 1} />
          <text x={ax(a) + 4} y={ay(a) - 12} className="fill-ink text-[12px]">
            {text}
          </text>
        </g>
      );
    }
    case "measure": {
      const dp = b.p - a.p;
      const pct = (dp / a.p) * 100;
      const nBars = Math.round(Math.abs(ts.index(b.t) - ts.index(a.t)));
      const up = dp >= 0;
      const col = up ? "var(--color-up)" : "var(--color-down)";
      const x0 = Math.min(ax(a), ax(b));
      const y0 = Math.min(ay(a), ay(b));
      const label = `${up ? "+" : "−"}${priceLabel(Math.abs(dp))} (${up ? "+" : "−"}${Math.abs(pct).toFixed(2)}%) · ${nBars} ${weekly ? "wk" : "bars"}`;
      return (
        <g>
          <rect x={x0} y={y0} width={Math.abs(ax(b) - ax(a))} height={Math.abs(ay(b) - ay(a))} fill={col} fillOpacity={0.12} stroke={col} strokeOpacity={0.6} />
          <line x1={ax(a)} y1={ay(a)} x2={ax(b)} y2={ay(b)} stroke={col} strokeDasharray="4 3" />
          <Label x={(ax(a) + ax(b)) / 2} y={up ? y0 - 8 : y0 + Math.abs(ay(b) - ay(a)) + 20} text={label} fill={col} center />
        </g>
      );
    }
    case "fib": {
      const x0 = Math.min(ax(a), ax(b));
      return (
        <g>
          <line x1={ax(a)} y1={ay(a)} x2={ax(b)} y2={ay(b)} stroke={c} strokeDasharray="3 3" strokeOpacity={0.6} />
          {FIB_LEVELS.map((l) => {
            const p = b.p - (b.p - a.p) * l;
            return (
              <g key={l}>
                <line x1={x0} x2={plotW} y1={y(p)} y2={y(p)} stroke={c} strokeOpacity={l === 0 || l === 1 ? 0.9 : 0.55} strokeWidth={selected ? 1.4 : 1} />
                <text x={x0 + 4} y={y(p) - 3} className="font-mono text-[10px]" fill={c}>
                  {l} ({priceLabel(p)})
                </text>
              </g>
            );
          })}
        </g>
      );
    }
    case "plan": {
      const [e, s, t] = d.pts;
      const side = d.side ?? "long";
      const x0 = ax(e);
      const x1 = Math.max(x0 + 8, ax(s));
      const days = Math.max(1, (Date.parse(s.t) - Date.parse(e.t)) / 86_400_000);
      const n = planNumbers(side, e.p, s.p, t.p, days, closes);
      const fmtPct = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}%`;
      const o = n.option;
      const optPct = (v: number) => (o && o.now > 0 ? fmtPct(((v - o.now) / o.now) * 100) : "");
      const wrongWay = side === "long" ? !(t.p > e.p && s.p < e.p) : !(t.p < e.p && s.p > e.p);
      // Labels sit right of the plan, or left of it when the plan reaches the chart's right side.
      const flip = x1 + 250 > plotW;
      const lx = flip ? x0 - 6 : x1 + 6;
      const below = (side === "long" ? Math.max(ay(e), ay(s)) : Math.max(ay(e), ay(t))) + 24;
      return (
        <g>
          <rect x={x0} y={Math.min(ay(e), ay(t))} width={x1 - x0} height={Math.abs(ay(t) - ay(e))} fill="var(--color-up)" fillOpacity={0.14} />
          <rect x={x0} y={Math.min(ay(e), ay(s))} width={x1 - x0} height={Math.abs(ay(s) - ay(e))} fill="var(--color-down)" fillOpacity={0.14} />
          <line x1={x0} x2={x1} y1={ay(e)} y2={ay(e)} stroke="var(--color-ink-2)" strokeWidth={selected ? 1.6 : 1.2} />
          <line x1={x0} x2={x1} y1={ay(t)} y2={ay(t)} stroke="var(--color-up)" strokeWidth={1} />
          <line x1={x0} x2={x1} y1={ay(s)} y2={ay(s)} stroke="var(--color-down)" strokeWidth={1} />
          <Label x={lx} end={flip} y={ay(t) + 4} text={`Target ${priceLabel(t.p)} ${fmtPct(n.targetPct)}`} fill="var(--color-up)" />
          <Label x={lx} end={flip} y={ay(e) + 4} text={`${side === "long" ? "Long" : "Short"} ${priceLabel(e.p)}${n.rr != null && !wrongWay ? ` · R:R ${n.rr.toFixed(1)}` : ""}`} fill="var(--color-ink)" />
          <Label x={lx} end={flip} y={ay(s) + 4} text={`Stop ${priceLabel(s.p)} ${fmtPct(n.stopPct)}`} fill="var(--color-down)" />
          {o && !wrongWay && (
            <>
              <Label x={lx} end={flip} y={below} text={`Est. ${priceLabel(o.strike)} ${o.type}, ${o.expiryDays} days: $${o.now.toFixed(2)}`} fill="var(--color-ink-2)" small />
              <Label x={lx} end={flip} y={below + 20} text={`Target $${o.atTarget.toFixed(2)} (${optPct(o.atTarget)}) · Stop $${o.atStop.toFixed(2)} (${optPct(o.atStop)})`} fill="var(--color-ink-2)" small />
            </>
          )}
          {wrongWay && <Label x={lx} end={flip} y={ay(e) + 22} text="Target and stop are on the wrong sides" fill="var(--color-warn)" small />}
        </g>
      );
    }
  }
}

function Label({ x, y, text, fill, center, small, end }: { x: number; y: number; text: string; fill: string; center?: boolean; small?: boolean; end?: boolean }) {
  const w = text.length * (small ? 6 : 6.5) + 10;
  const x0 = center ? x - w / 2 : end ? x - w : x;
  return (
    <g pointerEvents="none">
      <rect x={x0} y={y - 13} width={w} height={18} rx={4} fill="var(--color-bg)" fillOpacity={0.88} stroke={fill} strokeOpacity={0.35} />
      <text x={x0 + 5} y={y} className={`font-mono ${small ? "text-[10px]" : "text-[10.5px]"}`} fill={fill}>
        {text}
      </text>
    </g>
  );
}

function AxisTag({ x, y, fill, text, ink }: { x: number; y: number; fill: string; text: string; ink?: string }) {
  return (
    <g pointerEvents="none">
      <rect x={x + 1} y={y - 9} width={AXIS_W - 2} height={18} rx={3} fill={fill} />
      <text x={x + 8} y={y + 4} className="font-mono text-[10.5px] tabular-nums" fill={ink ?? "var(--color-on-accent)"}>
        {text}
      </text>
    </g>
  );
}

function HouseLines({ levels, plotW, y, x0 }: { levels: HouseLevels; plotW: number; y: (p: number) => number; x0: number }) {
  const rows = [
    { p: levels.entry, label: "Idea entry", color: "var(--color-ink-2)" },
    levels.target != null ? { p: levels.target, label: "Idea target", color: "var(--color-up)" } : null,
    levels.stop != null ? { p: levels.stop, label: "Idea stop", color: "var(--color-down)" } : null,
  ].filter(Boolean) as { p: number; label: string; color: string }[];
  return (
    <g pointerEvents="none">
      {rows.map((r) => (
        <g key={r.label}>
          <line x1={x0} x2={plotW} y1={y(r.p)} y2={y(r.p)} stroke={r.color} strokeDasharray="6 4" strokeWidth={1.2} />
          <text x={plotW - 6} y={y(r.p) - 4} textAnchor="end" className="font-mono text-[10.5px]" fill={r.color}>
            {r.label} {priceLabel(r.p)}
          </text>
        </g>
      ))}
    </g>
  );
}

function Chip({ on, color, onClick, children }: { on: boolean; color?: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`h-7 rounded-md border px-2 font-medium transition-colors ${on ? "border-line-strong bg-panel-2 text-ink" : "border-transparent text-ink-3 hover:text-ink"}`}
    >
      {color && <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: on ? color : "var(--color-line-strong)" }} />}
      {children}
    </button>
  );
}

function Seg<T>({ options, value, onChange, label }: { options: readonly (readonly [string, T])[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex rounded-md border border-line-strong p-0.5">
      {options.map(([text, val]) => (
        <button
          key={text}
          type="button"
          aria-pressed={value === val}
          onClick={() => onChange(val)}
          className={`h-6 min-w-7 rounded px-2 font-semibold ${value === val ? "bg-accent-soft text-accent-ink" : "text-ink-3 hover:text-ink"}`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

function IconButton({ label, onClick, d }: { label: string; onClick: () => void; d: string }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className="grid h-7 w-7 place-items-center rounded-md text-ink-3 hover:bg-panel-2 hover:text-ink">
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={d} />
      </svg>
    </button>
  );
}
