import Link from "next/link";
import CountUp from "@/components/landing/CountUp";
import LiveSpy from "@/components/landing/LiveSpy";
import { formatDateShort, getLandingData, type ClosedSetup } from "./data";

// Refresh the live report, setups and scoreboard every 30 minutes.
export const revalidate = 1800;

const TRIAL_HREF = "/signup";

const faqs = [
  {
    q: "What do I get for $99 a month?",
    a: "Everything: the AI trading terminal (market weather, the flow scanner, insider filings and alerts), the daily trade ideas with entries, targets, time windows and suggested contracts, and the full HighStrike Trading School library. One plan, no upsells.",
  },
  {
    q: "How does the free trial work?",
    a: "You start with 7 days free. A card is needed to start, and you're charged $99 only if you keep going after day 7. Cancel from your account before then and you pay nothing.",
  },
  {
    q: "Do I need to connect my brokerage account?",
    a: "No, and you can't. HighStrike is analytics software by design. It never touches your broker, your positions or your money; you place trades wherever you already trade.",
  },
  {
    q: "What experience level do I need?",
    a: "You should know what a call and a put are. Beyond that, every setup is a worked example with its reasoning written out, and the Trading School library covers the rest.",
  },
  {
    q: "Is this financial advice?",
    a: "No. HighStrike AI is an analytics and data tool; setups are market commentary, not recommendations. Trading involves substantial risk, including loss of principal. You make your own decisions and should consult a qualified advisor.",
  },
];

const includes = [
  "AI trading terminal: market weather, flow scanner, insider filings",
  "Daily trade ideas with entry, target, time window and contracts",
  "The full HighStrike Trading School library ($397 value)",
  "Alerts when a setup triggers",
  "Cancel anytime from your account",
];

const lessons = [
  { n: "01", title: "Options mechanics", state: "done" },
  { n: "02", title: "Trade management", state: "done" },
  { n: "03", title: "The risk framework behind every setup", state: "now" },
  { n: "04", title: "Trade review: grade your own execution", state: "next" },
] as const;

// Placeholders until Ben sends real member quotes. They never render on the
// production deployment (VERCEL_ENV), only on previews and locally.
const PLACEHOLDER_TESTIMONIALS = [1, 2, 3];
const showPlaceholders = process.env.VERCEL_ENV !== "production";

function pct(n: number) {
  return `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(2)}%`;
}

function money(n: number) {
  return `$${n.toFixed(2)}`;
}

function statusLabel(status: string) {
  if (status === "target_hit") return "Target hit";
  if (status === "stopped") return "Stopped out";
  if (status === "expired") return "Expired";
  return status;
}

function Ring({ label, value, color, delay }: { label: string; value: number; color: string; delay: string }) {
  return (
    <div className="text-center">
      <div className="relative mx-auto h-16 w-16">
        <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90" aria-hidden="true">
          <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
          <circle
            cx="32"
            cy="32"
            r="26"
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeLinecap="round"
            pathLength={100}
            className="lp-ring"
            style={{ strokeDasharray: `${value} 100`, animationDelay: delay }}
          />
        </svg>
        <span className="font-mono-nums absolute inset-0 flex items-center justify-center text-base font-semibold">
          <CountUp to={value} duration={1800} />
        </span>
      </div>
      <p className="mt-1.5 text-[10.5px] text-ink-2">{label}</p>
    </div>
  );
}

