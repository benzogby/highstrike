import type { Metadata } from "next";
import DeskSearch from "@/components/landing/DeskSearch";
import FaqIndex from "@/components/landing/FaqIndex";
import Field from "@/components/landing/Field";
import { Bull, Pill, Tag, Toast, Tri, compact, price, shortDate, sideLabel, signedPct, triggerOf, weekdayDate } from "@/components/landing/Pieces";
import { HomePhone, IdeaPhone, IdeasPhone, SchoolPhone, ScannerPhone, type PhoneIdea, type PhoneModule } from "@/components/landing/Phones";
import SetupChart, { entryIndexOf, hitIndex } from "@/components/landing/SetupChart";
import JoinButton from "@/components/join/JoinButton";
import JoinDialog from "@/components/join/JoinDialog";
import { moduleLabel } from "@/lib/education";
import ProofRow from "@/components/landing/Proof";
import { MONTHLY_PRICE, TRIAL_PRICE, type Library } from "@/lib/offer";
import { LOOKUP_START, getLandingData, type CourseModule, type HeroSetup } from "./data";

// The homepage in the HighStrike reels system (design/keyframes-2026-11-02): the dark room with one light punch, Cal
// Sans and Inter, HighStrike green for the accent and for gains, red only for losses, smoked glass, the price tag as
// the key word. Styles in landing.css. The words are Ben's reset of 2026-11-03: the page is about finding winning
// options trades, on three pillars (education, tools, smart scanning); the scanner is called what it is, a rule-based
// "smart scanner", never AI; proof is the stars, the member count, "since 2018", the school's size and members' quotes
// (Admin → Site → Quotes); a fan of phones for the home-screen app like getripping.com's; a features-only comparison.
// It sells one thing, the membership (Ben, 2026-11-03: "Try it for a week for $14 and then $99/month thereafter"), bought
// in the popup (components/join/JoinDialog). Refreshed every 30 minutes.
export const revalidate = 1800;

const TITLE = "HighStrike — Find winning options trades before the bell";
const DESCRIPTION =
  "Learn options at HighStrike Trading School, check any trade with pro tools, and get fresh trade ideas from the smart scanner every morning. Try it for a week for $14, then $99/month.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, type: "website" },
};

function faqsFor(library: Library | null) {
  const course = library ? `HighStrike Trading School (${library.modules} modules, ${library.lessons} lessons)` : "HighStrike Trading School";
  return [
    {
      q: "What do I get?",
      a: `All of it: ${course}, the smart scanner's trade ideas every morning, every tool on the desk, alerts, the morning email and the app on your phone. Your first week is ${TRIAL_PRICE}, then it's ${MONTHLY_PRICE}/month until you cancel.`,
    },
    {
      q: "Can I cancel?",
      a: `Yes, anytime, from Settings → Billing in a couple of clicks. Cancel during your first week and the ${MONTHLY_PRICE} is never charged. Cancel later and you keep everything until the end of the month you paid for.`,
    },
    {
      q: "How does the smart scanner find ideas?",
      a: "Before the open it checks every stock on HighStrike's list: the day's move, where it closed in its range, gaps, the five-day trend and fresh insider filings. The strongest become the day's ideas, each with an entry, a target, a time window and a bull and bear case. It runs on clear rules, so you can always see why an idea made the list.",
    },
    {
      q: "Is there an app?",
      a: "Yes. Open highstrike.com on your phone. On iPhone tap Share, then Add to Home Screen. On Android tap the menu, then Install app. HighStrike then opens like any other app.",
    },
    {
      q: "I'm new to options. Is it for me?",
      a: "Yes. Start with Trading School, which takes you from what a call and a put are to full strategies. The scanner's ideas will make more sense with every module.",
    },
    {
      q: "How fast do I get in?",
      a: `Right away. Pay ${TRIAL_PRICE} with your email and your account opens the second the payment goes through. Already have an account under that email? It's upgraded instead.`,
    },
    {
      q: "Do I connect my broker?",
      a: "No. HighStrike never touches your account or your money. You trade wherever you already trade.",
    },
    {
      q: "Is this financial advice?",
      a: "No. It's research and education, and you make every decision. Trading involves real risk, including losing money.",
    },
    {
      q: "Can I get a refund?",
      a: "No. Payments are final, as the Terms of Service say. You can cancel anytime, though, so the next month is never charged.",
    },
  ];
}

/** The three pillars, as the section under the tape sets them out. */
function pillarsFor(library: Library | null) {
  return [
    {
      href: "#trading-school",
      k: "Education",
      lead: "Learn it",
      text: library
        ? `HighStrike Trading School: ${library.modules} modules and ${library.lessons} lessons, from your first call option to selling premium for income.`
        : "HighStrike Trading School, from your first call option to selling premium for income.",
    },
    {
      href: "#tools",
      k: "Tools",
      lead: "Check it",
      text: "The market score, insider filings, the crowd and a lookup for any ticker, on one screen. Size every trade before you take it.",
    },
    {
      href: "#scanner",
      k: "Smart scanning",
      lead: "Find it",
      text: "Every morning the scanner checks each stock on the list and turns the strongest into trade ideas with an entry, a target and a window.",
    },
  ];
}

