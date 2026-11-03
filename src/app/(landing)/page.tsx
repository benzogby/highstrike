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
// the key word. Styles in landing.css. The words are Ben's copy overhaul of 2026-11-03 (evening): the page describes the
// product, an options trading platform, for people who've lost money on options, in a trading desk's voice: why options
// trades lose (five mistakes, five fixes), then the whole trade in three steps, Find, Check and Track, with the twelve
// tools named and numbered, then Trading School, the phones, the comparison, the price and the questions. The scanner
// is called what it is, a rule-based "smart scanner", never AI; the ideas' track record isn't on the page (Ben: "No
// mention"). Proof is the stars, the member count and members' quotes (Admin → Site → Quotes). It sells one thing, the
// membership ($14 for the first week, then $99/month), bought in the popup (components/join/JoinDialog). Refreshed every
// 30 minutes.
export const revalidate = 1800;

const TITLE = "HighStrike — Better options trades. Less guesswork.";
const DESCRIPTION =
  "HighStrike is an options trading platform: trade ideas from the smart scanner at 8:30 AM ET, 12 pro tools to check and size them, alerts at your target and stop, and Trading School. $14 for your first week, then $99/month.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, type: "website" },
};

function faqsFor(library: Library | null, names: number) {
  const course = library ? `HighStrike Trading School (${library.modules} modules, ${library.lessons} lessons)` : "HighStrike Trading School";
  return [
    {
      q: "What is HighStrike?",
      a: "An options trading platform. Every trading day at 8:30 AM ET the smart scanner generates the day's trade ideas. Twelve tools help you find, check, size and track trades, and Trading School teaches the why behind them. It runs in your browser and on your phone.",
    },
    {
      q: `What do I get for ${TRIAL_PRICE}?`,
      a: `Everything, the second you pay: the morning ideas, all 12 tools, alerts, ${course} and the app. Your first week is ${TRIAL_PRICE}, then it's ${MONTHLY_PRICE}/month until you cancel. Already have an account under that email? It's upgraded instead.`,
    },
    {
      q: "What time do ideas land?",
      a: "8:30 AM ET, every trading day, an hour before the bell. They're in the app and in your inbox at the same time.",
    },
    {
      q: "Which stocks does it cover?",
      a: `The smart scanner, the Scanner and Build an idea cover ${names} of the most traded names: big stocks like NVDA, TSLA, AAPL and AMD, plus SPY, QQQ, IWM and DIA. Paste an idea works on any US stock.`,
    },
    {
      q: "Are the option prices real quotes?",
      a: "No. They're estimates, marked est., worked out from the stock's own moves over the last month. Check the live price at your broker before you trade.",
    },
    {
      q: "How much money do I need?",
      a: "There's no minimum. The position sizer starts from your account size and the most you'll risk on one trade, and tells you how many contracts or shares that buys. One contract can cost a few dollars or a few thousand.",
    },
    {
      q: "How does the smart scanner pick ideas?",
      a: "Before the open it checks every name on its list: the day's move, where it closed in its range, gaps, the five-day trend and fresh insider filings. The strongest become the day's ideas, each with an entry, a target, a stop, a time window, a suggested option and a bull and bear case. Clear rules, so you always see why an idea made the list.",
    },
    {
      q: "I've lost money on options. Is this for me?",
      a: "Yes. HighStrike is built around the habits most losing trades skip: an exit before you're in, a size that fits your risk, and an alert when it's time to act. New to options? Start with Trading School.",
    },
    {
      q: "Can I cancel?",
      a: `Yes, anytime, from Settings → Billing in a couple of clicks. Cancel during your first week and the ${MONTHLY_PRICE} is never charged. Cancel later and you keep everything until the end of the month you paid for.`,
    },
    {
      q: "Is there an app?",
      a: "Yes. Open highstrike.com on your phone. On iPhone tap Share, then Add to Home Screen. On Android tap the menu, then Install app. It opens like any other app.",
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

// Why options trades lose (Ben, 2026-11-03: "Five mistakes, five fixes"): each mistake beside the part of HighStrike
// that fixes it. Only what the app really does.
const LEDGER = [
  {
    usual: "Bought on a hunch",
    fix: "Ideas from rules, 8:30 AM ET",
    how: "The smart scanner ranks every name on its list before the open. Each idea shows the rules it met.",
  },
  {
    usual: "No exit plan",
    fix: "Target and stop before you buy",
    how: "Every idea comes with an entry, a target and a stop. You know the exit before you're in.",
  },
  {
    usual: "Wrong strike or expiry",
    fix: "A suggested option, with the math",
    how: "Strike, expiry, est. cost, est. value at the target and breakeven, from the stock's own volatility.",
  },
  {
    usual: "Sized too big",
    fix: "A sizer built on your risk",
    how: "Enter your account size and your risk per trade. It tells you how many contracts or shares.",
  },
  {
    usual: "Late to the move",
    fix: "Alerts when price hits your level",
    how: "Email and in-app alerts at your target and stop, and price alerts on the stocks you follow.",
  },
];

// The twelve tools, counted 01 to 12 across the three steps of a trade (the hero promises "12 pro tools"): each step's
// list is an ordered list that starts where the last one stopped. Find leads with the smart scanner's morning ideas,
// which aren't one of the twelve and carry their time instead.
type Tool = { name: string; text: string };

const MORNING = {
  time: "8:30",
  name: "Morning ideas",
  text: "Every trading day at 8:30 AM ET, in the app and your inbox. Long or short, each with an entry, a target, a stop and a suggested option.",
};

function findTools(names: number): Tool[] {
  return [
    { name: "Build an idea", text: "Pick a side, a timeframe and a setup. Get the names that fit right now." },
    { name: "Scanner", text: `All ${names} names ranked on momentum, gaps and where they closed in their range.` },
    { name: "Market score", text: "Volatility, opportunity and direction, scored 0 to 100 before the open." },
    { name: "Insider feed", text: "What company insiders bought and sold in the last 30 days." },
    { name: "Chatter", text: "What other traders are watching, and which way they lean." },
  ];
}

const CHECK: Tool[] = [
  { name: "Suggested option", text: "Strike, expiry, est. cost, est. value at the target and breakeven, for every idea." },
  { name: "Bull and bear case", text: "Both sides, plus straight answers: what would make it wrong, how much room is left, what if it gaps." },
  { name: "Position sizer", text: "Your account size and risk in. Contracts or shares out." },
  { name: "Paste an idea", text: "A tip from a Discord or X, turned into an idea with levels, then followed to its target or stop." },
];

const TRACK: Tool[] = [
  { name: "My trades", text: "Tap \u201cI took this\u201d on any idea, or log your own. Entry, live P&L and notes in one place." },
  { name: "Alerts", text: "Email and in-app alerts at your target and stop. Price alerts on the stocks you follow." },
  { name: "Watchlists", text: "Your own lists with live prices, today's move and the trend, each with its own price alert." },
];

/** One step's tools, numbered from `start` (the numbers are the list's own, drawn in landing.css), the first one lit. */
function ToolList({ tools, start, label, lead }: { tools: Tool[]; start: number; label: string; lead?: typeof MORNING }) {
  return (
    <div className="hs-toolcol">
      {lead && (
        <div className="hs-tools__lead" data-reveal="">
          <h3 className="hs-tools__name">
            <span className="hs-tools__n">{lead.time}</span>
            {lead.name}
          </h3>
          <p>{lead.text}</p>
        </div>
      )}
      <ol className="hs-tools" start={start} aria-label={label} style={{ counterReset: `tool ${start - 1}` }}>
        {tools.map((t, i) => (
          <li key={t.name} className={!lead && i === 0 ? "is-on" : undefined} data-reveal="" style={at(i + (lead ? 1 : 0))}>
            <h3 className="hs-tools__name">{t.name}</h3>
            <p>{t.text}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** What the price buys, as the pricing section lists it. */
function included(library: Library | null) {
  return [
    "The smart scanner's ideas, 8:30 AM ET every trading day",
    "12 pro tools to find, check, size and track trades",
    "Alerts at your target and stop, by email and in the app",
    library ? `HighStrike Trading School: ${library.modules} modules, ${library.lessons} lessons` : "HighStrike Trading School, every module",
    "The app on your phone, and every future update",
  ];
}

// The comparison, features only (Ben, 2026-11-03: no prices; "Keep, rewritten"). "some" is a fair "it depends".
type Mark = "yes" | "no" | "some";
const COMPARE: { row: string; marks: [Mark, Mark, Mark, Mark] }[] = [
  { row: "Trade ideas every morning", marks: ["yes", "yes", "no", "no"] },
  { row: "Build your own ideas on demand", marks: ["yes", "no", "yes", "no"] },
  { row: "A suggested option for every idea", marks: ["yes", "some", "no", "no"] },
  { row: "Entry, target and stop before you buy", marks: ["yes", "some", "no", "no"] },
  { row: "A bull and bear case for every idea", marks: ["yes", "no", "no", "no"] },
  { row: "Check any tip you're sent", marks: ["yes", "no", "no", "no"] },
  { row: "Position sizing for every trade", marks: ["yes", "no", "no", "some"] },
  { row: "Your trades tracked, with alerts at target and stop", marks: ["yes", "no", "some", "no"] },
  { row: "Lessons from the basics to advanced strategies", marks: ["yes", "some", "no", "yes"] },
  { row: "Ideas, tools, alerts and lessons in one membership", marks: ["yes", "no", "no", "no"] },
];
const COMPARE_COLS = ["HighStrike", "An alerts Discord", "A scanner app", "An options course"];

/** An idea's stop: 8% against the entry, as every idea is graded. */
const stopOf = (s: { entry: number; direction: string }) => s.entry * (s.direction.toLowerCase() === "short" ? 1.08 : 0.92);

/** The first close past an idea's target after it came out, and the move from the entry to it. */
function exitOf(h: HeroSetup) {
  const from = entryIndexOf(h.closes, h.setup);
  const i = hitIndex(h.closes, h.setup, from);
  if (i < 0) return null;
  const c = h.closes[i];
  const short = h.setup.direction.toLowerCase() === "short";
  return { date: c.date, close: c.close, move: ((short ? h.setup.entry - c.close : c.close - h.setup.entry) / h.setup.entry) * 100 };
}

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
  // How many names the smart scanner ranks each morning (the symbols list).
  const names = movers.length || 48;
  const rule = hero ? priceRuleMet(hero) : null;
  const exit = hero ? exitOf(hero) : null;
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
      {/* The first screen: the promise, and three cards from the product */}
      <section className="hs-room hs-hero" aria-labelledby="hs-title">
        <Field spy={spy} qqq={qqq} seed={11} />
        <div className="hs-wrap hs-hero__grid">
          <div className="hs-hero__copy">
            <h1 id="hs-title" className="hs-display hs-h1">
              <span className="hs-line" data-reveal="">
                Better
              </span>
              <span className="hs-line" data-reveal="" style={at(1)}>
                options trades
              </span>
              <span className="hs-line" data-reveal="" style={at(2)}>
                <Tag className="hs-tag--land">Less guesswork</Tag>
              </span>
            </h1>
            <p className="hs-lead" data-reveal="" style={at(3)}>
              One platform for the whole trade: ideas from the smart scanner, 12 pro tools to check and size them, and alerts at your target and stop.
            </p>
            <div id="hero-cta" className="hs-hero__actions" data-reveal="" style={at(4)}>
              <JoinButton className="hs-btn">Try it for {TRIAL_PRICE}</JoinButton>
              <a href="#find" className="hs-link">
                See how it works
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
                  <span className="hs-trio__k">Trading School</span>
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
              <a href="#find" className="hs-glass hs-trio__scan" data-ui="">
                <span className="hs-trio__k">Scanner · {slateToday ? "this morning" : "latest"}</span>
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
              <a href="#check" className="hs-glass hs-trio__idea" data-ui="">
                <span className="hs-trio__k">{slateToday ? "Today's top idea" : "Latest top idea"}</span>
                <span className="hs-trio__tk">
                  {top.ticker} <Pill tone={top.direction.toLowerCase() === "short" ? "red" : "green"}>{sideLabel(top.direction)}</Pill>
                </span>
                <span className="hs-trio__note">Entry, target, stop and a suggested option inside.</span>
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
            <figcaption className="hs-sr">HighStrike at a glance: a Trading School module, this morning&apos;s scanner and its top idea.</figcaption>
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

      {/* Why options trades lose: five mistakes, each beside the part of HighStrike that fixes it */}
      <section id="why" className="hs-room hs-section hs-why" aria-labelledby="hs-why-title">
        <Field spy={spy} qqq={qqq} seed={14} />
        <div className="hs-wrap">
          <div className="hs-section-head">
            <h2 id="hs-why-title" className="hs-display hs-h2" data-reveal="">
              Why most options trades lose
            </h2>
            <p className="hs-lead" data-reveal="" style={at(1)}>
              Five mistakes do most of the damage. HighStrike has a fix for each one, on one platform.
            </p>
          </div>
          <div className="hs-glass hs-ledger" data-land="">
            <table>
              <thead>
                <tr>
                  <th scope="col">The usual way</th>
                  <th scope="col">The HighStrike way</th>
                </tr>
              </thead>
              <tbody>
                {LEDGER.map((r) => (
                  <tr key={r.usual}>
                    <th scope="row" className="hs-ledger__usual">
                      {r.usual}
                    </th>
                    <td className="hs-ledger__fix">
                      <b>{r.fix}</b>
                      <span>{r.how}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hs-why__next" data-reveal="">
            Here&apos;s the whole trade on HighStrike: <a href="#find">find it</a>, <a href="#check">check it</a>, <a href="#track">track it</a>.
          </p>
        </div>
      </section>

      {/* 01 Find: the smart scanner's morning ideas and the tools that find trades, beside the desk with this morning's real numbers */}
      <section id="find" className="hs-room hs-section hs-desk" aria-labelledby="hs-find-title">
        <Field spy={spy} qqq={qqq} seed={25} />
        <div className="hs-wrap">
          <div className="hs-section-head">
            <h2 id="hs-find-title" className="hs-display hs-h2" data-reveal="">
              Find the trade
            </h2>
            <p className="hs-lead" data-reveal="" style={at(1)}>
              The smart scanner does the first pass. At 8:30 AM ET it ranks {names} names and turns the strongest into the day&apos;s ideas. Want something specific? Build your own in seconds.
            </p>
          </div>
          <div className="hs-desk__grid">
            <ToolList label="Tools for finding trades" lead={MORNING} tools={findTools(names)} start={1} />
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

      {/* 02 Check: the tools that check an idea, beside a real one the morning its price rule held */}
      <section id="check" className="hs-room hs-section hs-how" aria-labelledby="hs-check-title">
        <Field spy={spy} qqq={qqq} seed={18} />
        <div className="hs-wrap">
          <div className="hs-section-head">
            <h2 id="hs-check-title" className="hs-display hs-h2" data-reveal="">
              Check it before you buy
            </h2>
            <p className="hs-lead" data-reveal="" style={at(1)}>
              Every idea opens to the full picture: the plan, the case for and against, the option and the size. Paste in a tip from anywhere and it gets the same treatment.
            </p>
          </div>
          <div className="hs-desk__grid">
            <ToolList label="Tools for checking a trade" tools={CHECK} start={6} />
            {hero && (
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
                  <div className="hs-plan hs-plan--4">
                    <div>
                      <span className="hs-lbl">Entry</span>
                      <b>{price(hero.setup.entry)}</b>
                    </div>
                    <div>
                      <span className="hs-lbl">Target</span>
                      <b className="hs-up">{price(hero.setup.target)}</b>
                    </div>
                    <div>
                      <span className="hs-lbl">Stop</span>
                      <b className="hs-dn">{price(stopOf(hero.setup))}</b>
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
                    sub={`${shortDate(rule.date)} close ${price(rule.close)}, ${rule.short ? "below" : "above"} ${price(rule.trigger)}`}
                    side="Alert"
                    sideNote={shortDate(rule.date)}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 03 Track: My trades, alerts and watchlists, beside a recent idea followed to its exit */}
      <section id="track" className="hs-room hs-section hs-track" aria-labelledby="hs-track-title">
        <Field spy={spy} qqq={qqq} seed={21} />
        <div className="hs-wrap">
          <div className="hs-section-head">
            <h2 id="hs-track-title" className="hs-display hs-h2" data-reveal="">
              Track it to the exit
            </h2>
            <p className="hs-lead" data-reveal="" style={at(1)}>
              Took the trade? One tap logs it. HighStrike watches your target and stop and alerts you when price gets there.
            </p>
          </div>
          <div className="hs-desk__grid">
            <ToolList label="Tools for tracking a trade" tools={TRACK} start={10} />
            {hero && exit && (
              <div className="hs-stage" data-land="">
                <div className="hs-glass hs-ticket hs-track__card" data-ui="">
                  <div className="hs-ui-head">
                    <span className="hs-ui-head__tk">{hero.setup.ticker}</span>
                    <span className="hs-dot" />
                    <span className="hs-ui-head__nm">{sideLabel(hero.setup.direction)}</span>
                    <span className="hs-ui-head__sp">
                      <Pill>Target hit</Pill>
                    </span>
                  </div>
                  <p className="hs-fine hs-ticket__when">An example: a recent idea, followed to its exit</p>
                  <div className="hs-plan hs-plan--4">
                    <div>
                      <span className="hs-lbl">Entry</span>
                      <b>{price(hero.setup.entry)}</b>
                    </div>
                    <div>
                      <span className="hs-lbl">Target</span>
                      <b className="hs-up">{price(hero.setup.target)}</b>
                    </div>
                    <div>
                      <span className="hs-lbl">Stop</span>
                      <b className="hs-dn">{price(stopOf(hero.setup))}</b>
                    </div>
                    <div>
                      <span className="hs-lbl">Move</span>
                      <b className="hs-up">{signedPct(exit.move, 2)}</b>
                    </div>
                  </div>
                  <ol className="hs-track__log">
                    <li>
                      <time dateTime={hero.setup.reportDate}>{shortDate(hero.setup.reportDate)}</time>
                      <span>
                        Idea out before the open, entry <b>${price(hero.setup.entry)}</b>
                      </span>
                    </li>
                    <li>
                      <time dateTime={exit.date}>{shortDate(exit.date)}</time>
                      <span>
                        Closes past the target at <b>${price(exit.close)}</b>. Your alert fires.
                      </span>
                    </li>
                  </ol>
                </div>
                <Toast
                  className="hs-stage__alert"
                  icon="bell"
                  title={`${hero.setup.ticker} reached your target`}
                  sub={`Closed at ${price(exit.close)}, past ${price(hero.setup.target)}`}
                  side="Alert"
                  sideNote={shortDate(exit.date)}
                />
              </div>
            )}
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
                    Learn the why at
                  </span>
                  <span className="hs-line" data-reveal="" style={at(1)}>
                    <Tag className="hs-tag--land">Trading School</Tag>
                  </span>
                </h2>
                <p className="hs-lead" data-reveal="" style={at(2)}>
                  The tools tell you what. Trading School tells you why: {course.length} modules and {lessons} lessons
                  {recorded > 0 ? `, ${recorded} of them recorded live sessions` : ""}, from your first call to selling premium for income, built by traders teaching since 2018. Included.
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
                The whole desk on your <Tag className="hs-tag--land">phone</Tag>
              </h2>
              <p className="hs-lead" data-reveal="" style={at(2)}>
                Add highstrike.com to your home screen and it opens like an app: the morning&apos;s ideas, your alerts, My trades and Trading School, wherever you are.
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
              One platform instead of three
            </h2>
            <p className="hs-lead" data-reveal="" style={at(1)}>
              Most traders stitch it together: an alerts Discord, a scanner app and an options course. HighStrike does all three jobs in one place.
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
              Everything opens the second you pay: the morning ideas, all 12 tools, alerts, Trading School and the app. Then {MONTHLY_PRICE}/month. Cancel anytime in a couple of clicks.
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
                <dd>Ideas, 12 tools, alerts, School</dd>
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
          <FaqIndex title="Questions" faqs={faqsFor(library, names)} />
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
              Your next options trade deserves a plan.
            </h2>
            <p className="hs-lead" data-reveal="" style={at(1)}>
              Ideas at 8:30 AM ET, 12 pro tools and alerts at your target and stop. {TRIAL_PRICE} for your first week.
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