function DirectionBadge({ direction }: { direction: string }) {
  const long = direction === "long";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        long ? "bg-up/15 text-up" : "bg-down/15 text-down"
      }`}
    >
      {long ? "Long" : "Short"}
    </span>
  );
}

function Lock() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 018 0v4" />
    </svg>
  );
}

function sparkPoints(closes: number[]) {
  if (closes.length < 2) return "";
  const lo = Math.min(...closes);
  const hi = Math.max(...closes);
  const span = hi - lo || 1;
  return closes
    .map((c, i) => `${((i * 300) / (closes.length - 1)).toFixed(1)},${(58 - ((c - lo) / span) * 52).toFixed(1)}`)
    .join(" ");
}

export default async function Home() {
  const d = await getLandingData();
  const top = d.today[0];
  const sample: ClosedSetup | undefined = d.closed.find((c) => c.status === "target_hit" && c.criteria.length > 0);
  const traders = parseInt(d.badges.traders.replace(/[^0-9]/g, ""), 10) || 10000;
  const tradersSuffix = /\+\s*$/.test(d.badges.traders) ? "+" : "";
  const countries = parseInt(d.badges.countries.replace(/[^0-9]/g, ""), 10) || 142;
  const spyClose = d.spy.at(-1);
  const spyPrev = d.spy.at(-2);

  return (
    <main className="overflow-x-hidden">
      {/* 1 · Hero: the promise, the trial, and the app with this morning's real report */}
      <section className="mx-auto flex max-w-6xl flex-wrap items-center gap-11 px-5 pb-5 pt-6 lg:pt-12">
        <div className="min-w-0 flex-[1_1_460px] text-center lg:text-left">
          <p className="inline-flex items-center gap-2 rounded-full border border-line bg-white/[0.03] px-3 py-1.5 text-[13px] text-ink-2">
            <span className="lp-pulse h-[7px] w-[7px] rounded-full bg-accent" aria-hidden="true" />
            Everything for $99/month · 7 days free
          </p>
          <h1 className="font-display mt-5 text-[clamp(40px,10vw,80px)] leading-[1.04] tracking-[-0.02em]">
            Trade like you have a <span className="text-accent">research team.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-[17px] leading-relaxed text-ink-2 lg:mx-0">
            Every morning, HighStrike AI reads the whole market and hands you finished options setups: the entry,
            the target and the reason why. You decide. You execute.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
            <Link
              href={TRIAL_HREF}
              className="press lp-cta inline-flex min-h-[54px] items-center justify-center rounded-full bg-accent px-7 text-base font-semibold text-[#03130c] transition hover:bg-accent-2"
            >
              Start your 7-day free trial
            </Link>
          </div>
          <p className="mt-3 text-[13px] text-ink-3">Then $99/month. Cancel anytime.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2 lg:justify-start">
            {[
              [d.badges.traders, "traders"],
              [d.badges.countries, "countries"],
            ].map(([v, l]) => (
              <span key={l} className="lp-glass inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] text-ink-2">
                <span className="font-semibold text-ink">{v}</span> {l}
              </span>
            ))}
            <span className="lp-glass inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] text-ink-2">
              Since <span className="font-semibold text-ink">2018</span>
            </span>
          </div>
        </div>

        <div className="flex min-w-0 flex-[1_1_340px] justify-center" aria-label="The HighStrike app on a phone">
          <div className="lp-float lp-phone w-full max-w-[330px] rounded-[44px] border border-white/[0.12] bg-[#0c0f13] p-2.5">
            <div className="relative overflow-hidden rounded-[36px] border border-white/[0.06] bg-[#080a0d] px-3.5 pb-4 pt-4">
              <div className="mx-auto mb-3 h-[22px] w-[84px] rounded-full bg-black" aria-hidden="true" />

              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs text-ink-3">{d.report ? `${d.report.dateLabel} · pre-market` : "Pre-market"}</p>
                  <p className="font-display mt-0.5 text-lg">Good morning</p>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={d.logo ?? "/api/site/favicon"} alt="" width={28} height={28} className="h-7 w-7" />
              </div>

              {top && (
                <div className="lp-drop absolute inset-x-3 top-3 z-10 flex items-center gap-2.5 rounded-2xl border border-accent/35 bg-[#161c22]/95 px-3 py-2.5 shadow-[0_12px_30px_-10px_rgba(0,0,0,0.8)]">
                  <span className="h-2 w-2 flex-none rounded-full bg-up" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold">New setup published</p>
                    <p className="font-mono-nums mt-px text-[11px] text-ink-2">
                      {top.ticker} · {top.direction.toUpperCase()} · flow {top.flowScore ?? "—"}
                    </p>
                  </div>
                </div>
              )}

              {d.report && (
                <div className="lp-glass mt-3.5 rounded-[18px] p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-ink-2">Market weather</p>
                    <p className="inline-flex items-center gap-1.5 text-[11px] text-up">
                      <span className="lp-pulse h-1.5 w-1.5 rounded-full bg-up" aria-hidden="true" />
                      Live
                    </p>
                  </div>
                  <div className="mt-2.5 grid grid-cols-3 gap-1.5">
                    <Ring label="Volatility" value={d.report.volatility} color="#ffb020" delay="0s" />
                    <Ring label="Opportunity" value={d.report.opportunity} color="#2fd39a" delay="0.15s" />
                    <Ring label="Direction" value={d.report.direction} color="#9fb3c8" delay="0.3s" />
                  </div>
                  <p className="mt-2.5 text-xs leading-normal text-ink-2">{d.report.summary}</p>
                </div>
              )}

              {d.today.length > 0 && (
                <div className="lp-glass mt-2.5 rounded-[18px] p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-ink-2">Today&apos;s setups</p>
                    <p className="font-mono-nums text-[11px] text-ink-3">{d.today.length} published</p>
                  </div>
                  <div className="mt-2 flex flex-col gap-1.5">
                    {d.today.slice(0, 3).map((t, i) => (
                      <div
                        key={t.ticker}
                        className="lp-in flex items-center justify-between gap-2 rounded-xl bg-white/[0.03] px-2.5 py-2"
                        style={{ "--lp-delay": `${0.6 + i * 0.3}s` } as React.CSSProperties}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-display text-base">{t.ticker}</span>
                          <DirectionBadge direction={t.direction} />
                        </div>
                        <span className="inline-flex items-center gap-1.5 font-mono-nums text-[11px] text-ink-3">
                          <Lock /> entry · target
                        </span>
                      </div>
                    ))}
                  </div>
                  <Link href={TRIAL_HREF} className="mt-2 block text-center text-[11.5px] font-semibold text-accent">
                    Unlock today&apos;s setups free →
                  </Link>
                </div>
              )}

              {spyClose != null && spyPrev != null && (
                <div className="lp-glass mt-2.5 rounded-[18px] px-3 pb-2 pt-3">
                  <div className="flex items-baseline justify-between">
                    <p className="text-xs font-semibold text-ink-2">S&amp;P 500 · {d.spy.length} days</p>
                    <LiveSpy close={spyClose} prevClose={spyPrev} />
                  </div>
                  <svg viewBox="0 0 300 64" preserveAspectRatio="none" className="mt-1.5 h-16 w-full" aria-hidden="true">
                    <polyline
                      points={sparkPoints(d.spy)}
                      fill="none"
                      stroke="#00c27f"
                      strokeWidth="2"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      pathLength={100}
                      className="lp-draw"
                    />
                  </svg>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 2 · Proof */}
      <section className="mx-auto max-w-6xl px-5 pt-9" aria-label="HighStrike in numbers">
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
          {[
            { node: <CountUp to={traders} suffix={tradersSuffix} />, label: "traders" },
            { node: <CountUp to={countries} />, label: "countries" },
            { node: "2018", label: "teaching options since" },
            { node: <CountUp to={150} suffix="K" />, label: "trades of data behind the AI" },
          ].map((s) => (
            <div key={s.label} className="lp-glass rounded-[18px] px-4 py-[18px]">
              <p className="font-display text-[32px] tracking-[-0.01em]">{s.node}</p>
              <p className="mt-1 text-[13px] text-ink-2">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 3 · What you get for $99 */}
      <section id="what" className="mx-auto max-w-6xl scroll-mt-16 px-5 pb-6 pt-16">
        <div className="text-center">
          <p className="text-[13px] font-semibold tracking-[0.06em] text-accent">ONE PLAN · EVERYTHING INCLUDED</p>
          <h2 className="font-display mx-auto mt-3 max-w-3xl text-[clamp(32px,7.5vw,56px)] leading-[1.06] tracking-[-0.015em]">
            Three tools. One price. $99 a month.
          </h2>
          <p className="mx-auto mt-3.5 max-w-xl text-base leading-relaxed text-ink-2">
            No tiers and no upsells. The terminal, the daily trade ideas and the full Trading School are all in.
          </p>
        </div>

        <div className="mt-9 flex flex-wrap gap-3.5">
          <div className="lp-glass min-w-0 flex-[1_1_320px] rounded-3xl p-3.5">
            <div className="rounded-2xl border border-white/[0.06] bg-[#0b0e12] p-3 font-mono-nums text-xs">
              <div className="flex justify-between text-[10.5px] text-ink-3">
                <span>FLOW SCANNER</span>
                <span>5,400+ SYMBOLS</span>
              </div>
              {d.today.map((t) => (
                <div key={t.ticker} className="mt-1.5 grid grid-cols-[48px_minmax(0,1fr)_36px_52px] items-center gap-2 rounded-lg bg-white/[0.025] px-1.5 py-2">
                  <span className="font-semibold">{t.ticker}</span>
                  <span className="h-1 overflow-hidden rounded bg-white/[0.07]">
                    <span
                      className={`block h-full ${t.direction === "long" ? "bg-up" : "bg-down"}`}
                      style={{ width: `${Math.max(4, t.flowScore ?? 0)}%` }}
                    />
                  </span>
                  <span className="text-right">{t.flowScore ?? "—"}</span>
                  <span className={`text-right font-semibold ${t.direction === "long" ? "text-up" : "text-down"}`}>
                    {t.direction === "long" ? "LONG" : "SHORT"}
                  </span>
                </div>
              ))}
            </div>
            <h3 className="font-display mx-1.5 mt-[18px] text-[22px]">The AI trading terminal</h3>
            <p className="mx-1.5 mb-1.5 mt-2 text-[14.5px] leading-relaxed text-ink-2">
              Market weather, a scanner that ranks 5,400+ stocks by options flow, insider filings and alerts. Your
              whole morning on one screen.
            </p>
          </div>

          <div className="lp-glass min-w-0 flex-[1_1_320px] rounded-3xl p-3.5">
            {sample ? (
              <div className="rounded-2xl border border-white/[0.06] bg-[#0b0e12] p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <span className="font-display text-[17px]">{sample.ticker}</span>
                    <DirectionBadge direction={sample.direction} />
                  </span>
                  <span className="rounded-full bg-accent px-2.5 py-1 text-[11px] font-semibold text-[#03130c]">
                    Target hit {sample.resultPct != null ? pct(sample.resultPct) : ""}
                  </span>
                </div>
                <div className="mt-3 flex flex-col gap-1.5">
                  {sample.criteria.map((c, i) => (
                    <p
                      key={c}
                      className="lp-in flex gap-2 text-[12.5px] text-ink-2"
                      style={{ "--lp-delay": `${0.3 + i * 0.25}s` } as React.CSSProperties}
                    >
                      <span className="text-up" aria-hidden="true">
                        ✓
                      </span>
                      {c}
                    </p>
                  ))}
                </div>
                <p className="font-mono-nums mt-2.5 text-[11px] text-ink-3">
                  Published {formatDateShort(sample.reportDate)} · {money(sample.entry)} → {money(sample.target)}
                  {sample.timeFrame ? ` · ${sample.timeFrame}` : ""}
                </p>
              </div>
            ) : null}
            <h3 className="font-display mx-1.5 mt-[18px] text-[22px]">The trade ideas engine</h3>
            <p className="mx-1.5 mb-1.5 mt-2 text-[14.5px] leading-relaxed text-ink-2">
              Finished trades, not ticker lists. Entry rules, target, time window and suggested contracts, with the
              reasoning written out.
            </p>
          </div>

          <div className="lp-glass min-w-0 flex-[1_1_320px] rounded-3xl p-3.5">
            <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0b0e12]">
              <div className="flex h-[120px] items-center justify-center border-b border-white/[0.06] bg-[#10151b]">
                <span className="flex h-[54px] w-[54px] items-center justify-center rounded-full bg-ink" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="22" height="22">
                    <path d="M8 5v14l11-7z" fill="#06080b" />
                  </svg>
                </span>
              </div>
              <div className="flex flex-col gap-1 p-3">
                {lessons.map((l) => (
                  <p key={l.n} className="flex items-center gap-2.5 text-[13px]">
                    <span className="font-mono-nums text-[11px] text-ink-3">{l.n}</span>
                    <span className="min-w-0 flex-1 text-ink-2">{l.title}</span>
                    <span
                      className={`font-mono-nums text-xs ${
                        l.state === "done" ? "text-up" : l.state === "now" ? "text-[#ffb020]" : "text-ink-3"
                      }`}
                      aria-hidden="true"
                    >
                      {l.state === "done" ? "✓" : l.state === "now" ? "▶" : "○"}
                    </span>
                  </p>
                ))}
              </div>
            </div>
            <h3 className="font-display mx-1.5 mt-[18px] text-[22px]">The education library</h3>
            <p className="mx-1.5 mb-1.5 mt-2 text-[14.5px] leading-relaxed text-ink-2">
              The complete HighStrike Trading School, from options mechanics to trade review. A $397 program,
              included.
            </p>
          </div>
        </div>
      </section>

      {/* 4 · Trades: graded in public, wins and losses */}
      <section id="results" className="mx-auto max-w-6xl scroll-mt-16 px-5 pt-16">
        <div className="text-center">
          <p className="text-[13px] font-semibold tracking-[0.06em] text-accent">THE SCOREBOARD</p>
          <h2 className="font-display mx-auto mt-3 max-w-3xl text-[clamp(30px,7vw,52px)] leading-[1.06] tracking-[-0.015em]">
            Every setup graded in public. Losses too.
          </h2>
          <p className="mx-auto mt-3.5 max-w-xl text-base leading-relaxed text-ink-2">
            Since August 2026 each setup is recorded with its entry and target, then graded automatically against
            real prices.
          </p>
        </div>

        {d.stats && (
          <div className="mt-9 grid grid-cols-2 gap-2.5 md:grid-cols-4">
            {[
              { v: d.stats.winRate != null ? `${d.stats.winRate}%` : "—", l: "Hit their target" },
              { v: d.stats.avgGain != null ? `+${d.stats.avgGain}%` : "—", l: "Average gain" },
              { v: d.stats.avgLoss != null ? `${d.stats.avgLoss}%` : "—", l: "Average loss" },
              { v: `${d.stats.closedCount}`, l: `closed · ${d.stats.openCount} open` },
            ].map((t) => (
              <div key={t.l} className="lp-glass rounded-[18px] px-4 py-[18px]">
                <p className="font-display text-[28px]">{t.v}</p>
                <p className="mt-1 text-[13px] text-ink-2">{t.l}</p>
              </div>
            ))}
          </div>
        )}

        {d.closed.length > 0 && (
          <div className="lp-glass mt-3 overflow-hidden rounded-[18px]">
            <p className="border-b border-line px-4 py-3 text-xs font-semibold text-ink-2">Most recently closed</p>
            {d.closed.map((c) => (
              <div
                key={`${c.ticker}-${c.reportDate}`}
                className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-line px-4 py-3 last:border-0"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="font-display text-base">{c.ticker}</span>
                  <DirectionBadge direction={c.direction} />
                  <span className="hidden truncate text-xs text-ink-3 sm:inline">{formatDateShort(c.reportDate)}</span>
                </span>
                <span className="text-xs text-ink-3">{statusLabel(c.status)}</span>
                <span className={`font-mono-nums text-sm ${(c.resultPct ?? 0) >= 0 ? "text-up" : "text-down"}`}>
                  {c.resultPct != null ? pct(c.resultPct) : "—"}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-10 text-center">
          <p className="font-display text-xl">Before the terminal: our options trades</p>
          <p className="mx-auto mt-1.5 max-w-lg text-sm text-ink-2">Results from HighStrike&apos;s options trading.</p>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2.5">
          {d.scoreboard.stats.map((s) => (
            <div key={s.label} className="lp-glass rounded-[18px] px-3 py-4 text-center">
              <p className={`font-display text-[26px] ${s.value.startsWith("-") ? "text-down" : "text-up"}`}>{s.value}</p>
              <p className="mt-1 text-xs text-ink-2">{s.label}</p>
            </div>
          ))}
        </div>
        <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
          {d.scoreboard.trades.map((t) => (
            <div key={t.ticker} className="lp-glass flex items-center justify-between rounded-[18px] px-5 py-4">
              <div>
                <p className="font-display text-xl">{t.ticker}</p>
                <p className="mt-0.5 text-xs text-ink-2">{t.status}</p>
              </div>
              <p className="font-display text-2xl text-up">{t.result}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-center">
          <Link href="/results" className="text-sm font-semibold text-accent transition hover:text-accent-2">
            Full scoreboard and methodology →
          </Link>
        </p>
      </section>

      {/* 5 · Testimonials (placeholders: previews only, never production) */}
      {showPlaceholders && (
        <section className="mx-auto max-w-6xl px-5 pt-16" aria-label="What members say">
          <h2 className="font-display text-center text-[clamp(28px,6.5vw,44px)] leading-tight">What members say</h2>
          <div className="mt-8 grid gap-3 md:grid-cols-3">
            {PLACEHOLDER_TESTIMONIALS.map((n) => (
              <figure key={n} className="rounded-3xl border border-dashed border-[#ffb020]/60 bg-[#ffb020]/[0.04] p-5">
                <p className="text-[11px] font-semibold tracking-[0.06em] text-[#ffb020]">
                  PLACEHOLDER · REAL MEMBER QUOTE GOES HERE
                </p>
                <blockquote className="mt-3 text-[15px] leading-relaxed text-ink-2">
                  [A real member&apos;s words about HighStrike, with their permission.]
                </blockquote>
                <figcaption className="mt-4 text-sm text-ink-3">[Name, trading since 20XX]</figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {/* 6 · The offer, FAQ, last call */}
      <section id="trial" className="mx-auto max-w-6xl scroll-mt-16 px-5 pb-20 pt-16">
        <div className="mx-auto max-w-3xl rounded-[28px] border border-accent/30 bg-accent/[0.07] px-5 py-7 text-center">
          <p className="font-display text-[clamp(40px,9vw,56px)] leading-none tracking-[-0.01em]">
            $99<span className="font-body text-lg font-medium text-ink-2">/month</span>
          </p>
          <ul className="mx-auto mt-5 max-w-md space-y-2.5 text-left text-sm text-ink-2">
            {includes.map((i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="mt-0.5 text-up" aria-hidden="true">
                  ✓
                </span>
                {i}
              </li>
            ))}
          </ul>
          <Link
            href={TRIAL_HREF}
            className="press lp-cta mt-6 inline-flex min-h-[54px] items-center justify-center rounded-full bg-accent px-7 font-semibold text-[#03130c] transition hover:bg-accent-2"
          >
            Start your 7-day free trial
          </Link>
          <p className="mt-2.5 text-[12.5px] text-ink-3">$0 today. Cancel anytime before day 7 and you won&apos;t be charged.</p>
        </div>

        <div className="mx-auto mt-14 max-w-3xl">
          <h2 className="font-display text-center text-[clamp(28px,6.5vw,40px)]">Questions, answered</h2>
          <div className="mt-6 divide-y divide-line border-y border-line">
            {faqs.map((f) => (
              <details key={f.q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                  {f.q}
                  <span className="text-ink-3 transition group-open:rotate-45" aria-hidden="true">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-ink-2">{f.a}</p>
              </details>
            ))}
          </div>
        </div>

        <div className="mt-14 text-center">
          <h2 className="font-display text-[clamp(30px,7vw,48px)] leading-tight">
            Tomorrow&apos;s setups publish <span className="text-accent">before the open.</span>
          </h2>
          <Link
            href={TRIAL_HREF}
            className="press lp-cta mt-6 inline-flex min-h-[54px] items-center justify-center rounded-full bg-accent px-7 font-semibold text-[#03130c] transition hover:bg-accent-2"
          >
            Start your 7-day free trial
          </Link>
          <p className="mt-2.5 text-[13px] text-ink-3">Then $99/month. Cancel anytime.</p>
        </div>
      </section>
    </main>
  );
}