// How the smart scanner finds an idea, in four steps. Only what the engine really does (setupEngine.generateDaily over
// scanner.computeScan and the insider filings).
const steps = [
  { lead: "Before the open, it checks every name", text: "The day's move, where each stock closed in its range, gaps, the five-day trend and fresh insider filings." },
  { lead: "It ranks them and picks the best", text: "The strongest become the day's ideas, long or short, each with an entry, a target and a time window." },
  { lead: "It shows its work", text: "Every idea lists the rules it met and comes with a bull case and a bear case, so you know why it's there." },
  { lead: "You get the heads-up", text: "The ideas land in your morning email, and an alert pings you when a price rule is met. You make the call." },
];

const tools = [
  { name: "Market score", text: "Push or sit tight? Volatility, opportunity and direction, scored 0 to 100 before the open." },
  { name: "Idea feed", text: "Every idea in one list, filtered by side, style and ticker." },
  { name: "Scanner", text: "Every name on the list ranked on momentum, gaps and range." },
  { name: "Idea check", text: "A bull case, a bear case and a position sizer for any idea, even one you paste in." },
  { name: "Insiders", text: "What company insiders bought and sold in the last 30 days." },
  { name: "The crowd", text: "What other traders are watching and which way they lean." },
];

/** What the price buys, as the pricing section lists it. */
function included(library: Library | null) {
  return [
    library ? `HighStrike Trading School: ${library.modules} modules, ${library.lessons} lessons` : "HighStrike Trading School, every module",
    "The smart scanner's trade ideas, every trading day",
    "Every tool: market score, scanner, idea check, insiders, the crowd",
    "Alerts, the morning email and the app on your phone",
    "Every future update, free",
  ];
}

// The comparison, features only (Ben, 2026-11-03: no prices). "some" is a fair "it depends".
type Mark = "yes" | "no" | "some";
const COMPARE: { row: string; marks: [Mark, Mark, Mark, Mark] }[] = [
  { row: "Lessons from the basics to advanced strategies", marks: ["yes", "yes", "no", "no"] },
  { row: "Fresh trade ideas every morning", marks: ["yes", "no", "no", "yes"] },
  { row: "A scanner over the whole list", marks: ["yes", "no", "yes", "no"] },
  { row: "A bull and bear case for every idea", marks: ["yes", "no", "no", "some"] },
  { row: "Position sizing for each trade", marks: ["yes", "some", "no", "no"] },
  { row: "Insider filings and the crowd's lean", marks: ["yes", "no", "some", "no"] },
  { row: "On your phone, from the home screen", marks: ["yes", "some", "some", "some"] },
  { row: "School, scanner, tools and alerts in one membership", marks: ["yes", "no", "no", "no"] },
];
const COMPARE_COLS = ["HighStrike", "An options course", "A scanner app", "An alerts service"];

function priceRuleMet(h: HeroSetup) {
  const trigger = triggerOf(h.setup.criteria);
  if (trigger == null) return null;
  const short = h.setup.direction.toLowerCase() === "short";
  const from = entryIndexOf(h.closes, h.setup) + 1;
  const hit = hitIndex(h.closes, h.setup, from - 1);
  const to = hit >= 0 ? hit : h.closes.length - 1;
  for (let i = from; i <= to; i++) {
    const c = h.closes[i].close;
    if (short ? c < trigger : c > trigger) return { date: h.closes[i].date, close: c, trigger, short };
  }
  return null;
}

function Gauge({ label, value }: { label: string; value: number }) {
  const a0 = Math.PI * 0.8, a1 = Math.PI * 2.2, R = 46, cx = 60, cy = 58;
  const at = (t: number) => [cx + R * Math.cos(a0 + (a1 - a0) * t), cy + R * Math.sin(a0 + (a1 - a0) * t)];
  const [x0, y0] = at(0), [x1, y1] = at(1), [xv, yv] = at(Math.max(0.001, value / 100));
  const big = (a1 - a0) * (value / 100) > Math.PI ? 1 : 0;
  return (
    <div className="hs-gauge">
      <svg viewBox="0 0 120 104" aria-hidden="true">
        <path d={`M${x0} ${y0} A${R} ${R} 0 1 1 ${x1} ${y1}`} className="hs-gauge__track" />
        <path d={`M${x0} ${y0} A${R} ${R} 0 ${big} 1 ${xv.toFixed(1)} ${yv.toFixed(1)}`} className="hs-gauge__value" pathLength={1} />
      </svg>
      <b>{value}</b>
      <span>{label}</span>
    </div>
  );
}

