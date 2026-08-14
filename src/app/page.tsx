import Header, { Logo } from "@/components/Header";
import HeroChart from "@/components/HeroChart";
import TickerTape from "@/components/TickerTape";
import WaitlistForm from "@/components/WaitlistForm";

const features = [
  {
    title: "Real-time screening",
    body: "Scan the entire market on price action, volume, volatility, and 60+ technical and fundamental filters — results update as the tape moves.",
    icon: "M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z",
  },
  {
    title: "Flow & momentum signals",
    body: "Unusual volume, relative strength, and momentum regime detection distilled into a single flow score per ticker.",
    icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6",
  },
  {
    title: "Institutional-grade charts",
    body: "Fast, keyboard-driven charting with drawing tools, multi-timeframe layouts, and indicator overlays that don't fight you.",
    icon: "M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z",
  },
  {
    title: "Watchlists that think",
    body: "Alerts on breakouts, gap fills, and level breaks across every list — pushed to you the moment they trigger.",
    icon: "M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9",
  },
  {
    title: "Backtest without code",
    body: "Turn any screen into a strategy and test it against a decade of data — entry, exit, sizing, and drawdown, no notebook required.",
    icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  {
    title: "Data you can export",
    body: "Every table, every screen, every backtest — CSV and API access on paid plans. Your research belongs to you.",
    icon: "M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3",
  },
];

const tiers = [
  {
    name: "Scout",
    price: "$0",
    cadence: "forever",
    blurb: "Get a feel for the terminal.",
    features: ["Delayed market data", "3 watchlists", "10 screens per day", "Community support"],
    cta: "Join the waitlist",
    highlight: false,
  },
  {
    name: "Operator",
    price: "$29",
    cadence: "per month",
    blurb: "For active traders who live in the market.",
    features: [
      "Real-time data",
      "Unlimited screens & watchlists",
      "Flow & momentum signals",
      "Breakout alerts",
      "No-code backtesting",
    ],
    cta: "Join the waitlist",
    highlight: true,
  },
  {
    name: "Desk",
    price: "$99",
    cadence: "per month",
    blurb: "For pros, teams, and data-hungry quants.",
    features: [
      "Everything in Operator",
      "API & CSV export",
      "Multi-seat workspaces",
      "Priority support",
    ],
    cta: "Join the waitlist",
    highlight: false,
  },
];

const faqs = [
  {
    q: "When does Highstrike launch?",
    a: "We're onboarding the waitlist in cohorts through the fall. Early access members get the Operator tier free during beta and founder pricing at launch.",
  },
  {
    q: "Where does the market data come from?",
    a: "Consolidated US equity market data from licensed providers. Free accounts get delayed data; paid tiers stream real-time quotes, volume, and volatility metrics.",
  },
  {
    q: "Is this financial advice?",
    a: "No. Highstrike is an analytics and data tool. Nothing in the product is a recommendation to buy or sell any security — trading involves substantial risk of loss.",
  },
  {
    q: "Do I need to know how to code?",
    a: "No. Screening, alerts, and backtesting are fully visual. If you do write code, the Desk tier exposes everything over a clean REST API.",
  },
];

export default function Home() {
  return (
    <>
      <Header />
      <TickerTape />

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="hero-grid absolute inset-0" aria-hidden="true" />
          <div className="glow absolute inset-0" aria-hidden="true" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 pb-24 pt-20 lg:grid-cols-2 lg:pt-28">
            <div>
              <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-1 text-xs text-ink-2">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
                Private beta — now onboarding
              </p>
              <h1 className="font-display text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
                See the market
                <br />
                before it <span className="text-accent">moves</span>.
              </h1>
              <p className="mt-6 max-w-md text-lg text-ink-2">
                Highstrike turns raw market data into signal — real-time screening,
                flow analytics, and no-code backtesting in one fast terminal.
              </p>
              <div id="waitlist" className="mt-8 scroll-mt-24">
                <WaitlistForm />
                <p className="mt-3 text-xs text-ink-3">
                  Free during beta · No credit card · Unsubscribe anytime
                </p>
              </div>
            </div>
            <HeroChart />
          </div>
        </section>

        {/* Features */}
        <section id="features" className="scroll-mt-16 border-t border-line bg-panel/30">
          <div className="mx-auto max-w-6xl px-5 py-24">
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Everything the market is telling you.
              <br />
              <span className="text-ink-2">In one place, in real time.</span>
            </h2>
            <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
              {features.map((f) => (
                <div key={f.title} className="bg-panel p-7 transition hover:bg-panel-2">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--color-accent)"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d={f.icon} />
                  </svg>
                  <h3 className="mt-4 font-display text-base font-semibold">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-2">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="scroll-mt-16 border-t border-line">
          <div className="mx-auto max-w-6xl px-5 py-24">
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Simple pricing. <span className="text-ink-2">Serious tooling.</span>
            </h2>
            <p className="mt-3 text-ink-2">
              Early-access members lock in founder pricing for life.
            </p>
            <div className="mt-14 grid gap-6 lg:grid-cols-3">
              {tiers.map((t) => (
                <div
                  key={t.name}
                  className={`relative rounded-2xl border p-8 ${
                    t.highlight
                      ? "border-accent/50 bg-panel shadow-[0_0_60px_-20px] shadow-accent/30"
                      : "border-line bg-panel/50"
                  }`}
                >
                  {t.highlight && (
                    <span className="absolute -top-3 left-8 rounded-full bg-accent px-3 py-1 font-display text-xs font-semibold text-bg">
                      Most popular
                    </span>
                  )}
                  <h3 className="font-display text-lg font-semibold">{t.name}</h3>
                  <p className="mt-1 text-sm text-ink-2">{t.blurb}</p>
                  <p className="mt-6">
                    <span className="font-display text-4xl font-bold">{t.price}</span>
                    <span className="ml-2 text-sm text-ink-3">{t.cadence}</span>
                  </p>
                  <ul className="mt-6 space-y-3">
                    {t.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm text-ink-2">
                        <span className="mt-0.5 text-accent" aria-hidden="true">✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <a
                    href="#waitlist"
                    className={`mt-8 block rounded-lg py-2.5 text-center font-display text-sm font-semibold transition ${
                      t.highlight
                        ? "bg-accent text-bg hover:bg-accent-2"
                        : "border border-line-strong text-ink hover:border-accent/50 hover:text-accent"
                    }`}
                  >
                    {t.cta}
                  </a>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-16 border-t border-line bg-panel/30">
          <div className="mx-auto max-w-3xl px-5 py-24">
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Questions, answered.
            </h2>
            <div className="mt-10 divide-y divide-line border-y border-line">
              {faqs.map((f) => (
                <details key={f.q} className="group py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-base font-medium">
                    {f.q}
                    <span
                      className="text-ink-3 transition group-open:rotate-45"
                      aria-hidden="true"
                    >
                      +
                    </span>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-ink-2">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="border-t border-line">
          <div className="mx-auto flex max-w-6xl flex-col items-center px-5 py-24 text-center">
            <Logo size={40} />
            <h2 className="mt-6 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Trade with an edge.
            </h2>
            <p className="mt-3 max-w-md text-ink-2">
              Join the waitlist and be first in when the next cohort opens.
            </p>
            <div className="mt-8 flex justify-center">
              <WaitlistForm compact />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-10 text-sm text-ink-3 sm:flex-row">
          <p>© {new Date().getFullYear()} Highstrike. All rights reserved.</p>
          <p className="max-w-md text-center text-xs sm:text-right">
            Highstrike is an analytics tool, not a broker or investment adviser.
            Nothing here is financial advice.
          </p>
        </div>
      </footer>
    </>
  );
}
