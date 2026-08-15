import Header from "@/components/Header";
import TerminalMockup from "@/components/TerminalMockup";
import CtaBlock from "@/components/CtaBlock";
import WaitlistForm from "@/components/WaitlistForm";

const stats = [
  { value: "39%", label: "Average gain" },
  { value: "64%", label: "Win rate" },
  { value: "-19%", label: "Average loss" },
];

const trades = [
  { date: "Mar 23", ticker: "DELL", status: "Target Hit", result: "+956%" },
  { date: "Mar 20", ticker: "SMCI", status: "Closed", result: "+121%" },
];

const sampleTrade = [
  { field: "Ticker", value: "$MCD" },
  { field: "Trade Direction", value: "Long" },
  { field: "Trade Justification", value: "Q4 Earnings Momentum" },
  { field: "Entry Criteria", value: "3 triggers" },
  { field: "Price Target", value: "$345.00" },
  { field: "Time Frame", value: "3-4 days" },
  { field: "Social Chatter", value: "Bullish" },
  { field: "Insider Activity", value: "2 Flags" },
  { field: "Unusual Options", value: "5 Flags" },
  { field: "Suggested Options Contracts", value: "4 contracts" },
];

const features = [
  {
    title: "Dashboard Terminal",
    body: "All of HighStrike AI's trade ideas in one place.",
    icon: "M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4zM9 21h6",
  },
  {
    title: "Daily Setups",
    body: "AI generated trade ideas every day.",
    icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  {
    title: "Insider Alerts",
    body: "See who is buying and selling.",
    icon: "M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9",
  },
  {
    title: "Options Plays",
    body: "Suggested options contracts.",
    icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6",
  },
  {
    title: "Social Chatter",
    body: "HighStrike AI scrapes X and Reddit chatter.",
    icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
  },
  {
    title: "Trade Justification",
    body: "Detailed explanation of trade reasoning.",
    icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  },
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-1 text-xs uppercase tracking-wider text-ink-2">
      <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
      {children}
    </p>
  );
}