function shade(v: number) {
  const a = Math.min(1, Math.abs(v) / 9);
  return v >= 0
    ? `rgb(${Math.round(12 + 8 * a)},${Math.round(62 + 98 * a)},${Math.round(46 + 70 * a)})`
    : `rgb(${Math.round(84 + 124 * a)},${Math.round(32 + 32 * a)},${Math.round(34 + 22 * a)})`;
}

/** The five-day move from a run of closes, or null without six of them. */
function fiveDay(closes: number[]) {
  const n = closes.length;
  return n > 5 ? ((closes[n - 1] - closes[n - 6]) / closes[n - 6]) * 100 : null;
}

function asPhoneModule(m: CourseModule): PhoneModule {
  const { eyebrow, name } = moduleLabel(m.title);
  return { eyebrow, name: name.replace(/Highstrike/g, "HighStrike"), lessons: m.lessons, art: m.art };
}

const MarkCell = ({ m }: { m: Mark }) =>
  m === "yes" ? (
    <span className="hs-mark hs-mark--yes" role="img" aria-label="Yes" />
  ) : m === "some" ? (
    <span className="hs-mark hs-mark--some">Some</span>
  ) : (
    <span className="hs-mark hs-mark--no" role="img" aria-label="No" />
  );

const at = (i: number) => ({ "--i": i }) as React.CSSProperties;

