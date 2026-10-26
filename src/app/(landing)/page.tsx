import type { Metadata } from "next";
import Link from "next/link";
import HeroVideo from "@/components/landing/HeroVideo";
import LiveSpy from "@/components/landing/LiveSpy";
import { formatDateShort, getLandingData, type ClosedSetup, type Report, type TodaySetup } from "./data";

// The homepage in the HighStrike design system (docs/design-system.md).
// Refresh the live report, setups and scoreboard every 30 minutes.
export const revalidate = 1800;

export const metadata: Metadata = {
  title: "HighStrike — Trade like you have a research team",
  description:
    "Every morning, HighStrike's AI reads the whole market and delivers finished options setups: the entry, the target and the reasoning. $99 a month, 7 days free.",
  openGraph: {
    title: "HighStrike — Trade like you have a research team",
    description:
      "Every morning, HighStrike's AI reads the whole market and delivers finished options setups: the entry, the target and the reasoning.",
    type: "website",
  },
};

const TRIAL_HREF = "/signup";

// The hero's background film. Empty until the AI-generated footage is cut; the
// hero is laid out for it and reads on the ivory ground alone until then.
const HERO_VIDEO: { src: string | null; poster?: string } = { src: null };

// Placeholders until Ben sends real member quotes. They never render on the
// production deployment (VERCEL_ENV), only on previews and locally.
const showPlaceholders = process.env.VERCEL_ENV !== "production";

const BUTTON =
  "inline-flex min-h-12 items-center justify-center rounded-[4px] bg-lx-ink px-6 text-[15px] font-medium tracking-[0.01em] text-white transition-colors duration-200 hover:bg-[#262628] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-lx-ink";
const TEXT_LINK =
  "inline-flex items-center text-[15px] font-medium text-lx-ink underline decoration-lx-gold decoration-1 underline-offset-[7px] transition-colors hover:decoration-lx-ink";

