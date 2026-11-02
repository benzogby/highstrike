import type { Metadata } from "next";
import Link from "next/link";
import DeskSearch from "@/components/landing/DeskSearch";
import FaqIndex from "@/components/landing/FaqIndex";
import Field from "@/components/landing/Field";
import { Bull, Pill, Tag, Toast, Tri, compact, price, shortDate, sideLabel, signedPct, statusLabel, triggerOf, weekdayDate } from "@/components/landing/Pieces";
import SetupChart, { entryIndexOf, hitIndex } from "@/components/landing/SetupChart";
import JoinButton from "@/components/join/JoinButton";
import JoinDialog from "@/components/join/JoinDialog";
import { moduleLabel } from "@/lib/education";
import { LIFETIME_PRICE, lifetimeIncludes, type Library } from "@/lib/offer";
import { LOOKUP_START, getLandingData, type HeroSetup } from "./data";

// The homepage in the HighStrike reels system (design/keyframes-2026-11-02,
// approved by Ben on 2026-11-02): the dark room with one light punch, Cal Sans
// and Inter, HighStrike green for the accent and for gains, red only for
// losses, smoked glass, the price tag as the key word, and live charts drawn
// from HighStrike's real graded setups. Styles in landing.css. Refresh the
// report, setups and record every 30 minutes. It sells one thing (Ben,
// 2026-11-02): $397 once for lifetime access to the daily trades, the tools and
// HighStrike Trading School, bought in the popup (components/join/JoinDialog).
export const revalidate = 1800;

export const metadata: Metadata = {
  title: "HighStrike — Finished trades before the bell",
  description:
    "Every morning HighStrike's AI scans 5,400+ stocks and publishes the day's options setups with the entry, the target and the reasoning. Lifetime access to the trades, the tools and HighStrike Trading School: $397 once.",
  openGraph: {
    title: "HighStrike — Finished trades before the bell",
    description:
      "Every morning HighStrike's AI scans 5,400+ stocks and publishes the day's options setups with the entry, the target and the reasoning.",
    type: "website",
  },
};

// The questions, with the course's real size where the answer gives it.
function faqsFor(library: Library | null) {
  const course = library ? `HighStrike Trading School, ${library.modules} modules and ${library.lessons} lessons` : "all of HighStrike Trading School";
  return [
    {
      q: `What do I get for ${LIFETIME_PRICE}?`,
      a: `Everything, for life: the daily setups with entry, target, time window and suggested contracts; the AI terminal with market weather, the flow scanner, insider filings and alerts; and ${course}, the live recordings included. One payment, no tiers, no upsells.`,
    },
    {
      q: "Is it really one payment?",
      a: `Yes. ${LIFETIME_PRICE} once, by card through Stripe. There's no subscription and nothing renews. Lifetime means for as long as HighStrike runs.`,
    },
    {
      q: "How fast do I get in?",
      a: "Right away. Pay in the popup with your email: your account opens under it the moment the payment goes through and you're signed in, today's slate included. Already have an account under that email? It's upgraded instead.",
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
      a: "You should know what a call and a put are. Every setup is a worked example with its reasoning written out, and Trading School covers the rest, from setting up to selling options.",
    },
    {
      q: "Is this financial advice?",
      a: "No. HighStrike is an analytics and education tool, and setups are market commentary, not recommendations. Trading involves substantial risk, including loss of principal.",
    },
  ];
}

const moments = [
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
    text: "Every setup is graded against real prices, hit or miss, and the result joins the public record.",
  },
];

const tools = [
  { name: "Market weather", text: "Volatility, opportunity and direction, scored 0 to 100 before every open, with a written note on the tape." },
  { name: "Flow scanner", text: "5,400+ stocks ranked by options flow against their own baseline, not the market's." },
  { name: "Trade setups", text: "Entry rules, a target, a time window and suggested contracts on every idea." },
  { name: "Alerts", text: "A message the moment a setup's entry rules trigger." },
  { name: "Insiders and chatter", text: "Form 4 sells and buys from the last 30 days, and the crowd's mood." },
  { name: "Trading School", text: "The course beside the desk, from your first setup to selling options, with every live session recorded." },
];

// The first session from the setup's morning whose close met its price rule
// ("fails below $96.00" for a short, "holds above" for a long), up to the hit.
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