export default async function Home() {
  const { report, today, spy, qqq, movers, hero, reads, trails, lookup, badges, proof, slateToday, course, quotes } = await getLandingData();

  const session = spy[spy.length - 1]?.date;
  // The day after a holiday repeats the last close, so every move reads zero: the tape only runs when the last
  // session really moved.
  const tape = movers.some((m) => m.changePct !== 0) ? movers.slice(0, 24) : [];
  const rule = hero ? priceRuleMet(hero) : null;
  const slate = today.map((t) => {
    const cl = reads[t.ticker]?.closes ?? [];
    return { ...t, last: cl[cl.length - 1]?.close ?? null };
  });
  const ideas: PhoneIdea[] = today.map((t) => {
    const cl = trails[t.ticker]?.length ? trails[t.ticker] : (reads[t.ticker]?.closes ?? []);
    return { ticker: t.ticker, direction: t.direction, score: t.flowScore, last: cl[cl.length - 1]?.close ?? null, closes: cl.slice(-22).map((c) => c.close) };
  });
  const top = ideas[0];
  const insiders = Object.values(reads)
    .filter((r) => r.insiders && r.insiders.sold > 0)
    .sort((a, b) => (b.insiders?.sold ?? 0) - (a.insiders?.sold ?? 0))
    .slice(0, 5);
  const maxSold = insiders[0]?.insiders?.sold ?? 1;
  const crowd = Object.values(reads)
    .filter((r) => r.chatter && r.chatter.bullish + r.chatter.bearish > 0)
    .sort((a, b) => (b.chatter?.watchers ?? 0) - (a.chatter?.watchers ?? 0))
    .slice(0, 5);
  const map = [...movers].sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));
  // HighStrike Trading School as the membership includes it.
  const lessons = course.reduce((n, m) => n + m.lessons, 0);
  const recorded = course.filter((m) => /recordings/i.test(m.title)).reduce((n, m) => n + m.lessons, 0);
  const library: Library | null = course.length && lessons ? { modules: course.length, lessons } : null;
  // The module the hero and the phones lead with: the options module, else the first with a key image.
  const lead = course.find((m) => m.art && /options trading/i.test(m.title)) ?? course.find((m) => m.art);
  const phoneModules = lead ? [lead, ...course.filter((m) => m !== lead && m.art && m.position > 1).slice(0, 3)].map(asPhoneModule) : [];
  const ideasDay = report ? weekdayDate(report.date) : "This morning";

  return (
    <main className="hs-page">
      {/* The first screen: the promise, and the three pillars as cards */}
      <section className="hs-room hs-hero" aria-labelledby="hs-title">
        <Field spy={spy} qqq={qqq} seed={11} />
        <div className="hs-wrap hs-hero__grid">
          <div className="hs-hero__copy">
            <h1 id="hs-title" className="hs-display hs-h1">
              <span className="hs-line" data-reveal="">
                Find winning
              </span>
              <span className="hs-line" data-reveal="" style={at(1)}>
                <Tag className="hs-tag--land">options trades</Tag>
              </span>
              <span className="hs-line" data-reveal="" style={at(2)}>
                before the bell
              </span>
            </h1>
            <p className="hs-lead" data-reveal="" style={at(3)}>
              Learn how options really work, check any trade with the tools the pros use, and start every morning with fresh trade ideas from the smart scanner. All in one place.
            </p>
            <div id="hero-cta" className="hs-hero__actions" data-reveal="" style={at(4)}>
              <JoinButton className="hs-btn">Try it for {TRIAL_PRICE}</JoinButton>
              <a href="#scanner" className="hs-link">
                See how it finds ideas
              </a>
            </div>
            <p className="hs-hero__price" data-reveal="" style={at(4)}>
              <b>{TRIAL_PRICE} for your first week.</b> Then {MONTHLY_PRICE}/month. Cancel anytime.
            </p>
            <div data-reveal="" style={at(5)}>
              <ProofRow proof={proof} traders={badges.traders} countries={badges.countries} />
            </div>
            {report && (
              <p className="hs-hero__bell" data-reveal="" style={at(5)}>
                <span className="hs-live" aria-hidden="true" />
                <span>
                  <b>{slateToday ? "This morning's ideas are out" : "The latest ideas"}</b> · {weekdayDate(report.date)} · {today.length} idea{today.length === 1 ? "" : "s"}
                </span>
              </p>
            )}
          </div>

          <figure className="hs-trio" data-land="">
            {lead?.art && (
              <a href="#trading-school" className="hs-glass hs-trio__school">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={lead.art} alt="" width={1920} height={1080} />
                <span className="hs-trio__body">
                  <span className="hs-trio__k">Education · Trading School</span>
                  <b>{asPhoneModule(lead).name}</b>
                  {library && (
                    <span className="hs-fine">
                      {library.modules} modules · {library.lessons} lessons
                    </span>
                  )}
                </span>
              </a>
            )}
            {ideas.length > 0 && (
              <a href="#tools" className="hs-glass hs-trio__scan" data-ui="">
                <span className="hs-trio__k">Tools · Scanner</span>
                <span className="hs-trio__table">
                  <span className="hs-trio__row hs-trio__row--h">
                    <b>Ticker</b>
                    <span>5d</span>
                    <span>Score</span>
                    <span>Bias</span>
                  </span>
                  {ideas.slice(0, 5).map((i) => {
                    const f = fiveDay(i.closes);
                    return (
                      <span key={i.ticker} className="hs-trio__row">
                        <b>{i.ticker}</b>
                        <span className={f == null ? undefined : f >= 0 ? "hs-up" : "hs-dn"}>{f == null ? "–" : signedPct(f, 1)}</span>
                        <span>{i.score ?? "–"}</span>
                        <span className={i.direction.toLowerCase() === "short" ? "hs-dn" : "hs-up"}>{sideLabel(i.direction)}</span>
                      </span>
                    );
                  })}
                </span>
              </a>
            )}
            {top && (
              <a href="#scanner" className="hs-glass hs-trio__idea" data-ui="">
                <span className="hs-trio__k">Smart scanning · {slateToday ? "Today's top idea" : "Latest top idea"}</span>
                <span className="hs-trio__tk">
                  {top.ticker} <Pill tone={top.direction.toLowerCase() === "short" ? "red" : "green"}>{sideLabel(top.direction)}</Pill>
                </span>
                <span className="hs-trio__note">An entry, a target and a time window, with the bull and bear case.</span>
                <span className="hs-trio__figs">
                  <span>
                    Last<b>{top.last != null ? price(top.last) : "–"}</b>
                  </span>
                  <span>
                    Score<b>{top.score ?? "–"}</b>
                  </span>
                  <span>
                    5 days<b className={(fiveDay(top.closes) ?? 0) >= 0 ? "hs-up" : "hs-dn"}>{fiveDay(top.closes) == null ? "–" : signedPct(fiveDay(top.closes)!, 1)}</b>
                  </span>
                </span>
              </a>
            )}
            <figcaption className="hs-sr">HighStrike&apos;s three parts: a Trading School module, this morning&apos;s scanner and its top idea.</figcaption>
          </figure>
        </div>
      </section>

      {tape.length > 0 && (
        <section className="hs-tape" aria-label={`The biggest moves among the stocks HighStrike follows, ${session ? `${shortDate(session)} close` : "last session"}`}>
          <span className="hs-tape__label">
            <i aria-hidden="true" />
            Movers · {session ? `${shortDate(session)} close` : "last session"}
          </span>
          <div className="hs-tape__win">
            <div className="hs-tape__run">
              {[...tape, ...tape].map((m, i) => (
                <span key={`${m.ticker}-${i}`} className="hs-tape__it" aria-hidden={i >= tape.length ? true : undefined}>
                  <b>{m.ticker}</b>
                  <span className="hs-tape__p">{price(m.close)}</span>
                  <span className={`hs-tape__c ${m.changePct >= 0 ? "hs-up" : "hs-dn"}`}>
                    <Tri up={m.changePct >= 0} />
                    {Math.abs(m.changePct).toFixed(2)}%
                  </span>
                </span>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* The three pillars */}
      <section id="pillars" className="hs-room hs-section hs-pillars" aria-labelledby="hs-pillars-title">
        <Field spy={spy} qqq={qqq} seed={14} />
        <div className="hs-wrap">
          <div className="hs-section-head">
            <h2 id="hs-pillars-title" className="hs-display hs-h2" data-reveal="">
              Stop guessing.
              <br />
              Start with a plan.
            </h2>
            <p className="hs-lead" data-reveal="" style={at(1)}>
              Most traders lose because they buy on a hunch. HighStrike gives you three things that take the guessing out: the know-how, the tools and a fresh list of ideas every morning.
            </p>
          </div>
          <ol className="hs-pillars__grid">
            {pillarsFor(library).map((p, i) => (
              <li key={p.k} data-reveal="" style={at(i)}>
                <a href={p.href} className="hs-glass hs-pillar">
                  <span className="hs-pillar__n">0{i + 1}</span>
                  <span className="hs-pillar__k">{p.k}</span>
                  <h3 className="hs-h3">{p.lead}</h3>
                  <p>{p.text}</p>
                  <span className="hs-pillar__go" aria-hidden="true">
                    →
                  </span>
                </a>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Smart scanning: the steps beside a real idea, the morning its price rule held */}
      {hero && (
        <section id="scanner" className="hs-room hs-section hs-how" aria-labelledby="hs-how-title">
          <Field spy={spy} qqq={qqq} seed={18} />
          <div className="hs-wrap">
            <div className="hs-section-head">
              <h2 id="hs-how-title" className="hs-display hs-h2" data-reveal="">
                How the smart scanner finds an idea
              </h2>
              <p className="hs-lead" data-reveal="" style={at(1)}>
                No hunches and no hype. The same clear rules, every trading morning.
              </p>
            </div>
            <div className="hs-how__grid">
              <ol className="hs-moments">
                {steps.map((m, i) => (
                  <li key={m.lead} className={i === 3 ? "is-on" : "is-done"} data-reveal="" style={at(i)}>
                    <h3 className="hs-h3">{m.lead}</h3>
                    <p>{m.text}</p>
                  </li>
                ))}
              </ol>
              <div className="hs-stage" data-land="">
                <div className="hs-glass hs-ticket" data-ui="">
                  <div className="hs-ui-head">
                    <span className="hs-ui-head__tk">{hero.setup.ticker}</span>
                    <span className="hs-dot" />
                    <span className="hs-ui-head__nm">{sideLabel(hero.setup.direction)}</span>
                    {rule && (
                      <span className="hs-ui-head__sp">
                        <Pill>Price rule met</Pill>
                      </span>
                    )}
                  </div>
                  <p className="hs-fine hs-ticket__when">A recent idea · published {weekdayDate(hero.setup.reportDate)}, before the open</p>
                  <div className="hs-plan">
                    <div>
                      <span className="hs-lbl">Entry</span>
                      <b>{price(hero.setup.entry)}</b>
                    </div>
                    <div>
                      <span className="hs-lbl">Target</span>
                      <b className="hs-up">{price(hero.setup.target)}</b>
                    </div>
                    <div>
                      <span className="hs-lbl">Window</span>
                      <b>{(hero.setup.timeFrame ?? "3-5 days").replace("-", "–")}</b>
                    </div>
                  </div>
                  <SetupChart
                    id="how"
                    closes={hero.closes}
                    setup={hero.setup}
                    history={14}
                    until={rule?.date ?? undefined}
                    trade={false}
                    crosshair={rule?.date ?? null}
                    label={`${hero.setup.ticker} into the morning of ${shortDate(hero.setup.reportDate)}${rule ? `, closing at ${price(rule.close)} on ${shortDate(rule.date)}` : ""}`}
                  />
                  <ul className="hs-rules">
                    {hero.setup.criteria.map((c) => (
                      <li key={c}>
                        <i aria-hidden="true" />
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
                {rule && (
                  <Toast
                    className="hs-stage__alert"
                    icon="bell"
                    title={`Price rule met · ${hero.setup.ticker}`}
                    sub={`${shortDate(rule.date)} close $${price(rule.close)}, ${rule.short ? "below" : "above"} $${price(rule.trigger)}`}
                    side="Alert"
                    sideNote={shortDate(rule.date)}
                  />
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Tools: one terminal, every tool, this morning's real numbers */}
      <section id="tools" className="hs-room hs-section hs-desk" aria-labelledby="hs-desk-title">
        <Field spy={spy} qqq={qqq} seed={25} />
        <div className="hs-wrap">
          <div className="hs-section-head">
            <h2 id="hs-desk-title" className="hs-display hs-h2" data-reveal="">
              Check every trade before you take it
            </h2>
            <p className="hs-lead" data-reveal="" style={at(1)}>
              The market, the ideas, insiders and the crowd, on one screen. Try it: look up any ticker in the bar.
            </p>
          </div>
          <div className="hs-desk__grid">
            <ul className="hs-tools">
              {tools.map((t, i) => (
                <li key={t.name} className={i === 0 ? "is-on" : undefined} data-reveal="" style={at(i)}>
                  <h3 className="hs-tools__name">{t.name}</h3>
                  <p>{t.text}</p>
                </li>
              ))}
            </ul>
            <div className="hs-glass hs-term" data-ui="" data-land="">
              <div className="hs-term__bar">
                <span className="hs-term__lights" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                <DeskSearch start={LOOKUP_START} initial={lookup} examples={["CVX", "TSLA", "SPY", "HD"]} tracked={movers.length || 48} />
                <span className="hs-term__tabs" aria-hidden="true">
                  <span className="is-on">Briefing</span>
                  <span>Scanner</span>
                  <span>Ideas</span>
                  <span>Alerts</span>
                  <span>School</span>
                </span>
              </div>
              <div className="hs-term__body">
                <div className="hs-pane">
                  {report && (
                    <>
                      <h4>
                        Market score <span>{weekdayDate(report.date)}</span>
                      </h4>
                      <div className="hs-gauges">
                        <Gauge label="Volatility" value={report.volatility} />
                        <Gauge label="Opportunity" value={report.opportunity} />
                        <Gauge label="Direction" value={report.direction} />
                      </div>
                      <p className="hs-pane__note">{report.summary}</p>
                    </>
                  )}
                  {slate.length > 0 && (
                    <>
                      <h4 className="hs-pane__sub">
                        {slateToday ? "Today's ideas" : "The latest ideas"} <span>score · side · last close</span>
                      </h4>
                      <div className="hs-rows">
                        {slate.map((t) => (
                          <div key={t.ticker} className="hs-row">
                            <span className="hs-row__tk">{t.ticker}</span>
                            <span className="hs-row__flow" aria-label={`Score ${t.flowScore ?? 0}`}>
                              <i style={{ width: `${t.flowScore ?? 0}%` }} />
                            </span>
                            <span className={`hs-row__side hs-row__side--${t.direction.toLowerCase() === "short" ? "short" : "long"}`}>{sideLabel(t.direction)}</span>
                            <span className="hs-row__v">{t.last != null ? price(t.last) : "–"}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                <div className="hs-term__col">
                  {insiders.length > 0 && (
                    <div className="hs-pane">
                      <h4>
                        Insider selling <span>30 days</span>
                      </h4>
                      <div className="hs-bars">
                        {insiders.map((r) => (
                          <div key={r.ticker} className="hs-barrow">
                            <span className="hs-barrow__tk">{r.ticker}</span>
                            <span className="hs-barrow__meter">
                              <i className="hs-barrow__sell" style={{ width: `${Math.max(4, ((r.insiders?.sold ?? 0) / maxSold) * 100).toFixed(1)}%` }} />
                            </span>
                            <span className="hs-barrow__v">
                              {r.insiders?.sells} sell{r.insiders?.sells === 1 ? "" : "s"} · ${compact(r.insiders?.sold ?? 0)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {crowd.length > 0 && (
                    <div className="hs-pane">
                      <h4>
                        The crowd <span>bulls vs bears</span>
                      </h4>
                      <div className="hs-bars">
                        {crowd.map((r) => {
                          const c = r.chatter!;
                          return (
                            <div key={r.ticker} className="hs-barrow">
                              <span className="hs-barrow__tk">{r.ticker}</span>
                              <span className="hs-barrow__meter hs-barrow__meter--bear" aria-label={`${Math.round((c.bullish / (c.bullish + c.bearish)) * 100)}% bullish`}>
                                <i className="hs-barrow__bull" style={{ width: `${((c.bullish / (c.bullish + c.bearish)) * 100).toFixed(1)}%` }} />
                              </span>
                              <span className="hs-barrow__v">{c.watchers.toLocaleString("en-US")} watching</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Education: HighStrike Trading School, as its module index with each module's key image */}
      {library && (
        <section id="trading-school" className="hs-room hs-section hs-school" aria-labelledby="hs-school-title">
          <Field spy={spy} qqq={qqq} seed={29} />
          <div className="hs-wrap">
            <div className="hs-school__head">
              <div>
                <h2 id="hs-school-title" className="hs-display hs-h2">
                  <span className="hs-line" data-reveal="">
                    Learn it at
                  </span>
                  <span className="hs-line" data-reveal="" style={at(1)}>
                    <Tag className="hs-tag--land">Trading School</Tag>
                  </span>
                </h2>
                <p className="hs-lead" data-reveal="" style={at(2)}>
                  Nobody wins at options by luck. Every member gets the whole course, built by traders teaching since 2018: {course.length} modules and {lessons} lessons
                  {recorded > 0 ? `, ${recorded} of them recorded live sessions` : ""}, from your first call to selling premium for income.
                </p>
              </div>
              <dl className="hs-school__figs" data-reveal="" style={at(3)}>
                <div>
                  <dt>lessons</dt>
                  <dd>{lessons}</dd>
                </div>
                <div>
                  <dt>modules</dt>
                  <dd>{course.length}</dd>
                </div>
                <div>
                  <dt>teaching since</dt>
                  <dd>2018</dd>
                </div>
              </dl>
            </div>
            <ol className="hs-glass hs-syllabus" data-land="" aria-label="HighStrike Trading School's modules">
              {course.map((m, i) => {
                const { eyebrow, name } = moduleLabel(m.title);
                return (
                  <li key={m.position} className={/recordings/i.test(m.title) ? "is-rec" : undefined} style={at(i)}>
                    {m.art ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="hs-syllabus__art" src={m.art} alt="" width={1920} height={1080} loading="lazy" />
                    ) : (
                      <span className="hs-syllabus__art" aria-hidden="true" />
                    )}
                    <span className="hs-syllabus__k">{eyebrow}</span>
                    <span className="hs-syllabus__t">{name.replace(/Highstrike/g, "HighStrike")}</span>
                    <span className="hs-syllabus__n">
                      {m.lessons} lesson{m.lessons === 1 ? "" : "s"}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>
      )}

      {/* The app: HighStrike from the home screen, as a fan of phones (like getripping.com's) */}
      {ideas.length > 0 && (
        <section id="app" className="hs-room hs-section hs-app" aria-labelledby="hs-app-title">
          <Field spy={spy} qqq={qqq} seed={33} />
          <div className="hs-wrap">
            <div className="hs-app__head">
              <span className="hs-app__eyebrow" data-reveal="">
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <rect x="4" y="1.5" width="8" height="13" rx="2" />
                  <path d="M7.2 12.2h1.6" />
                </svg>
                Mobile app
              </span>
              <h2 id="hs-app-title" className="hs-display hs-h2" data-reveal="" style={at(1)}>
                HighStrike, right on your <Tag className="hs-tag--land">phone</Tag>
              </h2>
              <p className="hs-lead" data-reveal="" style={at(2)}>
                Add highstrike.com to your home screen and it opens like any app. Check the morning&apos;s ideas, run the scanner and pick up your next lesson from anywhere.
              </p>
              <p className="hs-app__how" data-reveal="" style={at(3)}>
                <span>
                  <b>iPhone</b> Share, then Add to Home Screen
                </span>
                <span>
                  <b>Android</b> Menu, then Install app
                </span>
              </p>
            </div>
            <div className="hs-fan" data-land="" role="img" aria-label="HighStrike on a phone: the scanner, the idea feed, the home screen icon, an idea and Trading School">
              <ScannerPhone ideas={ideas} className="hs-fan__p hs-fan__p--0" />
              <IdeasPhone ideas={ideas} day={ideasDay} className="hs-fan__p hs-fan__p--1" />
              <HomePhone className="hs-fan__p hs-fan__p--2" />
              {top && <IdeaPhone idea={top} className="hs-fan__p hs-fan__p--3" />}
              {phoneModules.length > 0 && <SchoolPhone modules={phoneModules} className="hs-fan__p hs-fan__p--4" />}
            </div>
          </div>
        </section>
      )}

      {/* Members' words, from Admin → Site → Quotes; hidden until there are some */}
      {quotes.length > 0 && (
        <section className="hs-room hs-section hs-quotes" aria-labelledby="hs-quotes-title">
          <Field spy={spy} qqq={qqq} seed={36} />
          <div className="hs-wrap">
            <div className="hs-section-head">
              <h2 id="hs-quotes-title" className="hs-display hs-h2" data-reveal="">
                From the members
              </h2>
              <div data-reveal="" style={at(1)}>
                <ProofRow proof={proof} traders={badges.traders} countries={badges.countries} />
              </div>
            </div>
            <ul className="hs-quotes__grid">
              {quotes.slice(0, 9).map((q, i) => (
                <li key={`${q.name}-${i}`} className="hs-glass hs-quote" data-reveal="" style={at(i % 3)}>
                  <blockquote>&ldquo;{q.quote}&rdquo;</blockquote>
                  <p className="hs-quote__who">
                    {q.photo && /^https:\/\//.test(q.photo) && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={q.photo} alt="" width={44} height={44} loading="lazy" />
                    )}
                    <span>
                      <b>{q.name}</b>
                      {q.role && <span>{q.role}</span>}
                    </span>
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* One membership against piecing it together, features only */}
      <section id="compare" className="hs-room hs-section hs-compare" aria-labelledby="hs-compare-title">
        <Field spy={spy} qqq={qqq} seed={38} />
        <div className="hs-wrap">
          <div className="hs-section-head">
            <h2 id="hs-compare-title" className="hs-display hs-h2" data-reveal="">
              One membership instead of three
            </h2>
            <p className="hs-lead" data-reveal="" style={at(1)}>
              Most traders piece it together: a course here, a scanner there, an alerts service on top. HighStrike is all of it, in one place.
            </p>
          </div>
          <div className="hs-glass hs-compare__box" data-land="">
            <table className="hs-compare__table">
              <thead>
                <tr>
                  <td />
                  {COMPARE_COLS.map((c, i) => (
                    <th key={c} scope="col" className={i === 0 ? "is-hs" : undefined}>
                      {i === 0 ? (
                        <span className="hs-compare__brand">
                          <Bull className="hs-bull--sm" />
                          {c}
                        </span>
                      ) : (
                        c
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARE.map((r) => (
                  <tr key={r.row}>
                    <th scope="row">{r.row}</th>
                    {r.marks.map((m, i) => (
                      <td key={i} className={i === 0 ? "is-hs" : undefined}>
                        <MarkCell m={m} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* The membership, sold as an order ticket: the $14 week, then $99/month */}
      <section id="pricing" className="hs-room hs-section hs-pricing" aria-labelledby="hs-pricing-title">
        <Field spy={spy} qqq={qqq} seed={32} />
        <div className="hs-wrap hs-pricing__grid">
          <div>
            <h2 id="hs-pricing-title" className="hs-display hs-h2">
              <span className="hs-line" data-reveal="">
                Your first week,
              </span>
              <span className="hs-line" data-reveal="" style={at(1)}>
                <Tag className="hs-tag--land">{TRIAL_PRICE}</Tag>
              </span>
            </h2>
            <p className="hs-lead" data-reveal="" style={at(2)}>
              Everything opens the second you pay: the school, the tools, the scanner&apos;s ideas and the app. Then {MONTHLY_PRICE}/month, and you can cancel anytime in a couple of clicks.
            </p>
            <ul className="hs-included">
              {included(library).map((t, i) => (
                <li key={t} data-reveal="" style={at(i + 2)}>
                  {t}
                </li>
              ))}
            </ul>
            <div data-reveal="">
              <ProofRow proof={proof} traders={badges.traders} countries={badges.countries} />
            </div>
          </div>
          <div className="hs-glass hs-order" data-ui="" data-land="">
            <div className="hs-ui-head">
              <Bull className="hs-bull--sm" />
              <span className="hs-ui-head__tk">HighStrike</span>
              <span className="hs-ui-head__nm">Membership</span>
              <span className="hs-ui-head__sp">
                <Pill>7-day trial</Pill>
              </span>
            </div>
            <dl>
              <div>
                <dt>Access</dt>
                <dd>School, tools, scanner, app</dd>
              </div>
              <div>
                <dt>First week</dt>
                <dd>{TRIAL_PRICE}.00</dd>
              </div>
              <div>
                <dt>Then</dt>
                <dd>{MONTHLY_PRICE}.00/month</dd>
              </div>
              <div>
                <dt>Cancel</dt>
                <dd>Anytime, in Settings</dd>
              </div>
              <div>
                <dt>Opens</dt>
                <dd>The moment you pay</dd>
              </div>
            </dl>
            <p className="hs-order__due">
              <span>Due today</span>
              <b>{TRIAL_PRICE}</b>
            </p>
            <JoinButton className="hs-btn hs-btn--wide">Start my week for {TRIAL_PRICE}</JoinButton>
            <p className="hs-order__after">Card or Apple Pay through Stripe. Cancel anytime; payments are final.</p>
          </div>
        </div>
      </section>

      {/* Questions: an index and one answer */}
      <section className="hs-room hs-section hs-faq" aria-label="Questions">
        <Field spy={spy} qqq={qqq} seed={39} />
        <div className="hs-wrap">
          <FaqIndex title="Questions" faqs={faqsFor(library)} />
        </div>
      </section>

      {/* The close: the last session on one map, and the full lockup */}
      <section id="closing" className="hs-room hs-close" aria-labelledby="hs-close-title">
        <Field spy={spy} qqq={qqq} seed={46} />
        <div className="hs-wrap">
          {map.length > 0 && (
            <div className="hs-glass hs-map" data-ui="" data-reveal="">
              <div className="hs-map__head">
                <span className="hs-map__tk">The scanner&apos;s {map.length} names</span>
                <span className="hs-map__nm">{session ? `${shortDate(session)} close` : "last session"}</span>
                <span className="hs-map__sp">coloured by the move</span>
              </div>
              <div className="hs-map__tiles">
                {map.map((m, i) => (
                  <div key={m.ticker} className={`hs-mt${i < 2 ? " hs-mt--xl" : i < 8 ? " hs-mt--l" : ""}`} style={{ background: shade(m.changePct) }}>
                    <b>{m.ticker}</b>
                    <span>{signedPct(m.changePct)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="hs-end">
            <span className="hs-end__pool" aria-hidden="true" />
            <Bull className="hs-bull--xl" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="hs-end__word" src="/brand/wordmark.png" alt="HighStrike" width={169} height={34} />
            <h2 id="hs-close-title" className="hs-display hs-h2" data-reveal="">
              Tomorrow&apos;s ideas are already taking shape.
            </h2>
            <p className="hs-lead" data-reveal="" style={at(1)}>
              Try it for a week for {TRIAL_PRICE} and start every morning with a plan.
            </p>
            <div data-reveal="" style={at(2)}>
              <JoinButton className="hs-btn">Try it for {TRIAL_PRICE}</JoinButton>
            </div>
          </div>
        </div>
      </section>
      <JoinDialog library={library} />
    </main>
  );
}
