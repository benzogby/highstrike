import type { Metadata } from "next";
import Link from "next/link";
import BellClock from "@/components/landing/BellClock";
import FaqIndex from "@/components/landing/FaqIndex";
import HowItWorks from "@/components/landing/HowItWorks";
import TickerLookup from "@/components/landing/TickerLookup";
import {
  AlertFeed,
  AlertToast,
  Briefing,
  GradedStamp,
  InsiderChatter,
  ScannerSlice,
  SchoolModules,
  SetupCard,
  WeatherRow,
  price,
  shortDate,
  sideLabel,
  signedPct,
  statusLabel,
} from "@/components/landing/Fragments";
import { LOOKUP_START, getLandingData, getTickerRead, type ClosedSetup, type TickerRead } from "./data";

// The homepage, built with Taste Skill's "The product performs" direction in
// the site's own light system: HighStrike's real morning output, as working
// fragments of the terminal, is the picture on every screen. Styles in
// landing.css. Refresh the live report, setups and record every 30 minutes.
export const revalidate = 1800;

export const metadata: Metadata = {
  title: "HighStrike — Finished trades before the bell",
  description:
    "Every morning HighStrike's AI scans 5,400+ stocks and publishes the day's options setups with the entry, the target and the reasoning. $99 a month, first 7 days free.",
  openGraph: {
    title: "HighStrike — Finished trades before the bell",
    description:
      "Every morning HighStrike's AI scans 5,400+ stocks and publishes the day's options setups with the entry, the target and the reasoning.",
    type: "website",
  },
};

const TRIAL = "/signup";

const faqs = [
  {
    q: "What do I get for $99 a month?",
    a: "Everything: the AI terminal with market weather, the flow scanner, insider filings and alerts; the daily setups with entry, target, time window and suggested contracts; and the full Trading School. One plan, no upsells.",
  },
  {
    q: "How does the free trial work?",
    a: "You start with 7 days free. Cancel from your account before day 7 and you pay nothing; after that it is $99 a month, and you can cancel any time.",
  },
  {
    q: "When do setups publish?",
    a: "Before the open on every market day. The report and the slate are ready before 9:30 ET, and an alert arrives when a setup's entry rules trigger.",
  },
  {
    q: "Do I connect my brokerage?",
    a: "No, and you can't. HighStrike is analytics software: it never touches your broker, your positions or your money. You trade wherever you already trade.",
  },
  {
    q: "What experience do I need?",
    a: "You should know what a call and a put are. Every setup is a worked example with its reasoning written out, and Trading School covers the rest.",
  },
  {
    q: "Is this financial advice?",
    a: "No. HighStrike is an analytics and education tool, and setups are market commentary, not recommendations. Trading involves substantial risk, including loss of principal.",
  },
];

const steps = [
  {
    lead: "Overnight",
    text: "The scanner ranks 5,400+ stocks by options flow, relative volume and momentum, and keeps the names whose flow has broken from their own baseline.",
  },
  {
    lead: "Before the open",
    text: "The AI writes each finalist up as a setup: the price that has to hold, the target, the time window and the reasoning, in plain English.",
  },
  {
    lead: "When the price agrees",
    text: "The entry rules trigger and an alert goes out. Until then the setup waits, and nothing is published after the fact.",
  },
  {
    lead: "After it closes",
    text: "Every setup is graded against real prices, hit or miss, and the result joins the public record below.",
  },
];

// The record table reads newest day first; the date prints once per day.
function byDay(closed: ClosedSetup[]) {
  return [...closed].sort((a, b) => (a.reportDate < b.reportDate ? 1 : a.reportDate > b.reportDate ? -1 : a.ticker.localeCompare(b.ticker)));
}

function mondayOf(d: Date) {
  const day = (d.getUTCDay() + 6) % 7;
  const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day));
  return m.toISOString().slice(0, 10);
}

