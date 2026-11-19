"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Anchor, Candle, Drawing, DrawingKind, HouseLevels } from "@/lib/chart/types";
import { FIB_LEVELS, niceTicks, priceLabel, rsi, sma, timeScale, toMonthly, toWeekly, toYearly, volumeLabel } from "@/lib/chart/math";
import { planNumbers } from "@/lib/chart/plan";
import { withLive, type Span, type Tick } from "@/lib/chart/live";
import { TIMEFRAMES, type Timeframe } from "@/lib/chart/timeframes";
import { addDays, isSession } from "@/lib/marketCalendar";
import { barStart, minuteOf } from "@/lib/chart/sessions";
import { daySlots, fillDated, fillIntraday, onReal } from "@/lib/chart/slots";
export type { Timeframe };

// HighStrike Chart (Ben, 2026-11-17: "Our own custom charts, with our UI, and deep markup ability"): 1m to weekly
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

// Timeframes (Ben, 2026-11-18: "More timeframes. Down to 1m"): intraday bars from /api/candles?tf=…, regular hours;
// daily from /api/candles (back to 2016 on Alpaca's free data); weekly, monthly and yearly rolled from daily here.
const MINUTES: Partial<Record<Timeframe, number>> = { "1m": 1, "5m": 5, "15m": 15, "30m": 30, "1h": 60, "4h": 240 };
type Settings = { tf: Timeframe; mas: number[]; volume: boolean; rsi: boolean };
const DEFAULT_SETTINGS: Settings = { tf: "D", mas: [21, 50, 200], volume: true, rsi: true };
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
  /** A working limit price to mark (the desk's ticket): a light line labelled LIMIT. */
  limitLine?: { price: number; side: "buy" | "sell" } | null;
  /** An option contract's expiry date ("2026-12-18"): a dashed vertical line at 4:00 PM New York time that day. */
  expiry?: string | null;
  /** An option's strike on its stock's chart: a line at that price, labelled (Ben, 2026-11-19). */
  strikeLine?: { price: number; type: "call" | "put" } | null;
  /** A timeframe to follow as it changes (two charts kept on the same one); the chart's own picks go out through onTimeframe. */
  timeframe?: Timeframe | null;
  /** Working (unfilled) limit orders on this symbol: a line at each price, tagged +10 (buy) or −10 (sell). */
  workingOrders?: { id: string; price: number; side: "buy" | "sell"; qty: number }[];
  /** For an option contract: the stock's price now, to say how far the strike is in or out of the money. */
  underlyingPrice?: number | null;
  /** Each live price as it arrives (the desk's price bar follows it). */
  onLive?: (tick: { price: number; open: number | null; high: number | null; low: number | null; prevClose: number | null }) => void;
  /** A timeframe to open on (the desk's URL), over the one remembered in this browser. */
  initialTimeframe?: Timeframe | null;
  /** Each timeframe change (the desk keeps it in its URL). */
  onTimeframe?: (tf: Timeframe) => void;
};