export default async function Home() {
  const { report, today, closed, spy, qqq, stats, weeks, movers, hero, reads, lookup, badges, slateToday, course } = await getLandingData();

  const session = spy[spy.length - 1]?.date;
  // The day after a holiday repeats the last close, so every move reads zero:
  // the tape only runs when the last session really moved.
  const tape = movers.some((m) => m.changePct !== 0) ? movers.slice(0, 24) : [];
  const heroHit = hero ? hitIndex(hero.closes, hero.setup, entryIndexOf(hero.closes, hero.setup)) : -1;
  const rule = hero ? priceRuleMet(hero) : null;
  const record = [...closed]
    .sort((a, b) => (a.reportDate < b.reportDate ? 1 : a.reportDate > b.reportDate ? -1 : a.ticker.localeCompare(b.ticker)))
    .slice(0, 7);
  const maxClosed = Math.max(1, ...weeks.map((w) => w.closed));
  const slate = today.map((t) => {
    const cl = reads[t.ticker]?.closes ?? [];
    return { ...t, last: cl[cl.length - 1]?.close ?? null };
  });
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

  return (
    <main className="hs-page">
      {/* The first screen: the promise, and a real graded setup drawing to its target */}
      <section className="hs-room hs-hero" aria-labelledby="hs-title">
        <Field spy={spy} qqq={qqq} seed={11} />
        <div className="hs-wrap hs-hero__grid">
          <div className="hs-hero__copy">
            <h1 id="hs-title" className="hs-display hs-h1">
              <span className="hs-line" data-reveal="">
                Finished trades
              </span>
              <span className="hs-line" data-reveal="" style={{ "--i": 1 } as React.CSSProperties}>
                <Tag className="hs-tag--land">before the bell</Tag>
              </span>
            </h1>
            <p className="hs-lead" data-reveal="" style={{ "--i": 2 } as React.CSSProperties}>
              Every morning HighStrike&apos;s AI scans 5,400+ stocks and publishes the day&apos;s options setups: the entry, the target and the reasoning.
            </p>
            <div className="hs-hero__actions" data-reveal="" style={{ "--i": 3 } as React.CSSProperties}>
              <JoinButton className="hs-btn">Get lifetime access</JoinButton>
              <a href="#lookup" className="hs-link">
                Look up a ticker
              </a>
            </div>
            <p className="hs-hero__price" data-reveal="" style={{ "--i": 3 } as React.CSSProperties}>
              {LIFETIME_PRICE} once for the daily trades, the tools and HighStrike Trading School. No subscription.
            </p>
            {report && (
              <p className="hs-hero__bell" data-reveal="" style={{ "--i": 4 } as React.CSSProperties}>
                <span className="hs-live" aria-hidden="true" />
                <span>
                  <b>{slateToday ? "Today's slate is out" : "The latest slate"}</b> · {weekdayDate(report.date)} · {today.length} setup{today.length === 1 ? "" : "s"}
                </span>
              </p>
            )}
          </div>

          <figure className="hs-stack" data-land="">
            {report && (
              <div className="hs-glass hs-stack__report" data-ui="">
                <div className="hs-ui-head">
                  <span className="hs-ui-head__tk hs-ui-head__tk--sm">Pre-market report</span>
                  <span className="hs-dot" />
                  <span className="hs-ui-head__nm">{weekdayDate(report.date)}</span>
                </div>
                <div className="hs-minis">
                  {[
                    ["Volatility", report.volatility],
                    ["Opportunity", report.opportunity],
                    ["Direction", report.direction],
                  ].map(([label, v]) => (
                    <div key={label} className="hs-mini">
                      <b>{v}</b>
                      <span>{label}</span>
                      <i>
                        <em style={{ width: `${v}%` }} />
                      </i>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {hero && (
              <>
                <div className="hs-glass hs-stack__setup" data-ui="">
                  <div className="hs-ui-head">
                    <span className="hs-ui-head__tk">{hero.setup.ticker}</span>
                    <span className="hs-dot" />
                    <span className="hs-ui-head__nm">{sideLabel(hero.setup.direction)}</span>
                    <span className="hs-ui-head__sp">
                      <Pill>Target hit</Pill>
                    </span>
                  </div>
                  <p className="hs-fine hs-stack__src">
                    Daily closes to the {heroHit >= 0 ? shortDate(hero.closes[heroHit].date) : "last"} close · published {shortDate(hero.setup.reportDate)} before the open
                  </p>
                  <SetupChart
                    id="hero"
                    closes={hero.closes}
                    setup={hero.setup}
                    history={12}
                    headTag
                    result
                    label={`${hero.setup.ticker} ${sideLabel(hero.setup.direction).toLowerCase()} from ${price(hero.setup.entry)} to ${price(hero.setup.target)}, published ${shortDate(hero.setup.reportDate)}${hero.setup.resultPct != null ? `, graded ${signedPct(hero.setup.resultPct)}` : ""}`}
                  />
                </div>
                <Toast
                  className="hs-stack__alert"
                  icon="check"
                  title={`Target hit · ${hero.setup.ticker} ${sideLabel(hero.setup.direction).toLowerCase()}`}
                  sub={`$${price(hero.setup.entry)} to $${price(hero.setup.target)}, published ${shortDate(hero.setup.reportDate)}`}
                  side={<span className="hs-up">{hero.setup.resultPct != null ? signedPct(hero.setup.resultPct) : ""}</span>}
                  sideNote={heroHit >= 0 ? `${shortDate(hero.closes[heroHit].date)} close` : "graded"}
                />
              </>
            )}
            <figcaption className="hs-sr">This morning&apos;s HighStrike report and a recent setup graded against real prices.</figcaption>
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

      {/* How a setup happens: the same real setup, the morning its price rule held */}
      {hero && (
        <section id="how" className="hs-room hs-section hs-how" aria-labelledby="hs-how-title">
          <Field spy={spy} qqq={qqq} seed={18} />
          <div className="hs-wrap">
            <div className="hs-section-head">
              <h2 id="hs-how-title" className="hs-display hs-h2" data-reveal="">
                How a setup happens
              </h2>
              <p className="hs-lead" data-reveal="" style={{ "--i": 1 } as React.CSSProperties}>
                Nothing is published after the fact. A setup is written before the open, waits for its price, and is graded when it closes.
              </p>
            </div>
            <div className="hs-how__grid">
              <ol className="hs-moments">
                {moments.map((m, i) => (
                  <li key={m.lead} className={i === 2 ? "is-on" : i < 2 ? "is-done" : undefined} data-reveal="" style={{ "--i": i } as React.CSSProperties}>
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
                  <p className="hs-fine hs-ticket__when">Published {weekdayDate(hero.setup.reportDate)}, before the open</p>
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

      {/* The light punch: the record, wins and losses */}
      {stats && record.length > 0 && (
        <section id="record" className="hs-punch hs-section hs-graded" aria-labelledby="hs-graded-title">
          <div className="hs-wrap">
            <div className="hs-graded__head">
              <div>
                <h2 id="hs-graded-title" className="hs-display hs-h2" data-reveal="">
                  Graded in public
                </h2>
                <p className="hs-lead" data-reveal="" style={{ "--i": 1 } as React.CSSProperties}>
                  Every setup is recorded with its entry and target, then graded against real prices. Wins and losses stay on the page.
                </p>
              </div>
              <div className="hs-card hs-stats" data-ui="" data-reveal="">
                {stats.winRate != null && (
                  <p className="hs-stat">
                    <span className="hs-stat__v">
                      <svg className="hs-ring" viewBox="0 0 54 54" aria-hidden="true">
                        <circle cx="27" cy="27" r="22" className="hs-ring__track" />
                        <circle cx="27" cy="27" r="22" className="hs-ring__value" pathLength={100} style={{ strokeDasharray: `${stats.winRate} 100` }} transform="rotate(-90 27 27)" />
                      </svg>
                      {stats.winRate.toFixed(1)}%
                    </span>
                    <span className="hs-stat__k">hit their target</span>
                  </p>
                )}
                {stats.avgGain != null && (
                  <p className="hs-stat">
                    <span className="hs-stat__v">
                      <Tag tone="gain">{signedPct(stats.avgGain, 1)}</Tag>
                    </span>
                    <span className="hs-stat__k">average gain</span>
                  </p>
                )}
                {stats.avgLoss != null && (
                  <p className="hs-stat">
                    <span className="hs-stat__v">
                      <Tag tone="loss">{signedPct(stats.avgLoss, 1)}</Tag>
                    </span>
                    <span className="hs-stat__k">average loss</span>
                  </p>
                )}
              </div>
            </div>
            <div className="hs-graded__body">
              <div>
                <p className="hs-figure" data-reveal="">
                  <span className="hs-figure__big">{stats.closedCount}</span>
                  <span className="hs-figure__cap">setups graded since August, every one on the record</span>
                </p>
                {weeks.length > 0 && (
                  <div className="hs-card hs-weeks" data-ui="" data-reveal="">
                    <div className="hs-weeks__head">
                      <h3 className="hs-h3">Closed each week</h3>
                      <span className="hs-weeks__key">
                        <i aria-hidden="true" />
                        Hit the target
                      </span>
                    </div>
                    <div className="hs-weeks__bars" role="list" aria-label="Setups closed each week">
                      {weeks.map((w, i) => (
                        <div
                          key={w.week}
                          role="listitem"
                          aria-label={`Week of ${shortDate(w.week)}: ${w.closed} closed, ${w.hits} hit the target`}
                          className="hs-weeks__bar"
                          style={{ height: `${((w.closed / maxClosed) * 100).toFixed(1)}%`, "--i": i } as React.CSSProperties}
                        >
                          <i style={{ height: `${w.closed ? ((w.hits / w.closed) * 100).toFixed(1) : 0}%` }} />
                        </div>
                      ))}
                    </div>
                    <div className="hs-weeks__x" aria-hidden="true">
                      {weeks.map((w) => (
                        <span key={w.week}>{shortDate(w.week)}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div>
                <div className="hs-card hs-record" data-ui="" data-reveal="" style={{ "--i": 1 } as React.CSSProperties}>
                  <table>
                    <caption className="hs-sr">The most recently graded setups</caption>
                    <thead>
                      <tr>
                        <th scope="col">Published</th>
                        <th scope="col">Setup</th>
                        <th scope="col" className="hs-record__plan">
                          Entry to target
                        </th>
                        <th scope="col" className="hs-record__res">
                          Result
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {record.map((c, i) => {
                        const r = c.resultPct ?? 0;
                        return (
                          <tr key={`${c.ticker}-${c.reportDate}`}>
                            <td className="hs-record__date">{i === 0 || record[i - 1].reportDate !== c.reportDate ? shortDate(c.reportDate) : ""}</td>
                            <td>
                              <span className="hs-record__tk">{c.ticker}</span>
                              <span className={c.direction.toLowerCase() === "short" ? "hs-dn" : "hs-up"}>{sideLabel(c.direction)}</span>
                            </td>
                            <td className="hs-record__plan">
                              ${price(c.entry)} → ${price(c.target)}
                            </td>
                            <td className="hs-record__res">
                              <span className="hs-record__st">{statusLabel(c.status)}</span>
                              <span className={`hs-chip ${r > 0 ? "hs-chip--g" : r < 0 ? "hs-chip--r" : "hs-chip--n"}`}>
                                <Tri up={r >= 0} />
                                {Math.abs(r).toFixed(2)}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="hs-graded__note">
                  Each setup is graded at the close against its own window. The newest seven, {shortDate(record[record.length - 1].reportDate)} to {shortDate(record[0].reportDate)}.{" "}
                  <Link href="/results" className="hs-link">
                    The full record
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* The desk: one terminal, every tool, this morning's real numbers */}
      <section id="desk" className="hs-room hs-section hs-desk" aria-labelledby="hs-desk-title">
        <Field spy={spy} qqq={qqq} seed={25} />
        <div className="hs-wrap">
          <div className="hs-section-head">
            <h2 id="hs-desk-title" className="hs-display hs-h2" data-reveal="">
              Everything on the desk
            </h2>
            <p className="hs-lead" data-reveal="" style={{ "--i": 1 } as React.CSSProperties}>
              One terminal for the whole morning: the market&apos;s weather, the scanner, the setups, the alerts, insider filings and the crowd, with Trading School beside them.
            </p>
          </div>
          <div className="hs-desk__grid">
            <ul className="hs-tools">
              {tools.map((t, i) => (
                <li key={t.name} className={i === 0 ? "is-on" : undefined} data-reveal="" style={{ "--i": i } as React.CSSProperties}>
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
                  <span>Setups</span>
                  <span>Alerts</span>
                  <span>School</span>
                </span>
              </div>
              <div className="hs-term__body">
                <div className="hs-pane">
                  {report && (
                    <>
                      <h4>
                        Market weather <span>{weekdayDate(report.date)}</span>
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
                        {slateToday ? "Today's slate" : "The latest slate"} <span>flow · side · last close</span>
                      </h4>
                      <div className="hs-rows">
                        {slate.map((t) => (
                          <div key={t.ticker} className="hs-row">
                            <span className="hs-row__tk">{t.ticker}</span>
                            <span className="hs-row__flow" aria-label={`Flow score ${t.flowScore ?? 0}`}>
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

      {/* The education package: HighStrike Trading School, as its module index */}
      {library && (
        <section id="trading-school" className="hs-room hs-section hs-school" aria-labelledby="hs-school-title">
          <Field spy={spy} qqq={qqq} seed={29} />
          <div className="hs-wrap">
            <div className="hs-school__head">
              <div>
                <h2 id="hs-school-title" className="hs-display hs-h2">
                  <span className="hs-line" data-reveal="">
                    Trading School
                  </span>
                  <span className="hs-line" data-reveal="" style={{ "--i": 1 } as React.CSSProperties}>
                    <Tag className="hs-tag--land">included</Tag>
                  </span>
                </h2>
                <p className="hs-lead" data-reveal="" style={{ "--i": 2 } as React.CSSProperties}>
                  HighStrike Trading School is the full course: technical analysis, options from the basics to selling them, swing trades, smart money concepts, futures and prop firms, and every live trading and education session, recorded. It opens the day you join.
                </p>
              </div>
              <dl className="hs-school__figs" data-reveal="" style={{ "--i": 3 } as React.CSSProperties}>
                <div>
                  <dt>lessons</dt>
                  <dd>{lessons}</dd>
                </div>
                <div>
                  <dt>modules</dt>
                  <dd>{course.length}</dd>
                </div>
                {recorded > 0 && (
                  <div>
                    <dt>live sessions recorded</dt>
                    <dd>{recorded}</dd>
                  </div>
                )}
              </dl>
            </div>
            <ol className="hs-glass hs-syllabus" data-land="" aria-label="HighStrike Trading School's modules">
              {course.map((m, i) => {
                const { eyebrow, name } = moduleLabel(m.title);
                return (
                  <li key={m.position} className={/recordings/i.test(m.title) ? "is-rec" : undefined} style={{ "--i": i } as React.CSSProperties}>
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

      {/* One payment, sold as an order ticket */}
      <section id="pricing" className="hs-room hs-section hs-pricing" aria-labelledby="hs-pricing-title">
        <Field spy={spy} qqq={qqq} seed={32} />
        <div className="hs-wrap hs-pricing__grid">
          <div>
            <h2 id="hs-pricing-title" className="hs-display hs-h2">
              <span className="hs-line" data-reveal="">
                Everything for life,
              </span>
              <span className="hs-line" data-reveal="" style={{ "--i": 1 } as React.CSSProperties}>
                <Tag className="hs-tag--land">{LIFETIME_PRICE}</Tag> once
              </span>
            </h2>
            <p className="hs-lead" data-reveal="" style={{ "--i": 2 } as React.CSSProperties}>
              One payment opens the daily trades, every tool on the desk and all of HighStrike Trading School. No subscription, nothing renews, and you&apos;re in the moment it goes through.
            </p>
            <ul className="hs-included">
              {lifetimeIncludes(library).map((t, i) => (
                <li key={t} data-reveal="" style={{ "--i": i + 2 } as React.CSSProperties}>
                  {t}
                </li>
              ))}
            </ul>
            <p className="hs-proof" data-reveal="">
              <b>{badges.traders} traders</b> in <b>{badges.countries} countries</b> have learned with HighStrike since 2018.
            </p>
          </div>
          <div className="hs-glass hs-order" data-ui="" data-land="">
            <div className="hs-ui-head">
              <Bull className="hs-bull--sm" />
              <span className="hs-ui-head__tk">HighStrike</span>
              <span className="hs-ui-head__nm">Lifetime</span>
              <span className="hs-ui-head__sp">
                <Pill>One payment</Pill>
              </span>
            </div>
            <dl>
              <div>
                <dt>Access</dt>
                <dd>Trades, tools, Trading School</dd>
              </div>
              <div>
                <dt>Price</dt>
                <dd>{LIFETIME_PRICE}.00 once</dd>
              </div>
              <div>
                <dt>Renews</dt>
                <dd>Never</dd>
              </div>
              <div>
                <dt>Opens</dt>
                <dd>The moment you pay</dd>
              </div>
            </dl>
            <p className="hs-order__due">
              <span>Due today</span>
              <b>{LIFETIME_PRICE}</b>
            </p>
            <JoinButton className="hs-btn hs-btn--wide">Get lifetime access</JoinButton>
            <p className="hs-order__after">By card through Stripe. No subscription, and nothing renews.</p>
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
      <section className="hs-room hs-close" aria-labelledby="hs-close-title">
        <Field spy={spy} qqq={qqq} seed={46} />
        <div className="hs-wrap">
          {map.length > 0 && (
            <div className="hs-glass hs-map" data-ui="" data-reveal="">
              <div className="hs-map__head">
                <span className="hs-map__tk">The desk&apos;s {map.length} names</span>
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
              Start before tomorrow&apos;s open
            </h2>
            <p className="hs-lead" data-reveal="" style={{ "--i": 1 } as React.CSSProperties}>
              {LIFETIME_PRICE} once and you&apos;re in for life. Tomorrow&apos;s slate is out before 9:30 ET.
            </p>
            <div data-reveal="" style={{ "--i": 2 } as React.CSSProperties}>
              <JoinButton className="hs-btn">Get lifetime access</JoinButton>
            </div>
          </div>
        </div>
      </section>
      <JoinDialog library={library} />
    </main>
  );
}