export default async function Home() {
  const { report, today, closed, spy, stats, weeks, movers, lookup, badges } = await getLandingData();

  const example = closed.find((c) => c.status === "target_hit" && c.criteria.length > 0) ?? closed.find((c) => c.criteria.length > 0) ?? null;
  const reads = (await Promise.all(today.slice(0, 3).map((t) => getTickerRead(t.ticker)))).filter((r): r is TickerRead => r != null);
  // The day after a holiday repeats the last close, so every move reads zero:
  // the band only shows when the last session really moved.
  const band = movers.some((m) => m.changePct !== 0) ? movers.slice(0, 14) : [];
  const session = spy[spy.length - 1]?.date;
  const alerts = closed.filter((c) => c.status === "target_hit" && c.criteria.length > 0).slice(0, 3);

  // The bar the page is about: the last full week of grading.
  const thisWeek = mondayOf(new Date());
  const accentWeek = [...weeks].reverse().find((w) => w.week < thisWeek)?.week;
  const maxClosed = Math.max(1, ...weeks.map((w) => w.closed));

  const rows = byDay(closed);

  return (
    <main>
      {/* Hero: the promise upper left, this morning's briefing filling the rest */}
      <section className="hs-wrap hs-hero" aria-labelledby="hs-title">
        <div className="hs-hero__text">
          <h1 id="hs-title" className="hs-display hs-lines">
            <span className="hs-line">
              <span data-line="" style={{ "--i": 0 } as React.CSSProperties}>
                Finished trades
              </span>
            </span>
            <span className="hs-line">
              <span data-line="" style={{ "--i": 1 } as React.CSSProperties}>
                before the bell
              </span>
            </span>
          </h1>
          <p className="hs-hero__lead hs-body" data-load="" style={{ "--d": "420ms" } as React.CSSProperties}>
            Every morning HighStrike&apos;s AI scans 5,400+ stocks and publishes the day&apos;s options setups: the entry,
            the target and the reasoning.
          </p>
          <div data-load="" style={{ "--d": "500ms" } as React.CSSProperties}>
            <div className="hs-hero__actions">
              <Link href={TRIAL} className="hs-button">
                Start free trial
              </Link>
              <a href="#lookup" className="hs-link">
                Look up a ticker
              </a>
            </div>
            <p className="hs-hero__price hs-small hs-muted">$99 a month after a 7-day free trial. Cancel anytime.</p>
          </div>
          <BellClock className="hs-hero__bell" />
        </div>
        <figure className="hs-hero__figure" data-open="">
          <Briefing report={report} today={today} spy={spy} />
          <figcaption className="sr-only-hs">This morning&apos;s HighStrike briefing, live.</figcaption>
        </figure>
      </section>

      {/* The last session's biggest moves among the names the desk follows */}
      {band.length > 0 && (
        <section className="hs-marquee" aria-labelledby="hs-marquee-note">
          <input type="checkbox" id="hs-marquee-pause" className="hs-marquee__toggle sr-only-hs" />
          <div className="hs-marquee__track">
            {[...band, ...band].map((m, i) => (
              <span key={`${m.ticker}-${i}`} className="hs-marquee__item" aria-hidden={i >= band.length ? true : undefined}>
                <span>{m.ticker}</span>
                <span className={m.changePct >= 0 ? "hs-up" : "hs-down"}>{signedPct(m.changePct)}</span>
              </span>
            ))}
          </div>
          <div className="hs-wrap hs-marquee__foot">
            <p id="hs-marquee-note" className="hs-small hs-muted">
              The biggest moves among the stocks HighStrike follows, {session ? `${shortDate(session)} close` : "last session"}.
            </p>
            <label htmlFor="hs-marquee-pause" className="hs-marquee__pause">
              <span className="sr-only-hs">Pause the moving list</span>
              <svg className="when-on" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                <rect x="2.5" y="1.5" width="3" height="11" rx="1" fill="currentColor" />
                <rect x="8.5" y="1.5" width="3" height="11" rx="1" fill="currentColor" />
              </svg>
              <svg className="when-off" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                <path d="M3.5 1.8v10.4a.8.8 0 0 0 1.2.7l8.3-5.2a.8.8 0 0 0 0-1.4L4.7 1.1a.8.8 0 0 0-1.2.7Z" fill="currentColor" />
              </svg>
            </label>
          </div>
        </section>
      )}

      {/* The live thing: type a ticker, read what the desk has on it */}
      <section id="lookup" className="hs-wrap hs-lookup" aria-labelledby="hs-lookup-title">
        <h2 id="hs-lookup-title" className="sr-only-hs">
          Look up a ticker
        </h2>
        <div className="hs-lookup__grid">
          <TickerLookup start={LOOKUP_START} initial={lookup} examples={["CVX", "TSLA", "SPY", "HD"]} tracked={movers.length || 48} />
          <figure className="hs-lookup__photo" data-reveal="" style={{ "--i": 1 } as React.CSSProperties}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/landing/lower-manhattan-sunrise.jpg"
              alt="The Lower Manhattan skyline at sunrise, seen across the harbor, One World Trade Center at the left"
              width={1600}
              height={900}
              loading="lazy"
              decoding="async"
            />
            <figcaption>Lower Manhattan, 7:20 a.m.</figcaption>
          </figure>
        </div>
      </section>

      {/* How a setup happens: the fragment pinned while four statements change it */}
      <section id="how" className="hs-wrap hs-story">
        <HowItWorks
          title="How a setup happens"
          steps={steps}
          stages={[
            <ScannerSlice key="scan" today={today} movers={movers} />,
            example ? <SetupCard key="setup" setup={example} /> : null,
            example ? (
              <div key="alert" style={{ position: "relative", paddingTop: 36 }}>
                <SetupCard setup={example} />
                <AlertToast
                  setup={example}
                  style={{ position: "absolute", top: 0, left: 28, right: 28, boxShadow: "0 18px 40px -18px rgba(10,11,13,0.35)" }}
                />
              </div>
            ) : null,
            example ? <GradedStamp key="graded" setup={example} /> : null,
          ]}
        />
      </section>

      {/* Everything on the desk: six cells, fragments docked in a checkerboard */}
      <section className="hs-wrap hs-desk" aria-labelledby="hs-desk-title">
        <h2 id="hs-desk-title" className="hs-heading" data-reveal="">
          Everything on the desk
        </h2>
        <div className="hs-cells">
          {[
            {
              title: "Market weather",
              text: "Volatility, opportunity and direction, scored 0 to 100 before every open, with a written note on the tape.",
              frag: report ? <WeatherRow report={report} /> : null,
            },
            {
              title: "Flow scanner",
              text: "5,400+ stocks ranked by options flow against their own baseline, not the market's.",
              frag: <ScannerSlice today={today} movers={movers} className="hs-cell__frag" />,
            },
            {
              title: "Trade setups",
              text: "Entry rules, a target, a time window and suggested contracts on every idea, with the reasoning.",
              frag: example ? <SetupCard setup={example} className="hs-cell__frag" /> : null,
            },
            {
              title: "Alerts",
              text: "A message the moment a setup's entry rules trigger, so you are not watching the tape all day.",
              frag: alerts.length ? <AlertFeed setups={alerts} className="hs-cell__frag" /> : null,
            },
            {
              title: "Insiders and chatter",
              text: "Form 4 buys and sells from the last 30 days and the crowd's mood, on every name on the slate.",
              frag: reads.length ? <InsiderChatter reads={reads} className="hs-cell__frag" /> : null,
            },
            {
              title: "Trading School",
              text: "The full HighStrike curriculum, from options mechanics to grading your own trades, included.",
              frag: <SchoolModules className="hs-cell__frag" />,
            },
          ].map((c, i) => (
            <article
              key={c.title}
              className={`hs-cell${[1, 3, 5].includes(i) ? " hs-cell--flip" : ""}`}
              data-reveal=""
              style={{ "--i": i % 3 } as React.CSSProperties}
            >
              <div className="hs-cell__text">
                <h3>{c.title}</h3>
                <p>{c.text}</p>
              </div>
              {c.frag}
            </article>
          ))}
        </div>
      </section>

      {/* The record, as a table: the latest closed setups, wins and losses */}
      {rows.length > 0 && (
        <section id="record" className="hs-wrap hs-record" aria-labelledby="hs-record-title">
          <h2 id="hs-record-title" className="hs-display hs-record__title hs-lines hs-mask">
            <span className="hs-line">
              <span data-line="">Graded</span>
            </span>
            <span className="hs-line">
              <span data-line="" style={{ "--i": 1 } as React.CSSProperties}>
                in public
              </span>
            </span>
          </h2>
          <p className="hs-record__lead hs-body hs-muted" data-reveal="" style={{ "--i": 1 } as React.CSSProperties}>
            Every setup is recorded with its entry and target, then graded automatically against real prices. Wins and
            losses stay on the page.
          </p>
          <table data-reveal="" style={{ "--i": 2 } as React.CSSProperties}>
            <caption className="sr-only-hs">The most recently closed setups</caption>
            <thead>
              <tr>
                <th scope="col">
                  <span className="sr-only-hs">Published</span>
                </th>
                <th scope="col">
                  <span className="sr-only-hs">Setup</span>
                </th>
                <th scope="col">
                  <span className="sr-only-hs">Plan</span>
                </th>
                <th scope="col">
                  <span className="sr-only-hs">Result</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c, i) => (
                <tr key={`${c.ticker}-${c.reportDate}`}>
                  <td className="date">{i === 0 || rows[i - 1].reportDate !== c.reportDate ? shortDate(c.reportDate) : ""}</td>
                  <td>
                    <span className="ticker">{c.ticker}</span>
                    <span className={c.direction.toLowerCase() === "short" ? "hs-down" : "hs-up"}>{sideLabel(c.direction)}</span>
                  </td>
                  <td className="plan hs-num">
                    ${price(c.entry)} to ${price(c.target)}
                    {c.timeFrame ? `, ${c.timeFrame}` : ""}
                  </td>
                  <td className="right hs-num">
                    <span className="hs-muted">{statusLabel(c.status)}</span>{" "}
                    {c.resultPct != null && <span className={c.resultPct >= 0 ? "hs-up" : "hs-down"}>{signedPct(c.resultPct)}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="hs-small" style={{ marginTop: 28 }}>
            <Link href="/results" className="hs-link">
              The full record and methodology
            </Link>
          </p>
        </section>
      )}

      {/* The record as a series: setups closed per week, standing on the edge */}
      {stats && weeks.length > 0 && (
        <section className="hs-bars" aria-labelledby="hs-bars-title">
          <div className="hs-wrap">
            <p className="hs-display hs-bars__figure hs-lines hs-mask" aria-hidden="true">
              <span className="hs-line">
                <span data-line="">{stats.closedCount}</span>
              </span>
            </p>
            <h2 id="hs-bars-title" className="hs-heading hs-bars__claim">
              <span className="sr-only-hs">{stats.closedCount} </span>
              Setups graded since August
            </h2>
            <p className="hs-body hs-muted" style={{ marginTop: 12, maxWidth: "48ch" }}>
              {stats.winRate != null ? `${stats.winRate}% hit their target. ` : ""}
              {stats.avgGain != null ? `Average gain ${signedPct(stats.avgGain, 1)}, ` : ""}
              {stats.avgLoss != null ? `average loss ${signedPct(stats.avgLoss, 1)}.` : ""}
            </p>
          </div>
          <div className="hs-bars__grid" data-ui="" role="list" aria-label="Setups closed per week">
            {weeks.map((w, i) => {
              const label = `Week of ${shortDate(w.week)}: ${w.closed} closed, ${w.hits} hit target`;
              return (
                <div
                  key={w.week}
                  role="listitem"
                  tabIndex={0}
                  aria-label={label}
                  className={`hs-bar${w.week === accentWeek ? " hs-bar--accent" : ""}`}
                  style={{ "--i": i, "--pct": Math.round((w.closed / maxClosed) * 100) } as React.CSSProperties}
                >
                  <span className="hs-bar__tip" aria-hidden="true">
                    {label}
                  </span>
                  <span className="hs-bar__value" aria-hidden="true">
                    {w.closed}
                  </span>
                  <span className="hs-bar__fill" aria-hidden="true" />
                  <span className="hs-bar__week" aria-hidden="true">
                    {shortDate(w.week)}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* One plan, the price very large */}
      <section id="pricing" className="hs-wrap hs-price" aria-labelledby="hs-price-title">
        {/* Four parts: on wide screens the intro and the list share the left
            column and the price and the action the right; on narrow ones they
            stack as a price card would: intro, price, list, action. */}
        <div className="hs-price__grid">
          <div className="hs-price__intro" data-reveal="">
            <h2 id="hs-price-title" className="hs-heading">
              One plan, everything in it
            </h2>
            <p className="hs-body hs-muted">
              The terminal, the daily setups and the full Trading School, for one price. {badges.traders} traders in{" "}
              {badges.countries} countries have learned with HighStrike since 2018.
            </p>
          </div>
          <div className="hs-display hs-price__figure" data-reveal="" style={{ "--i": 1 } as React.CSSProperties}>
            <span className="hs-price__cur">$</span>
            <span data-roll="">99</span>
            <span className="hs-price__per">per month</span>
          </div>
          <ul className="hs-price__list" data-reveal="">
            <li>The AI terminal and flow scanner</li>
            <li>Daily setups with entry, target and reasoning</li>
            <li>Trading School, the full curriculum</li>
            <li>Alerts when a setup triggers</li>
          </ul>
          <div className="hs-price__cta" data-reveal="" style={{ "--i": 1 } as React.CSSProperties}>
            <Link href={TRIAL} className="hs-button">
              Start free trial
            </Link>
            <span className="hs-small hs-muted">7 days free, then $99 a month. Cancel anytime.</span>
          </div>
        </div>
      </section>

      {/* Questions: an index and one answer */}
      <section className="hs-wrap hs-faq" aria-label="Questions">
        <FaqIndex title="Questions" faqs={faqs} />
      </section>

      {/* The close: one row of tiles, cropped by both edges */}
      <section className="hs-wrap hs-close" aria-labelledby="hs-close-title">
        <div className="hs-tiles">
          <div className="hs-tile hs-tile--main">
            <h2 id="hs-close-title" className="hs-heading">
              Start before tomorrow&apos;s open
            </h2>
            <p>Seven days free, then $99 a month. Tomorrow&apos;s slate publishes before 9:30 ET.</p>
            <div>
              <Link href={TRIAL} className="hs-button hs-button--ink">
                Start free trial
              </Link>
            </div>
          </div>
          <div className="hs-tiles__pair">
            <div className="hs-tile hs-tile--photo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/landing/nyse-trading-floor.jpg"
                alt="A wall of trading screens on the floor of the New York Stock Exchange, two traders in silhouette"
                width={1600}
                height={1246}
                loading="lazy"
                decoding="async"
              />
            </div>
            <div className="hs-tile hs-tile--ink" aria-hidden="true" />
          </div>
        </div>
      </section>
    </main>
  );
}