export default function HighStrikeChart({ ticker, userId, levels, height, fill = false, onLive, initialTimeframe, onTimeframe, limitLine, expiry, underlyingPrice, workingOrders, strikeLine, timeframe }: Props) {
  // Daily candles, kept with their ticker so another ticker's never show (or a failure sticks) while a new one loads.
  const [daily, setDaily] = useState<{ ticker: string; candles: Candle[] | null; source?: string; stale?: boolean; waiting?: boolean; failed?: boolean } | null>(null);
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
  // A click on the chart measures (Ben, 2026-11-18: "This measurement tool is great, default to this when a user clicks"):
  // first click starts it, it follows the pointer, the second click pins it, a third clears it. Not saved.
  const [quick, setQuick] = useState<{ d: Drawing; done: boolean } | null>(null);
  // The drawing tools, in a menu in the top bar (Ben, 2026-11-18: "Hide the other tools under a discreet tools dropdown").
  const [toolsOpen, setToolsOpen] = useState(false);
  const toolsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!toolsOpen) return;
    const away = (e: MouseEvent) => {
      if (!toolsRef.current?.contains(e.target as Node)) setToolsOpen(false);
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [toolsOpen]);
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
      const saved = raw ? (JSON.parse(raw) as Partial<Settings> & { weekly?: boolean }) : {};
      const remembered = saved.tf && TIMEFRAMES.includes(saved.tf) ? saved.tf : saved.weekly ? "W" : "D";
      const tf = initialTimeframe && TIMEFRAMES.includes(initialTimeframe) ? initialTimeframe : remembered;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reading the browser's saved settings once, on mount
      setSettings({ ...DEFAULT_SETTINGS, ...saved, tf });
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on mount
  }, []);
  // Follow the timeframe it's given when that changes (the other chart of a split view was switched).
  const [seenTf, setSeenTf] = useState(timeframe);
  if (timeframe !== seenTf) {
    setSeenTf(timeframe);
    if (timeframe && TIMEFRAMES.includes(timeframe) && timeframe !== settings.tf) {
      setSettings((prev) => ({ ...prev, tf: timeframe }));
      setView(null);
    }
  }
  const onTimeframeRef = useRef(onTimeframe);
  useEffect(() => {
    onTimeframeRef.current = onTimeframe;
  }, [onTimeframe]);
  useEffect(() => {
    onTimeframeRef.current?.(settings.tf);
  }, [settings.tf]);
  const changeSettings = (s: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...s };
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
    if (s.tf !== undefined) setView(null);
  };

  // Candles. The free data plan allows 5 requests a minute: when it's used up (`busy`) or the answer doesn't come, ask
  // again every 15 seconds for a few minutes, saying so, rather than giving up.
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let tries = 0;
    const load = () =>
      fetch(`/api/candles?symbol=${encodeURIComponent(ticker)}`)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((d: { candles?: Candle[]; source?: string; stale?: boolean; busy?: boolean }) => {
          if (!alive) return;
          if (!d.candles?.length && d.busy && tries++ < 16) {
            setDaily({ ticker, candles: null, waiting: true });
            timer = setTimeout(load, 15_000);
            return;
          }
          setDaily({ ticker, candles: d.candles ?? [], source: d.source, stale: d.stale });
        })
        .catch(() => {
          if (!alive) return;
          if (tries++ < 4) {
            setDaily({ ticker, candles: null, waiting: true });
            timer = setTimeout(load, 15_000);
          } else setDaily({ ticker, candles: null, failed: true });
        });
    load();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [ticker]);
  // Another symbol (the stock, or one of its contracts) starts from its own latest bars.
  const [shownTicker, setShownTicker] = useState(ticker);
  if (shownTicker !== ticker) {
    setShownTicker(ticker);
    setView(null);
    setQuick(null);
  }
  const dailyNow = daily?.ticker === ticker ? daily : null;
  // What the chart is of, in words: the ticker, or "AAPL Dec 18 $350 call" for an option contract.
  const name = contractName(ticker) ?? ticker;
  const contract = contractParts(ticker);
  const data = useMemo(() => (dailyNow?.candles ? { candles: dailyNow.candles, source: dailyNow.source ?? "", stale: Boolean(dailyNow.stale) } : null), [dailyNow]);
  const failed = Boolean(dailyNow?.failed);

  // Intraday bars for the chosen timeframe, kept per ticker and timeframe, retried the same way.
  const [intra, setIntra] = useState<{ key: string; candles: Candle[] | null; failed: boolean; waiting?: boolean } | null>(null);
  const intraKey = MINUTES[settings.tf] ? `${ticker}:${settings.tf}` : null;
  useEffect(() => {
    if (!intraKey) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let tries = 0;
    // Split at the last colon: an option contract's symbol has one of its own ("O:AAPL261218C00250000:1h").
    const cut = intraKey.lastIndexOf(":");
    const sym = intraKey.slice(0, cut);
    const tf = intraKey.slice(cut + 1);
    const load = () =>
      fetch(`/api/candles?symbol=${encodeURIComponent(sym)}&tf=${tf}`)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((d: { candles?: Candle[]; busy?: boolean }) => {
          if (!alive) return;
          if (!d.candles?.length && d.busy && tries++ < 16) {
            setIntra({ key: intraKey, candles: null, failed: false, waiting: true });
            timer = setTimeout(load, 15_000);
            return;
          }
          setIntra({ key: intraKey, candles: d.candles ?? [], failed: false });
        })
        .catch(() => {
          if (!alive) return;
          if (tries++ < 4) {
            setIntra({ key: intraKey, candles: null, failed: false, waiting: true });
            timer = setTimeout(load, 15_000);
          } else setIntra({ key: intraKey, candles: null, failed: true });
        });
    load();
    // While prices move, the bars are asked for again every 30 seconds and when the page comes back into view, so the
    // always-on worker's minutes fill in whatever the live ticks missed (Ben, 2026-11-19: a hole after the tab was away).
    const again = () => {
      if (!alive || document.visibilityState !== "visible" || !liveOnRef.current) return;
      fetch(`/api/candles?symbol=${encodeURIComponent(sym)}&tf=${tf}&fresh=${Math.floor(Date.now() / 15_000)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { candles?: Candle[] } | null) => {
          if (alive && d?.candles?.length) setIntra({ key: intraKey, candles: d.candles, failed: false });
        })
        .catch(() => {});
    };
    const every = setInterval(again, 30_000);
    const onShow = () => document.visibilityState === "visible" && again();
    document.addEventListener("visibilitychange", onShow);
    return () => {
      alive = false;
      clearTimeout(timer);
      clearInterval(every);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, [intraKey]);

  // Live prices while the market's open (src/lib/chart/live.ts): every 3 seconds while the page is in view; every
  // 30 seconds when the market's shut, to notice the open. Kept per ticker, the last 3,000.
  const [liveFeed, setLiveFeed] = useState<{ ticker: string; list: Tick[] } | null>(null);
  const [liveOn, setLiveOn] = useState(false);
  const liveOnRef = useRef(false);
  useEffect(() => {
    liveOnRef.current = liveOn;
  }, [liveOn]);
  const onLiveRef = useRef(onLive);
  useEffect(() => {
    onLiveRef.current = onLive;
  }, [onLive]);
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      let next = 30_000;
      if (document.visibilityState === "visible") {
        try {
          const r = await fetch(`/api/live?symbol=${encodeURIComponent(ticker)}`, { cache: "no-store" });
          const j = r.ok ? ((await r.json()) as { price: number | null; open?: number | null; high?: number | null; low?: number | null; prevClose?: number | null; at?: number; marketOpen?: boolean }) : null;
          if (alive && j?.price && j.marketOpen) {
            const tick: Tick = { price: j.price, at: Date.now(), open: j.open ?? null, high: j.high ?? null, low: j.low ?? null };
            setLiveFeed((cur) => ({ ticker, list: [...(cur?.ticker === ticker ? cur.list : []), tick].slice(-3000) }));
            setLiveOn(true);
            onLiveRef.current?.({ price: j.price, open: j.open ?? null, high: j.high ?? null, low: j.low ?? null, prevClose: j.prevClose ?? null });
            next = 1000;
          } else if (alive) setLiveOn(false);
        } catch {}
      } else next = 2000;
      if (alive) timer = setTimeout(poll, next);
    };
    poll();
    return () => {
      alive = false;
      clearTimeout(timer);
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

  const weekly = settings.tf === "W";
  // Dated spans past a week: months and years (Ben, 2026-11-18: "Add month… And add year").
  const span: Span = settings.tf === "W" || settings.tf === "M" || settings.tf === "Y" ? settings.tf : "D";
  const long = span === "M" || span === "Y";
  const minutes = MINUTES[settings.tf] ?? null;
  const intraNow = intraKey && intra?.key === intraKey ? intra : null;
  const liveTicks = liveFeed?.ticker === ticker ? liveFeed.list : null;
  const bars = useMemo(() => {
    const roll = span === "W" ? toWeekly : span === "M" ? toMonthly : span === "Y" ? toYearly : (b: Candle[]) => b;
    const base = minutes ? (intraNow?.candles ?? []) : data ? roll(data.candles) : [];
    const withTicks = liveTicks ? withLive(base, liveTicks, minutes, span) : base;
    // Every day the same width, traded in or not (src/lib/chart/slots.ts).
    return minutes ? fillIntraday(withTicks, minutes) : fillDated(withTicks, span);
  }, [minutes, intraNow, data, span, liveTicks]);
  const ts = useMemo(() => timeScale(bars, minutes ?? (span === "M" ? 30.44 * 1440 : span === "Y" ? 365.25 * 1440 : weekly)), [bars, minutes, span, weekly]);
  // Loaded, failed: for the timeframe on screen.
  const loaded = minutes ? Boolean(intraNow?.candles) : Boolean(data);
  const waiting = minutes ? Boolean(intraNow?.waiting) : Boolean(dailyNow?.waiting);
  const failedNow = minutes ? Boolean(intraNow?.failed) : failed;
  const maLines = useMemo(() => MAS.filter((m) => settings.mas.includes(m.n)).map((m) => ({ ...m, values: onReal(bars, (real) => sma(real, m.n)) })), [bars, settings.mas]);
  const rsiValues = useMemo(() => (settings.rsi ? onReal(bars, (real) => rsi(real)) : []), [bars, settings.rsi]);
  const closes = useMemo(() => (data?.candles ?? []).map((c) => c.c), [data]);

  const narrow = width > 0 && width < 640;
  const drawn = Boolean(loaded && bars.length > 0 && width > 0);
  // Filling: the plot area less the legend (20px), the time axis and the RSI pane when it's on.
  const filled = fill && areaH > 0 ? Math.max(180, areaH - 20 - TIME_H - (settings.rsi ? RSI_H + GAP : 0)) : null;
  const priceH = filled ?? height ?? (narrow ? 300 : 420);
  // The chart takes the box's whole width; the drawing tools are in the top bar's menu.
  const chartW = Math.max(160, width);
  const plotW = chartW - AXIS_W;
  const rsiTop = priceH + TIME_H + GAP;
  const totalH = priceH + TIME_H + (settings.rsi ? RSI_H + GAP : 0);

  // The expiry's bar position (Ben, 2026-11-18: "a vertical line at the expiration date/time"): past the last bar it's
  // counted in trading time, weekdays (and 4:00 AM to 8:00 PM for intraday bars), the way the bars themselves run.
  // The time ahead of the last bar, to scale (Ben, 2026-11-18: "Make the expiration line occur on the timeline where it
  // actually will happen in time"): counted in real trading days (weekends and market holidays skipped) and, for
  // intraday bars, in as many bars a day as this chart really has (a contract trades 9:30 to 4:00 only: seven 1h bars a
  // day, not the stock's sixteen).
  const ahead = useMemo(() => {
    if (!bars.length || (!minutes && span !== "D")) return null;
    const n = bars.length;
    const lastT = bars[n - 1].t;
    const lastDate = lastT.slice(0, 10);
    // Each trading day's slots, the same as the bars' (src/lib/chart/slots.ts); 4:00 PM is the end of the regular ones.
    const slots = minutes ? daySlots(minutes) : [];
    const spd = slots.length;
    const regEnd = slots.filter((m) => m < 960).length;
    const lastSlot = minutes ? Math.max(0, slots.indexOf(barStart(minuteOf(lastT), minutes) ?? -1)) : 0;
    const restToday = minutes ? spd - 1 - lastSlot : 0;
    /** The k-th trading day after the last bar's. */
    const nthSession = (k: number) => {
      let d = lastDate;
      for (let left = k, guard = 0; left > 0 && guard < 4000; guard++) {
        d = addDays(d, 1);
        if (isSession(d)) left--;
      }
      return d;
    };
    const sessionsUntil = (to: string) => {
      let k = 0;
      for (let d = addDays(lastDate, 1), guard = 0; d <= to && guard < 4000; d = addDays(d, 1), guard++) if (isSession(d)) k++;
      return k;
    };
    const clock = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    return {
      /** Where 4:00 PM on a date falls: its daily bar, or the edge between that day's regular and after-hours slots. */
      close(date: string) {
        const k = sessionsUntil(date);
        if (!minutes) return n - 1 + k;
        if (k === 0) return n - 1 + (regEnd - 1 - lastSlot) + 0.5;
        return n - 1 + restToday + (k - 1) * spd + regEnd + 0.5;
      },
      /** The time at a position past the last bar (the crosshair's tag out there). */
      date(i: number) {
        const j = Math.round(i - (n - 1));
        if (!minutes) return nthSession(j);
        if (j <= restToday) return `${lastDate}T${clock(slots[lastSlot + j])}`;
        const m = j - restToday;
        const k = Math.ceil(m / spd);
        return `${nthSession(k)}T${clock(slots[m - (k - 1) * spd - 1])}`;
      },
    };
  }, [bars, minutes, span]);
  const expIdx = useMemo(() => {
    if (!expiry || !bars.length) return null;
    const lastT = bars[bars.length - 1].t;
    const at = minutes ? `${expiry}T16:00` : expiry;
    if (at <= lastT || !ahead) return ts.index(at);
    return ahead.close(expiry);
  }, [expiry, bars, minutes, ts, ahead]);
  const defaultCount = span === "Y" ? bars.length + 2 : span === "M" ? (narrow ? 60 : 132) : weekly ? (narrow ? 45 : 80) : minutes ? (narrow ? 80 : 160) : narrow ? 60 : 130;
  const v = useMemo(
    () => {
      if (view) return view;
      const base = { end: bars.length - 1 + (span === "Y" ? 1 : span === "M" ? 3 : weekly ? 4 : 8), count: Math.min(defaultCount, Math.max(long ? 8 : 20, bars.length + 8)) };
      // A contract's expiry comes into the first view when it's up to about one and a half screens ahead (further, a tag at
      // the right edge points to it; scroll right to reach it).
      const extra = expIdx != null ? Math.ceil(expIdx + (long ? 1 : weekly ? 2 : 4) - base.end) : 0;
      return extra > 0 && extra <= base.count * 1.5 ? { end: base.end + extra, count: base.count + extra } : base;
    },
    [view, bars.length, weekly, span, long, defaultCount, expIdx]
  );
  const left = v.end - v.count;
  const barW = plotW / v.count;
  const x = (i: number) => (i - left + 0.5) * barW;
  const invX = (px: number) => px / barW - 0.5 + left;

  // Price range over the visible bars (and the idea's levels, so they're always on screen).
  const rangeKey = `${ticker}:${settings.tf}`;
  const manual = yRange && yRange.key === rangeKey ? yRange : null;
  const auto = useMemo(() => {
    let l = Infinity;
    let h = -Infinity;
    const from = Math.max(0, Math.floor(left));
    const to = Math.min(bars.length - 1, Math.ceil(v.end));
    for (let i = from; i <= to; i++) {
      if (bars[i].empty) continue;
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
    // The ticket's limit stays in view when it's near the price (not when it's a typo miles away).
    if (limitLine && limitLine.price > 0 && Number.isFinite(l) && limitLine.price > l * 0.85 && limitLine.price < h * 1.15) {
      l = Math.min(l, limitLine.price);
      h = Math.max(h, limitLine.price);
    }
    // The strike too, when it's near.
    if (strikeLine && Number.isFinite(l) && strikeLine.price > l * 0.85 && strikeLine.price < h * 1.15) {
      l = Math.min(l, strikeLine.price);
      h = Math.max(h, strikeLine.price);
    }
    // Working orders near the price stay in view too.
    for (const o of workingOrders ?? []) {
      if (Number.isFinite(l) && o.price > l * 0.85 && o.price < h * 1.15) {
        l = Math.min(l, o.price);
        h = Math.max(h, o.price);
      }
    }
    if (!Number.isFinite(l)) return { lo: 0, hi: 1 };
    const pad = (h - l) * 0.07 || h * 0.02 || 1;
    return { lo: l - pad, hi: h + pad };
  }, [bars, left, v.end, levels, limitLine, workingOrders, strikeLine]);
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
        const gap = (hi - lo) * 0.08;
        const end = ts.date(Math.round(invX(px)) + (span === "Y" ? 1 : span === "M" ? 2 : weekly ? 6 : 20));
        return finishDraft({
          id: uid(),
          kind: "plan",
          side,
          color: side === "long" ? "green" : "red",
          pts: [a, { t: end, p: Number((a.p - sign * gap).toFixed(2)) }, { t: end, p: Number((a.p + sign * gap * 2).toFixed(2)) }],
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
    if (!g && quick && !quick.done && px <= plotW && py <= priceH) {
      setQuick({ ...quick, d: { ...quick.d, pts: [quick.d.pts[0], anchorAt(px, py)] } });
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
    if (g?.mode === "pan" && !g.moved) {
      const { px, py } = local(e);
      if (Math.hypot(px - g.startX, py - g.startY) <= 4) {
        const a = anchorAt(px, py);
        if (!quick) setQuick({ d: { id: "quick-measure", kind: "measure", pts: [a, a], color: "green" }, done: false });
        else if (!quick.done) setQuick({ d: { ...quick.d, pts: [quick.d.pts[0], a] }, done: true });
        else setQuick(null);
      }
      return;
    }
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
        setQuick(null);
        setToolsOpen(false);
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
  // The legend reads the last bar that traded at or before the cursor (an empty slot has nothing of its own).
  const realAt = (i: number) => {
    let j = Math.min(i, bars.length - 1);
    while (j > 0 && bars[j].empty) j--;
    return j;
  };
  const shownIdx = realAt(hoverIdx != null && hoverIdx >= 0 && hoverIdx < bars.length ? hoverIdx : bars.length - 1);
  const shown = bars[shownIdx];
  const prevClose = shownIdx > 0 ? bars[realAt(shownIdx - 1)]?.c : undefined;
  const last = bars[bars.length - 1];

  const visible: number[] = [];
  for (let i = Math.max(0, Math.floor(left)); i <= Math.min(bars.length - 1, Math.ceil(v.end)); i++) visible.push(i);
  const maxVol = Math.max(1, ...visible.map((i) => bars[i].v));
  const drawnBars = visible.filter((i) => !bars[i].empty);
  const volH = priceH * 0.16;
  const bodyW = Math.max(1, Math.min(14, barW * 0.68));

  const ticks = niceTicks(lo, hi, narrow ? 5 : 8);

  // Intraday: runs of bars outside 9:30 to 4:00 (pre-market, after-hours), and the bars that open a session after a
  // weekend or holiday (a gap of more than one calendar day from the bar before).
  const { closedRuns, breaks } = useMemo(() => {
    const runs: { from: number; to: number }[] = [];
    const gaps: number[] = [];
    if (!minutes) return { closedRuns: runs, breaks: gaps };
    let run: { from: number; to: number } | null = null;
    for (const i of visible) {
      const t = bars[i].t;
      const hm = t.slice(11, 16);
      const closed = hm < "09:30" || hm >= "16:00";
      if (closed) {
        if (run && run.to === i - 1) run.to = i;
        else {
          run = { from: i, to: i };
          runs.push(run);
        }
      }
      if (i > 0) {
        const prev = bars[i - 1].t.slice(0, 10);
        const days = (Date.parse(`${t.slice(0, 10)}T12:00:00Z`) - Date.parse(`${prev}T12:00:00Z`)) / 86_400_000;
        if (days > 1) gaps.push(i);
      }
    }
    return { closedRuns: runs, breaks: gaps };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recomputed from the visible window's own inputs
  }, [bars, left, v.end, minutes]);
  const timeTicks = useMemo(() => {
    const out: { i: number; label: string }[] = [];
    let prevKey = "";
    const minGap = narrow ? 60 : 80;
    let lastX = -Infinity;
    // Intraday: with up to three days on screen, a tick each hour (the day's date where a new day starts); more, each day.
    const days = minutes && visible.length ? new Set(visible.map((i) => bars[i].t.slice(0, 10))).size : 0;
    for (const i of visible) {
      const t = bars[i].t;
      const key = minutes
        ? days <= 3
          ? t.slice(0, 13)
          : t.slice(0, 10)
        : long
          ? t.slice(0, 4)
          : weekly || v.count > 300
          ? t.slice(0, 4) + (v.count > 300 ? "" : t.slice(5, 7))
          : t.slice(0, 7);
      if (key !== prevKey) {
        const px = x(i);
        if (px - lastX >= minGap && prevKey) {
          let label: string;
          if (minutes) {
            const newDay = prevKey.slice(0, 10) !== t.slice(0, 10);
            label =
              days <= 3 && !newDay
                ? `${Number(t.slice(11, 13)) % 12 || 12}${Number(t.slice(11, 13)) < 12 ? "am" : "pm"}`
                : new Date(`${t.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
          } else {
            const d = new Date(`${t}T12:00:00Z`);
            label = d.getUTCMonth() === 0 ? String(d.getUTCFullYear()) : d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
          }
          out.push({ i, label });
          lastX = px;
        }
        prevKey = key;
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recomputed from the visible window's own inputs
  }, [bars, left, v.end, v.count, plotW, weekly, long, minutes, narrow]);

  const path = (vals: (number | null)[], yf: (n: number) => number) => {
    let dStr = "";
    let pen = false;
    for (const i of visible) {
      const val = vals[i];
      // Across empty slots the line carries on to the next value.
      if (val == null) continue;
      dStr += `${pen ? "L" : "M"}${x(i).toFixed(1)},${yf(val).toFixed(1)}`;
      pen = true;
    }
    return dStr;
  };

  const rsiY = (r: number) => rsiTop + ((100 - r) / 100) * RSI_H;

  const dateLabel = (t: string, as: Span = "D") => {
    if (as === "Y") return t.slice(0, 4);
    if (as === "M") return new Date(`${t.slice(0, 7)}-15T12:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
    const d = new Date(`${t.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
    if (t.length <= 10) return d;
    const h = Number(t.slice(11, 13));
    return `${d} ${h % 12 || 12}:${t.slice(14, 16)}${h < 12 ? "am" : "pm"}`;
  };
  // Intraday bars run to the last close on the free data plan: say so when today's aren't in.
  const lastIntraDay = minutes && bars.length ? bars[bars.length - 1].t.slice(0, 10) : null;
  const todayNY = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });

  const all = [...drawings, ...(draft ? [draft] : []), ...(quick ? [quick.d] : [])];
  const cursor = overAxis === "price" ? "ns-resize" : overAxis === "time" ? "ew-resize" : tool !== "cursor" || draft || (quick && !quick.done) ? "crosshair" : "default";

  return (
    <div ref={boxRef} className={`relative select-none ${fill ? "flex h-full flex-col" : ""}`}>
      {/* Top bar: timeframe, indicators, zoom, save state */}
      <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs">
        <Seg options={TIMEFRAMES.map((t) => [t, t] as const)} value={settings.tf} onChange={(tf) => changeSettings({ tf })} label="Timeframe" />
        {liveOn && (
          <span className="flex items-center gap-1.5 rounded-md bg-up-soft px-2 py-0.5 text-[11px] font-medium text-up" title="The last candle moves with the live price, every few seconds">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-up opacity-75" />
              <span className="relative inline-flex size-1.5 rounded-full bg-up" />
            </span>
            Live
          </span>
        )}
        {lastIntraDay && lastIntraDay < todayNY && (
          <span className="text-[11px] text-ink-3" title="Today's intraday bars come with the live data plan">
            through {new Date(`${lastIntraDay}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })} close
          </span>
        )}
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
        <span className="mx-1 h-4 w-px bg-line" />
        <div ref={toolsRef} className="relative">
          {tool === "cursor" ? (
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={toolsOpen}
              onClick={() => setToolsOpen((o) => !o)}
              className={`flex h-7 items-center gap-1 rounded-md border px-2 font-medium transition-colors ${toolsOpen ? "border-line-strong bg-panel-2 text-ink" : "border-transparent text-ink-3 hover:text-ink"}`}
              title="Drawing tools (a click on the chart measures)"
            >
              Tools
              <svg viewBox="0 0 10 6" className="h-1.5 w-2.5" fill="currentColor" aria-hidden="true">
                <path d="M0 0h10L5 6z" />
              </svg>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setDraft(null);
                setTool("cursor");
              }}
              className="flex h-7 items-center gap-1.5 rounded-md border border-accent/60 bg-accent-soft px-2 font-medium text-accent-ink"
              title="Stop drawing (Esc)"
            >
              {TOOLS.find((t) => t.key === tool)?.label}
              <span aria-hidden="true">✕</span>
            </button>
          )}
          {toolsOpen && (
            <div role="menu" aria-label="Drawing tools" className="absolute left-0 top-8 z-30 w-56 rounded-lg border border-line-strong bg-panel p-1 shadow-xl">
              {TOOLS.filter((t) => t.key !== "cursor").map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setDraft(null);
                    setQuick(null);
                    setTool(t.key);
                    setSelected(null);
                    setToolsOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[12px] text-ink-2 hover:bg-panel-2 hover:text-ink"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d={t.icon} />
                  </svg>
                  {t.label}
                </button>
              ))}
              <div className="my-1 h-px bg-line" />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  undo();
                  setToolsOpen(false);
                }}
                className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[12px] text-ink-2 hover:bg-panel-2 hover:text-ink"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true">
                  <path d="M9 14L4 9l5-5M4 9h11a5 5 0 010 10h-3" />
                </svg>
                Undo
              </button>
              {drawings.length > 0 && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setToolsOpen(false);
                    if (window.confirm(`Remove all ${drawings.length} drawings on ${name}?`)) {
                      commit([]);
                      setSelected(null);
                    }
                  }}
                  className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[12px] text-ink-2 hover:bg-down-soft hover:text-down"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true">
                    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12M9 7V4h6v3" />
                  </svg>
                  Remove all drawings
                </button>
              )}
            </div>
          )}
        </div>
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

      <div className={`flex ${fill ? "min-h-0 flex-1" : ""}`}>
        <div ref={areaRef} className={`relative min-w-0 flex-1 ${fill ? "min-h-0" : ""}`}>
          {!loaded && !failedNow && (
            <div className="grid animate-pulse place-items-center rounded-lg bg-panel-2" style={{ height: priceH + TIME_H }}>
              {waiting && (
                <p className="max-w-xs px-4 text-center text-xs text-ink-2">
                  Getting {name}&apos;s prices. The data plan allows a few requests a minute, so this can take up to a minute.
                </p>
              )}
            </div>
          )}
          {(failedNow || (loaded && bars.length === 0)) && (
            <div className="grid place-items-center rounded-lg border border-dashed border-line-strong text-center" style={{ height: priceH + TIME_H }}>
              <div className="max-w-xs px-4">
                <p className="text-sm font-medium text-ink">Chart data isn&apos;t available for {name} right now</p>
                <p className="mt-1 text-xs text-ink-3">We don&apos;t draw sample prices. Try again in a few minutes.</p>
              </div>
            </div>
          )}
          {loaded && bars.length > 0 && width > 0 && (
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
                aria-label={`${ticker} ${span === "Y" ? "yearly" : span === "M" ? "monthly" : weekly ? "weekly" : minutes ? `${settings.tf}` : "daily"} candle chart`}
              >
                <defs>
                  <clipPath id={`plot-${ticker}`}>
                    <rect x={0} y={0} width={plotW} height={priceH} />
                  </clipPath>
                  <marker id={`arrow-${ticker}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                    <path d="M0,0 L10,5 L0,10 z" fill="context-stroke" />
                  </marker>
                </defs>

                {/* Closed market (Ben, 2026-11-18: "Gray out weekends and market closed times"): pre-market and
                    after-hours bars on a lighter ground, and a light band where the chart jumps a weekend or holiday. */}
                {minutes && (
                  <g pointerEvents="none">
                    {closedRuns.map((r) => (
                      <rect key={`c${r.from}`} x={x(r.from) - barW / 2} y={0} width={(r.to - r.from + 1) * barW} height={priceH} fill="var(--color-ink)" opacity={0.045} />
                    ))}
                    {breaks.map((i) => (
                      <rect key={`b${i}`} x={x(i) - barW / 2 - Math.max(3, barW) / 2} y={0} width={Math.max(3, barW)} height={priceH} fill="var(--color-ink)" opacity={0.09} />
                    ))}
                  </g>
                )}

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
                    drawnBars.map((i) => {
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
                  {drawnBars.map((i) => {
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

                  {/* An option contract's strike (Ben, 2026-11-18: "show the strike of that contract"), and where the stock is */}
                  {contract && <StrikeBadge contract={contract} spot={underlyingPrice ?? null} />}

                  {/* The last trade price (Ben, 2026-11-18: "show the last trade price with a horizontal colored dotted line") */}
                  {last && last.c > lo && last.c < hi && (
                    <line
                      x1={0}
                      x2={plotW}
                      y1={y(last.c)}
                      y2={y(last.c)}
                      stroke={last.c >= (bars[bars.length - 2]?.c ?? last.o) ? "var(--color-up)" : "var(--color-down)"}
                      strokeOpacity={0.8}
                      strokeDasharray="1.5 3"
                      strokeLinecap="round"
                      strokeWidth={1.2}
                      pointerEvents="none"
                    />
                  )}

                  {/* The contract's expiry: a dashed vertical line, labelled (or a tag at the right edge when it's further on) */}
                  {expiry && expIdx != null && <ExpiryMark x={x(expIdx)} plotW={plotW} priceH={priceH} label={`EXPIRES ${expiryLabel(expiry)}`} />}

                  {/* The option's strike on the stock's chart */}
                  {strikeLine && strikeLine.price > lo && strikeLine.price < hi && (
                    <g pointerEvents="none">
                      <line x1={0} x2={plotW} y1={y(strikeLine.price)} y2={y(strikeLine.price)} stroke="var(--color-accent)" strokeOpacity={0.85} strokeDasharray="10 4" strokeWidth={1.3} />
                      <rect x={8} y={y(strikeLine.price) - 9} width={strikeText(strikeLine).length * 6.6 + 14} height={18} rx={3} fill="var(--color-accent)" />
                      <text x={15} y={y(strikeLine.price) + 4} className="font-mono text-[11px] font-semibold" fill="var(--color-on-accent)">
                        {strikeText(strikeLine)}
                      </text>
                    </g>
                  )}

                  {/* Working orders (Ben, 2026-11-18: "When a limit order is open/unfilled, mark it… +10 or -10 indicating the
                      number of shares or contracts that are still unfilled") */}
                  {(workingOrders ?? []).map((o) =>
                    o.price > lo && o.price < hi ? (
                      <g key={o.id} pointerEvents="none">
                        <line x1={0} x2={plotW} y1={y(o.price)} y2={y(o.price)} stroke={o.side === "buy" ? "var(--color-up)" : "var(--color-down)"} strokeOpacity={0.9} strokeDasharray="8 3 2 3" strokeWidth={1.3} />
                        <rect x={plotW - 118} y={y(o.price) - 9} width={60} height={18} rx={3} fill={o.side === "buy" ? "var(--color-up)" : "var(--color-down)"} />
                        <text x={plotW - 88} y={y(o.price) + 4} textAnchor="middle" className="font-mono text-[11px] font-semibold" fill="#fff">
                          {o.side === "buy" ? "+" : "−"}
                          {o.qty} LMT
                        </text>
                      </g>
                    ) : null
                  )}

                  {/* The ticket's working limit (Ben, 2026-11-18: "show a light line on the chart with a LIMIT label") */}
                  {limitLine && limitLine.price > lo && limitLine.price < hi && (
                    <g pointerEvents="none">
                      <line x1={0} x2={plotW} y1={y(limitLine.price)} y2={y(limitLine.price)} stroke={limitLine.side === "buy" ? "var(--color-up)" : "var(--color-down)"} strokeOpacity={0.55} strokeDasharray="6 4" strokeWidth={1.2} />
                      <rect x={6} y={y(limitLine.price) - 9} width={44} height={16} rx={3} fill="var(--color-panel-3)" opacity={0.9} />
                      <text x={28} y={y(limitLine.price) + 3} textAnchor="middle" className="font-mono text-[10px] font-semibold" fill={limitLine.side === "buy" ? "var(--color-up)" : "var(--color-down)"}>
                        LIMIT
                      </text>
                    </g>
                  )}

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
                      unit={span === "Y" ? "yr" : span === "M" ? "mo" : weekly ? "wk" : "bars"}
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

                {strikeLine && strikeLine.price > lo && strikeLine.price < hi && <AxisTag x={plotW} y={y(strikeLine.price)} fill="var(--color-accent)" text={priceLabel(strikeLine.price)} />}
                {(workingOrders ?? []).map((o) =>
                  o.price > lo && o.price < hi ? <AxisTag key={o.id} x={plotW} y={y(o.price)} fill={o.side === "buy" ? "var(--color-up)" : "var(--color-down)"} text={priceLabel(o.price)} /> : null
                )}
                {limitLine && limitLine.price > lo && limitLine.price < hi && (
                  <AxisTag x={plotW} y={y(limitLine.price)} fill={limitLine.side === "buy" ? "var(--color-up)" : "var(--color-down)"} text={priceLabel(limitLine.price)} />
                )}

                {/* Crosshair: the price where it crosses the price axis, and the bar's date (and time, intraday) where it
                    crosses the time axis (Ben, 2026-11-18: "so I can see where my cursor is"). The vertical line and its
                    time follow the cursor into the RSI pane too. */}
                {hover && hover.y <= totalH && (() => {
                  const i = Math.round(invX(hover.x));
                  const cx = x(i);
                  const t = i >= 0 && i < bars.length ? bars[i].t : i >= bars.length && ahead ? ahead.date(i) : ts.date(i);
                  const label = weekly ? `Week of ${dateLabel(t)}` : dateLabel(t, span);
                  const w = label.length * 6.3 + 14;
                  const tx = Math.max(0, Math.min(plotW - w, cx - w / 2));
                  return (
                    <g pointerEvents="none">
                      {hover.y <= priceH && <line x1={0} x2={plotW} y1={hover.y} y2={hover.y} stroke="var(--color-ink-3)" strokeDasharray="3 3" strokeWidth={0.8} />}
                      <line x1={cx} x2={cx} y1={0} y2={totalH} stroke="var(--color-ink-3)" strokeDasharray="3 3" strokeWidth={0.8} />
                      {hover.y <= priceH && <AxisTag x={plotW} y={hover.y} fill="var(--color-panel-3)" text={priceLabel(invY(hover.y))} ink="var(--color-ink)" />}
                      <rect x={tx} y={priceH + 2} width={w} height={TIME_H - 4} rx={3} fill="var(--color-panel-3)" />
                      <text x={tx + w / 2} y={priceH + TIME_H / 2 + 3.5} textAnchor="middle" className="font-mono text-[10.5px] tabular-nums" fill="var(--color-ink)">
                        {label}
                      </text>
                    </g>
                  );
                })()}
              </svg>

              {!minutes && data?.stale && <p className="mt-1 text-[11px] text-ink-3">Showing the last saved prices; the feed didn’t answer just now.</p>}
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
  unit,
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
  unit: string;
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
      const label = `${up ? "+" : "−"}${priceLabel(Math.abs(dp))} (${up ? "+" : "−"}${Math.abs(pct).toFixed(2)}%) · ${nBars} ${unit}`;
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

/** "AAPL Dec 18 $350 call" for "O:AAPL261218C00350000"; null for a stock. */
function contractName(symbol: string) {
  const m = /^O:([A-Z.]{1,8})(\d{2})(\d{2})(\d{2})([CP])(\d{8})$/.exec(symbol);
  if (!m) return null;
  const strike = Number(m[6]) / 1000;
  return `${m[1]} ${expiryLabel(`20${m[2]}-${m[3]}-${m[4]}`, false)} $${Number.isInteger(strike) ? strike : strike.toFixed(2)} ${m[5] === "C" ? "call" : "put"}`;
}

/** "Dec 18 · 4:00 PM ET" (or "Dec 18"; the year too when it isn't this one). */
function expiryLabel(date: string, time = true) {
  const d = new Date(`${date}T12:00:00Z`);
  const year = d.getUTCFullYear() !== new Date().getUTCFullYear();
  const day = d.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(year ? { year: "numeric" as const } : {}), timeZone: "UTC" });
  return time ? `${day} · 4:00 PM ET` : day;
}

/** An option's expiry on the chart: a dashed line with its label at the top, or a tag at the right edge past the view. */
function ExpiryMark({ x, plotW, priceH, label }: { x: number; plotW: number; priceH: number; label: string }) {
  if (x < 0) return null;
  const past = x > plotW;
  const text = past ? `${label} →` : label;
  const w = text.length * 6.2 + 14;
  const lx = past ? plotW - w - 6 : Math.min(plotW - w - 4, Math.max(4, x - w / 2));
  return (
    <g pointerEvents="none">
      {!past && <line x1={x} x2={x} y1={0} y2={priceH} stroke="var(--color-warn)" strokeOpacity={0.75} strokeDasharray="5 4" strokeWidth={1.3} />}
      <rect x={lx} y={6} width={w} height={18} rx={4} fill="var(--color-panel-3)" stroke="var(--color-warn)" strokeOpacity={0.6} />
      <text x={lx + w / 2} y={18.5} textAnchor="middle" className="font-mono text-[10px] font-semibold" fill="var(--color-warn)">
        {text}
      </text>
    </g>
  );
}

/** An option symbol's parts, or null for a stock. */
function contractParts(symbol: string) {
  const m = /^O:([A-Z.]{1,8})(\d{6})([CP])(\d{8})$/.exec(symbol);
  return m ? { underlying: m[1], call: m[3] === "C", strike: Number(m[4]) / 1000 } : null;
}

/** "STRIKE $250 CALL · AAPL $351.91 · $101.91 in the money", at the plot's top left. */
function StrikeBadge({ contract, spot }: { contract: { underlying: string; call: boolean; strike: number }; spot: number | null }) {
  const k = contract.strike;
  const strike = `STRIKE $${Number.isInteger(k) ? k : k.toFixed(2)} ${contract.call ? "CALL" : "PUT"}`;
  const diff = spot != null && spot > 0 ? (contract.call ? spot - k : k - spot) : null;
  const where = spot == null || !(spot > 0) ? null : `${contract.underlying} $${spot.toFixed(2)} · ${diff === 0 ? "at the money" : `$${Math.abs(diff!).toFixed(2)} ${diff! > 0 ? "in" : "out of"} the money`}`;
  const sw = strike.length * 6.6 + 16;
  const ww = where ? where.length * 6.1 + 14 : 0;
  return (
    <g pointerEvents="none">
      <rect x={6} y={6} width={sw} height={20} rx={4} fill="var(--color-accent)" />
      <text x={6 + sw / 2} y={19.5} textAnchor="middle" className="font-mono text-[11px] font-semibold" fill="var(--color-on-accent)">
        {strike}
      </text>
      {where && (
        <>
          <rect x={12 + sw} y={6} width={ww} height={20} rx={4} fill="var(--color-panel-3)" opacity={0.92} />
          <text x={12 + sw + ww / 2} y={19.5} textAnchor="middle" className="font-mono text-[10.5px]" fill={diff! > 0 ? "var(--color-up)" : "var(--color-ink-2)"}>
            {where}
          </text>
        </>
      )}
    </g>
  );
}

/** "STRIKE $733 CALL". */
const strikeText = (s: { price: number; type: "call" | "put" }) => `STRIKE $${Number.isInteger(s.price) ? s.price : s.price.toFixed(2)} ${s.type.toUpperCase()}`;