export default function Home() {
  return (
    <>
      <Header />

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="hero-grid absolute inset-0" aria-hidden="true" />
          <div className="glow absolute inset-0" aria-hidden="true" />
          <div className="relative mx-auto flex max-w-5xl flex-col items-center px-5 pb-20 pt-16 text-center lg:pt-24">
            <Eyebrow>For options traders</Eyebrow>
            <h1 className="font-display text-3xl font-bold uppercase leading-[1.15] tracking-tight sm:text-5xl">
              Everything you need to win in the markets,{" "}
              <span className="whitespace-nowrap rounded-xl bg-accent px-3 py-0.5 text-bg">
                powered by AI.
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-ink-2">
              Daily trade setups, entries, targets, and market analysis generated for
              you so you can focus on execution, not research.
            </p>
            <div className="mt-8">
              <CtaBlock />
            </div>
            <div className="mt-14 w-full max-w-3xl text-left">
              <TerminalMockup />
            </div>
          </div>
        </section>

        {/* Scoreboard */}
        <section id="scoreboard" className="scroll-mt-16 border-t border-line bg-panel/30">
          <div className="mx-auto flex max-w-5xl flex-col items-center px-5 py-24 text-center">
            <Eyebrow>Scoreboard</Eyebrow>
            <h2 className="font-display text-3xl font-bold uppercase tracking-tight sm:text-4xl">
              HighStrike AI&apos;s recent options trades
            </h2>
            <p className="mt-4 max-w-2xl text-ink-2">
              HighStrike&apos;s proprietary AI analyzes markets using 8 years of theory
              and data from 150k trades and delivers ready-to-execute trade
              opportunities in real time.
            </p>

            <div className="mt-12 grid w-full max-w-3xl grid-cols-1 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-3">
              {stats.map((s) => (
                <div key={s.label} className="bg-panel px-6 py-8">
                  <p className="font-display text-4xl font-bold text-accent">{s.value}</p>
                  <p className="mt-1 text-xs uppercase tracking-wider text-ink-3">
                    {s.label}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-6 grid w-full max-w-3xl gap-4 sm:grid-cols-2">
              {trades.map((t) => (
                <div
                  key={t.ticker}
                  className="flex items-center justify-between rounded-2xl border border-line bg-panel px-6 py-5"
                >
                  <div className="text-left">
                    <p className="text-xs text-ink-3">{t.date}</p>
                    <p className="font-display text-xl font-bold">{t.ticker}</p>
                    <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-ink-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-up" aria-hidden="true" />
                      {t.status}
                    </p>
                  </div>
                  <p className="font-mono-nums text-2xl text-up">{t.result}</p>
                </div>
              ))}
            </div>

            <div className="mt-14">
              <CtaBlock />
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="scroll-mt-16 border-t border-line">
          <div className="mx-auto flex max-w-5xl flex-col items-center px-5 py-24 text-center">
            <Eyebrow>How it works</Eyebrow>
            <h2 className="font-display text-3xl font-bold uppercase tracking-tight sm:text-4xl">
              Let our AI do the legwork
            </h2>
            <p className="mt-4 max-w-2xl text-ink-2">
              Daily AI market weather reports and curated, detailed trade setups that
              fit your risk profile.
            </p>

            <div className="mt-12 w-full max-w-2xl overflow-hidden rounded-2xl border border-line bg-panel text-left">
              <div className="flex items-center justify-between border-b border-line px-6 py-4">
                <span className="font-display text-sm font-semibold">Sample Trade</span>
                <span className="font-mono-nums text-sm text-accent">$MCD</span>
              </div>
              <dl className="divide-y divide-line">
                {sampleTrade.map((row) => (
                  <div
                    key={row.field}
                    className="flex items-center justify-between gap-4 px-6 py-3"
                  >
                    <dt className="text-sm text-ink-2">{row.field}</dt>
                    <dd className="font-mono-nums text-sm text-ink">{row.value}</dd>
                  </div>
                ))}
              </dl>
              <p className="border-t border-line bg-panel-2 px-6 py-3 text-center text-xs text-ink-3">
                + 30 more data fields
              </p>
            </div>

            <div className="mt-14">
              <CtaBlock />
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="scroll-mt-16 border-t border-line bg-panel/30">
          <div className="mx-auto flex max-w-6xl flex-col items-center px-5 py-24 text-center">
            <Eyebrow>Features</Eyebrow>
            <h2 className="font-display text-3xl font-bold uppercase tracking-tight sm:text-4xl">
              What you get
            </h2>
            <p className="mt-4 max-w-2xl text-ink-2">
              Everything you need to find high-quality trades, without spending hours
              analyzing the markets.
            </p>

            <div className="mt-12 grid w-full gap-px overflow-hidden rounded-2xl border border-line bg-line text-left sm:grid-cols-2 lg:grid-cols-3">
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

            <div className="mt-14">
              <CtaBlock />
            </div>
          </div>
        </section>

        {/* Get access / waitlist */}
        <section id="waitlist" className="scroll-mt-16 border-t border-line">
          <div className="mx-auto flex max-w-6xl flex-col items-center px-5 py-24 text-center">
            <h2 className="font-display text-3xl font-bold uppercase tracking-tight sm:text-4xl">
              Get access now
            </h2>
            <p className="mt-3 max-w-md text-ink-2">
              Start trading with HighStrike AI Terminal.
            </p>
            <div className="mt-8 flex justify-center">
              <WaitlistForm compact />
            </div>
            <p className="mt-4 text-xs text-ink-3">
              *BONUS: March registrants get FREE access to HighStrike Trading School
              ($2,995 value)
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto max-w-6xl px-5 py-12">
          <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
            <div>
              <p className="font-display text-lg font-bold">HighStrike</p>
              <p className="text-xs text-ink-3">Est. 2018</p>
            </div>
            <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-2">
              <a
                href="https://www.highstrike.com/terms-of-service"
                className="transition hover:text-ink"
              >
                Terms of Service
              </a>
              <a
                href="https://www.highstrike.com/privacy-policy"
                className="transition hover:text-ink"
              >
                Privacy Policy
              </a>
              <a href="mailto:support@highstrike.com" className="transition hover:text-ink">
                support@highstrike.com
              </a>
            </nav>
          </div>

          <div className="mt-10 space-y-3 border-t border-line pt-8 text-xs leading-relaxed text-ink-3">
            <p>
              The information provided by HighStrike and HighStrike AI is for
              informational and educational purposes only and should not be considered
              financial, investment, or trading advice. HighStrike does not make
              recommendations to buy or sell any securities, assets, or financial
              instruments. All trade ideas, analysis, and insights generated by our AI
              are intended solely as market commentary and should not be relied upon as
              the basis for any investment decision.
            </p>
            <p>
              HighStrike AI is intended to be a time saving tool which simplifies data
              collection and analysis, and should not be a replacement for due diligence
              and risk management. You should not rely on HighStrike AI to make your
              trading decisions.
            </p>
            <p>
              Trading and investing involve substantial risk, including the possible
              loss of principal. Past performance is not indicative of future results.
              You should conduct your own research and consult with a qualified
              financial advisor before making any investment decisions.
            </p>
            <p>
              HighStrike and its operators are not responsible for any trading losses,
              financial decisions, or damages that may result from the use of our
              platform or reliance on any information provided. By using this website,
              you acknowledge and agree to our{" "}
              <a
                href="https://www.highstrike.com/terms-of-service"
                className="underline transition hover:text-ink"
              >
                Terms of Service
              </a>{" "}
              and{" "}
              <a
                href="https://www.highstrike.com/privacy-policy"
                className="underline transition hover:text-ink"
              >
                Privacy Policy
              </a>
              .
            </p>
            <p>
              HighStrike is owned and operated by ZERO DTE HOLDINGS LLC, a Wyoming
              Limited Liability Company.
            </p>
            <p>ZERO DTE HOLDINGS, {new Date().getFullYear()} — All Rights Reserved</p>
          </div>
        </div>
      </footer>
    </>
  );
}