const faqs = [
  {
    q: "What do I get for $99 a month?",
    a: "Everything: the AI trading terminal (market weather, the flow scanner, insider filings and alerts), the daily trade ideas with entries, targets, time windows and suggested contracts, and the full HighStrike Trading School library. One membership, no upsells.",
  },
  {
    q: "How does the free trial work?",
    a: "You start with 7 days free. A card is needed to begin, and you're charged $99 only if you continue after day 7. Cancel from your account before then and you pay nothing.",
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

const included = [
  "The AI trading terminal: market weather, flow scanner, insider filings",
  "Daily trade ideas with entry, target, time window and contracts",
  "The complete Trading School library, a $397 program",
  "Alerts the moment a setup's entry rules trigger",
  "Cancel anytime from your account",
];

function pct(n: number, digits = 2) {
  return `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(digits)}%`;
}

function statusLabel(status: string) {
  if (status === "target_hit") return "Target hit";
  if (status === "stopped") return "Stopped out";
  if (status === "expired") return "Expired";
  return status;
}

function Eyebrow({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`text-[11.5px] font-semibold uppercase tracking-[0.22em] text-lx-gold-ink ${className}`}>{children}</p>
  );
}

function SectionTitle({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <h2
      className={`font-lx-serif text-[clamp(38px,5.2vw,64px)] font-medium leading-[1.02] tracking-[-0.01em] text-lx-ink ${className}`}
    >
      {children}
    </h2>
  );
}

function Direction({ direction }: { direction: string }) {
  const long = direction.toLowerCase() === "long";
  return (
    <span className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${long ? "text-lx-up" : "text-lx-down"}`}>
      {long ? "Long" : "Short"}
    </span>
  );
}

function Lock() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="1.5" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

// An ink line through the closes, in a 600×120 box with a little headroom.
function chart(closes: number[], w = 600, h = 120, pad = 8) {
  const lo = Math.min(...closes);
  const span = Math.max(...closes) - lo || 1;
  const pts = closes.map((c, i) => [(i / (closes.length - 1)) * w, pad + (1 - (c - lo) / span) * (h - pad * 2)]);
  return {
    d: pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" "),
    last: pts[pts.length - 1],
  };
}

function Briefing({ report, today, spy }: { report: Report | null; today: TodaySetup[]; spy: number[] }) {
  const metrics = report
    ? [
        { label: "Volatility", value: report.volatility },
        { label: "Opportunity", value: report.opportunity },
        { label: "Direction", value: report.direction },
      ]
    : [];
  const line = spy.length > 1 ? chart(spy) : null;

  return (
    <figure className="m-0">
      <div className="overflow-hidden rounded-[10px] border border-lx-line bg-white shadow-[0_1px_2px_rgba(11,11,12,0.04),0_32px_64px_-40px_rgba(11,11,12,0.3)]">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 border-b border-lx-line px-5 py-4 sm:px-7">
          <p className="whitespace-nowrap font-lx-serif text-[24px] font-medium leading-none">The Briefing</p>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-lx-ink-3">
            {report ? `${report.dateLabel} · Pre-market` : "Pre-market"}
          </p>
        </div>

        {report && (
          <>
            <dl className="grid grid-cols-3 border-b border-lx-line">
              {metrics.map((m, i) => (
                <div key={m.label} className={`flex flex-col-reverse px-4 py-5 sm:px-7 ${i > 0 ? "border-l border-lx-line" : ""}`}>
                  <dt className="mt-2.5 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-lx-ink-3 sm:text-[11px]">
                    {m.label}
                  </dt>
                  <dd className="m-0">
                    <span className="font-lx-serif text-[38px] font-medium leading-none sm:text-[44px]">{m.value}</span>
                    <span className="mt-3 block h-[2px] bg-lx-line" aria-hidden="true">
                      <span className="block h-full bg-lx-ink" style={{ width: `${Math.max(0, Math.min(100, m.value))}%` }} />
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
            <p className="border-b border-lx-line px-5 py-5 text-[15px] leading-[1.65] text-lx-ink-2 sm:px-7">{report.summary}</p>
          </>
        )}

        <div className="px-5 py-5 sm:px-7">
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-lx-ink-3">Today&apos;s setups</p>
            <p className="text-[12.5px] text-lx-ink-3">{today.length} published</p>
          </div>
          {today.length > 0 ? (
            <ul className="mt-3 divide-y divide-lx-line border-y border-lx-line">
              {today.map((s) => (
                <li key={s.ticker} className="flex items-center justify-between gap-3 py-3.5">
                  <span className="flex items-baseline gap-3">
                    <span className="font-lx-serif text-[26px] font-medium leading-none">{s.ticker}</span>
                    <Direction direction={s.direction} />
                  </span>
                  <span className="flex items-center gap-4 text-[12.5px] text-lx-ink-3">
                    <span className="tabular-nums">Flow {s.flowScore ?? "—"}</span>
                    <span className="inline-flex items-center gap-1.5">
                      <Lock />
                      <span className="hidden sm:inline">Entry · target</span>
                      <span className="sm:hidden">Members</span>
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 border-y border-lx-line py-4 text-[14px] text-lx-ink-3">The next slate publishes before the open.</p>
          )}
          <Link href={TRIAL_HREF} className={`mt-4 ${TEXT_LINK} text-[14px]`}>
            Unlock today&apos;s setups, free for 7 days
          </Link>
        </div>

        {line && (
          <div className="border-t border-lx-line px-5 pb-5 pt-4 sm:px-7">
            <div className="flex items-baseline justify-between gap-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-lx-ink-3">S&amp;P 500 · {spy.length} sessions</p>
              <LiveSpy close={spy[spy.length - 1]} prevClose={spy[spy.length - 2]} />
            </div>
            <svg viewBox="0 0 600 120" className="mt-3 h-auto w-full overflow-visible" aria-hidden="true">
              <path d={line.d} fill="none" stroke="#0b0b0c" strokeWidth="1.6" strokeLinejoin="round" pathLength={100} className="lx-draw" />
              <circle cx={line.last[0]} cy={line.last[1]} r="4" fill="#a8874a" />
            </svg>
          </div>
        )}
      </div>
      <figcaption className="mt-4 text-[13px] text-lx-ink-3">
        Live from today&apos;s report. Entries and targets are for members.
      </figcaption>
    </figure>
  );
}

function RecordTable({ closed }: { closed: ClosedSetup[] }) {
  return (
    <table className="w-full border-collapse text-left">
      <caption className="sr-only">The most recently closed setups</caption>
      <thead>
        <tr className="border-b border-lx-ink text-[11px] uppercase tracking-[0.18em] text-lx-ink-3">
          <th scope="col" className="py-3 font-semibold">Setup</th>
          <th scope="col" className="hidden py-3 font-semibold sm:table-cell">Published</th>
          <th scope="col" className="py-3 font-semibold">Outcome</th>
          <th scope="col" className="py-3 text-right font-semibold">Result</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-lx-line">
        {closed.map((c) => (
          <tr key={`${c.ticker}-${c.reportDate}`}>
            <td className="py-4">
              <span className="flex items-baseline gap-3">
                <span className="font-lx-serif text-[24px] font-medium leading-none">{c.ticker}</span>
                <Direction direction={c.direction} />
              </span>
            </td>
            <td className="hidden py-4 text-[14px] text-lx-ink-2 sm:table-cell">{formatDateShort(c.reportDate)}</td>
            <td className="py-4 text-[14px] text-lx-ink-2">{statusLabel(c.status)}</td>
            <td
              className={`py-4 text-right text-[15px] tabular-nums ${
                c.resultPct == null ? "text-lx-ink-3" : c.resultPct >= 0 ? "text-lx-up" : "text-lx-down"
              }`}
            >
              {c.resultPct == null ? "—" : pct(c.resultPct)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default async function Home() {
  const { report, today, closed, spy, stats, badges, scoreboard } = await getLandingData();
  const lastWin = closed.find((c) => c.status === "target_hit" && c.resultPct != null);

  const proof = [
    { value: badges.traders, label: "Traders" },
    { value: badges.countries, label: "Countries" },
    { value: "2018", label: "Teaching options since" },
    { value: "150K", label: "Trades behind the models" },
  ];

  const pillars = [
    {
      n: "I",
      title: "The Terminal",
      body: "Market weather, a flow scanner that ranks 5,400+ stocks by options activity, insider filings and alerts. One quiet screen, ready before the open.",
      note: "Updated through the session",
    },
    {
      n: "II",
      title: "Daily Trade Ideas",
      body: "Finished setups: entry rules, a target, a time window and suggested contracts, with the reasoning written out in plain English.",
      note: lastWin
        ? `Latest: ${lastWin.ticker} ${lastWin.direction.toLowerCase()}, target hit ${pct(lastWin.resultPct ?? 0)}`
        : "Published every market day",
    },
    {
      n: "III",
      title: "Trading School",
      body: "The complete HighStrike curriculum, from options mechanics to grading your own execution. A $397 program, included.",
      note: "Mechanics · management · risk · review",
    },
  ];

  const record = stats
    ? [
        { value: stats.winRate != null ? `${stats.winRate}%` : "—", label: "Hit their target", tone: "text-lx-ink" },
        { value: stats.avgGain != null ? pct(stats.avgGain, 1) : "—", label: "Average gain", tone: "text-lx-up" },
        { value: stats.avgLoss != null ? pct(stats.avgLoss, 1) : "—", label: "Average loss", tone: "text-lx-down" },
        { value: String(stats.closedCount), label: `Closed · ${stats.openCount} open`, tone: "text-lx-ink" },
      ]
    : [];

  return (
    <main>
      {/* Hero: the film behind, the promise bottom-left */}
      <section className="relative isolate overflow-hidden bg-lx-ivory">
        <HeroVideo src={HERO_VIDEO.src} poster={HERO_VIDEO.poster} note={showPlaceholders ? "Background film goes here" : null} />
        <div className="mx-auto flex min-h-[calc(86svh_-_68px)] max-w-[1240px] flex-col justify-end px-5 pb-16 pt-24 sm:px-8 lg:min-h-[calc(92svh_-_68px)] lg:pb-24">
          <div className="max-w-[780px]">
            <Eyebrow className="lx-rise">The AI trading desk · Est. 2018</Eyebrow>
            <h1
              className="lx-rise mt-6 font-lx-serif text-[clamp(48px,9vw,108px)] font-medium leading-[0.98] tracking-[-0.015em] text-lx-ink"
              style={{ "--lx-delay": "0.08s" } as React.CSSProperties}
            >
              Trade like you have a <em className="font-medium italic">research team.</em>
            </h1>
            <p
              className="lx-rise mt-7 max-w-[560px] text-[17px] leading-[1.65] text-lx-ink-2 sm:text-[19px]"
              style={{ "--lx-delay": "0.18s" } as React.CSSProperties}
            >
              Every morning, HighStrike&apos;s AI reads the whole market and delivers finished options setups: the entry,
              the target and the reasoning. You decide. You execute.
            </p>
            <div className="lx-rise mt-10" style={{ "--lx-delay": "0.28s" } as React.CSSProperties}>
              <div className="flex flex-wrap items-center gap-x-8 gap-y-5">
                <Link href={TRIAL_HREF} className={BUTTON}>
                  Start your 7-day free trial
                </Link>
                <a href="#briefing" className={TEXT_LINK}>
                  Read this morning&apos;s briefing
                </a>
              </div>
              <p className="mt-5 text-[13px] text-lx-ink-3">Then $99 a month. Cancel anytime.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Proof */}
      <section aria-label="HighStrike in numbers" className="border-b border-lx-line bg-white">
        <dl className="mx-auto grid max-w-[1240px] grid-cols-2 px-5 sm:px-8 lg:grid-cols-4">
          {proof.map((p, i) => (
            <div
              key={p.label}
              className={`flex flex-col-reverse py-8 lg:py-11 ${
                [
                  "pr-5",
                  "border-l border-lx-line pl-5 lg:pl-8",
                  "border-t border-lx-line pr-5 lg:border-l lg:border-t-0 lg:pl-8",
                  "border-l border-t border-lx-line pl-5 lg:border-t-0 lg:pl-8",
                ][i]
              }`}
            >
              <dt className="mt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-lx-ink-3">{p.label}</dt>
              <dd className="m-0 font-lx-serif text-[clamp(38px,5vw,56px)] font-medium leading-none">{p.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* The briefing: the product, with this morning's real report */}
      <section id="briefing" className="scroll-mt-[68px] bg-white">
        <div className="mx-auto grid max-w-[1240px] gap-14 px-5 py-24 sm:px-8 lg:grid-cols-12 lg:gap-10 lg:py-32">
          <div className="lg:col-span-5 lg:pt-4">
            <Eyebrow>This morning&apos;s briefing</Eyebrow>
            <SectionTitle className="mt-5">Your morning, prepared before the bell.</SectionTitle>
            <p className="mt-7 max-w-[460px] text-[17px] leading-[1.65] text-lx-ink-2">
              Before the open, the AI publishes the day&apos;s market weather, a note on the tape and a short list of
              setups. Each one arrives finished: entry rules, a target, a time window and the reasoning, written out.
            </p>
            <ol className="mt-10 max-w-[460px] border-t border-lx-line">
              {[
                "Market weather: volatility, opportunity and direction, each scored 0 to 100.",
                "Setups ranked by options flow across 5,400+ symbols.",
                "An alert the moment a setup's entry rules trigger.",
              ].map((item, i) => (
                <li key={item} className="flex gap-5 border-b border-lx-line py-4 text-[15px] leading-[1.6] text-lx-ink-2">
                  <span className="w-5 shrink-0 font-lx-serif text-[18px] font-medium leading-[1.4] text-lx-gold-ink">
                    {["I", "II", "III"][i]}
                  </span>
                  {item}
                </li>
              ))}
            </ol>
          </div>
          <div className="lg:col-span-7">
            <Briefing report={report} today={today} spy={spy} />
          </div>
        </div>
      </section>

      {/* What membership includes */}
      <section className="border-t border-lx-line bg-lx-ivory">
        <div className="mx-auto max-w-[1240px] px-5 py-24 sm:px-8 lg:py-32">
          <div className="max-w-[720px]">
            <Eyebrow>Membership includes</Eyebrow>
            <SectionTitle className="mt-5">Three tools. One membership.</SectionTitle>
          </div>
          <div className="mt-16 grid border-t border-lx-ink md:grid-cols-3">
            {pillars.map((p, i) => (
              <article
                key={p.title}
                className={`flex flex-col py-10 md:px-8 ${i === 0 ? "md:pl-0" : "border-t border-lx-line md:border-l md:border-t-0"} ${
                  i === 2 ? "md:pr-0" : ""
                }`}
              >
                <p className="font-lx-serif text-[22px] font-medium text-lx-gold-ink">{p.n}</p>
                <h3 className="mt-4 font-lx-serif text-[34px] font-medium leading-[1.05]">{p.title}</h3>
                <p className="mt-5 text-[15.5px] leading-[1.7] text-lx-ink-2">{p.body}</p>
                <p className="mt-auto pt-8 text-[11px] font-semibold uppercase tracking-[0.16em] text-lx-ink-3">{p.note}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* The record: graded in public, wins and losses */}
      <section id="record" className="scroll-mt-[68px] border-t border-lx-line bg-white">
        <div className="mx-auto max-w-[1240px] px-5 py-24 sm:px-8 lg:py-32">
          <div className="grid gap-14 lg:grid-cols-12 lg:gap-10">
            <div className="lg:col-span-5">
              <Eyebrow>The record</Eyebrow>
              <SectionTitle className="mt-5">Every call, on the record.</SectionTitle>
              <p className="mt-7 max-w-[440px] text-[17px] leading-[1.65] text-lx-ink-2">
                Since August 2026, every setup is recorded with its entry and target, then graded automatically against
                real prices. The losses stay on the page.
              </p>
              <Link href="/results" className={`mt-9 ${TEXT_LINK}`}>
                The full record and methodology
              </Link>
            </div>
            <div className="lg:col-span-7">
              {record.length > 0 && (
                <dl className="grid grid-cols-2 border-t border-lx-ink sm:grid-cols-4">
                  {record.map((r, i) => (
                    <div
                      key={r.label}
                      className={`flex flex-col-reverse py-6 ${i % 2 === 1 ? "border-l border-lx-line pl-5" : "pr-5"} ${
                        i >= 2 ? "border-t border-lx-line sm:border-t-0" : ""
                      } ${i === 2 ? "sm:border-l sm:pl-5" : ""}`}
                    >
                      <dt className="mt-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-lx-ink-3">{r.label}</dt>
                      <dd className={`m-0 font-lx-serif text-[40px] font-medium leading-none ${r.tone}`}>{r.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {closed.length > 0 && (
                <div className="mt-12">
                  <RecordTable closed={closed} />
                </div>
              )}
            </div>
          </div>

          <div className="mt-24 grid gap-10 border-t border-lx-line pt-12 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <Eyebrow>Before the terminal</Eyebrow>
              <p className="mt-4 max-w-[400px] font-lx-serif text-[28px] font-medium leading-[1.15]">
                Results from HighStrike&apos;s options desk.
              </p>
            </div>
            <div className="lg:col-span-7">
              <dl className="grid grid-cols-3 gap-5">
                {scoreboard.stats.map((s) => (
                  <div key={s.label} className="flex flex-col-reverse">
                    <dt className="mt-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-lx-ink-3">{s.label}</dt>
                    <dd className="m-0 font-lx-serif text-[36px] font-medium leading-none">{s.value.replace("-", "−")}</dd>
                  </div>
                ))}
              </dl>
              <ul className="mt-8 divide-y divide-lx-line border-y border-lx-line">
                {scoreboard.trades.map((t) => (
                  <li key={t.ticker} className="flex items-baseline justify-between gap-4 py-3.5">
                    <span className="flex items-baseline gap-3">
                      <span className="font-lx-serif text-[22px] font-medium leading-none">{t.ticker}</span>
                      <span className="text-[13px] text-lx-ink-3">{t.status}</span>
                    </span>
                    <span className="text-[15px] tabular-nums text-lx-up">{t.result}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-[12.5px] leading-[1.6] text-lx-ink-3">
                Options trades from before the AI terminal launched. Past results don&apos;t guarantee future returns.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Member voices: placeholders on previews only, never on production */}
      {showPlaceholders && (
        <section aria-label="Member testimonials (placeholders)" className="border-t border-lx-line bg-white">
          <div className="mx-auto max-w-[1240px] px-5 py-24 sm:px-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <Eyebrow>Members</Eyebrow>
              <span className="border border-dashed border-lx-down px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-lx-down">
                Placeholder · real quotes before launch
              </span>
            </div>
            <div className="mt-10 grid gap-10 md:grid-cols-3">
              {[1, 2, 3].map((n) => (
                <figure key={n} className="m-0 border-t border-lx-line pt-7">
                  <blockquote className="m-0 font-lx-serif text-[26px] font-medium italic leading-[1.3] text-lx-ink-3">
                    “[Member quote {n} goes here]”
                  </blockquote>
                  <figcaption className="mt-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-lx-ink-3">
                    [Name] · [City]
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Membership */}
      <section id="membership" className="scroll-mt-[68px] border-t border-lx-line bg-lx-ivory">
        <div className="mx-auto grid max-w-[1240px] gap-14 px-5 py-24 sm:px-8 lg:grid-cols-12 lg:gap-10 lg:py-32">
          <div className="lg:col-span-5">
            <Eyebrow>Membership</Eyebrow>
            <SectionTitle className="mt-5">One membership. Everything included.</SectionTitle>
            <p className="mt-7 max-w-[420px] text-[17px] leading-[1.65] text-lx-ink-2">
              No tiers and no upsells. Begin with seven days free.
            </p>
          </div>
          <div className="lg:col-span-6 lg:col-start-7">
            <div className="rounded-[10px] border border-lx-line bg-white p-7 shadow-[0_1px_2px_rgba(11,11,12,0.04),0_32px_64px_-44px_rgba(11,11,12,0.3)] sm:p-10">
              <p className="flex items-baseline gap-3">
                <span className="font-lx-serif text-[80px] font-medium leading-[0.9]">$99</span>
                <span className="text-[15px] text-lx-ink-3">per month</span>
              </p>
              <ul className="mt-9 divide-y divide-lx-line border-y border-lx-line">
                {included.map((item) => (
                  <li key={item} className="flex gap-4 py-3.5 text-[15px] leading-[1.55] text-lx-ink-2">
                    <span className="mt-[11px] h-px w-4 shrink-0 bg-lx-gold" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link href={TRIAL_HREF} className={`${BUTTON} mt-9 w-full`}>
                Start your 7-day free trial
              </Link>
              <p className="mt-4 text-center text-[13px] leading-[1.6] text-lx-ink-3">
                $0 today. Cancel anytime before day 7 and you won&apos;t be charged.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Questions */}
      <section className="border-t border-lx-line bg-white">
        <div className="mx-auto grid max-w-[1240px] gap-12 px-5 py-24 sm:px-8 lg:grid-cols-12 lg:gap-10 lg:py-32">
          <div className="lg:col-span-4">
            <Eyebrow>Questions</Eyebrow>
            <SectionTitle className="mt-5">Before you begin.</SectionTitle>
          </div>
          <div className="border-t border-lx-ink lg:col-span-7 lg:col-start-6">
            {faqs.map((f) => (
              <details key={f.q} className="group border-b border-lx-line py-6">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-6 font-lx-serif text-[24px] font-medium leading-[1.25] [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span className="mt-0.5 text-[22px] leading-none text-lx-gold transition-transform duration-300 group-open:rotate-45" aria-hidden="true">
                    +
                  </span>
                </summary>
                <p className="mt-4 max-w-[620px] text-[15.5px] leading-[1.7] text-lx-ink-2">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Closing */}
      <section className="border-t border-lx-line bg-lx-ivory">
        <div className="mx-auto max-w-[1240px] px-5 py-24 text-center sm:px-8 lg:py-32">
          <Eyebrow>Tomorrow, before the open</Eyebrow>
          <p className="mx-auto mt-6 max-w-[820px] font-lx-serif text-[clamp(40px,5.6vw,72px)] font-medium leading-[1.02] tracking-[-0.01em]">
            Your briefing will be waiting.
          </p>
          <div className="mt-11 flex justify-center">
            <Link href={TRIAL_HREF} className={BUTTON}>
              Start your 7-day free trial
            </Link>
          </div>
          <p className="mt-5 text-[13px] text-lx-ink-3">Then $99 a month. Cancel anytime.</p>
        </div>
      </section>
    </main>
  );
}
