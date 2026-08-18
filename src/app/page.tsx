import Link from "next/link";
import Eyebrow from "@/components/Eyebrow";
import TerminalMockup from "@/components/TerminalMockup";
import SetupCardMockup from "@/components/SetupCardMockup";
import ScannerMockup from "@/components/ScannerMockup";
import CtaBlock from "@/components/CtaBlock";
import WaitlistForm from "@/components/WaitlistForm";

const trustStats = [
  { value: "2018", label: "Founded" },
  { value: "8 yrs", label: "Of market theory" },
  { value: "150k", label: "Trades of data" },
  { value: "5,400+", label: "Symbols scanned daily" },
];

const platform = [
  {
    title: "Dashboard Terminal",
    body: "Every trade idea, market read, and data flag in one keyboard-fast workspace — built to be the first tab you open and the only one you need.",
    icon: "M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4zM9 21h6",
  },
  {
    title: "AI Weather Report",
    body: "Volatility, opportunity, and direction scored before the open — so every setup you see is framed by the day's actual conditions.",
    icon: "M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999A5.002 5.002 0 103 15z",
  },
  {
    title: "Setup Engine",
    body: "Curated trade setups with entries, targets, time frames, and the reasoning written out in plain English. No black boxes.",
    icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  {
    title: "Flow Scanner",
    body: "Unusual options activity, relative volume, and momentum distilled into a single flow score across the entire scan universe.",
    icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6",
  },
  {
    title: "Insider Monitor",
    body: "Open-market insider buying scored for size, clustering, and pattern breaks — the filings that matter, separated from the noise.",
    icon: "M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9",
  },
  {
    title: "Chatter Engine",
    body: "X and Reddit chatter monitored at scale and reduced to a sentiment read per ticker — crowd positioning without the doomscrolling.",
    icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
  },
];

const pipeline = [
  {
    step: "01",
    title: "Ingest",
    body: "Price action, options chains, insider filings, and social chatter stream in across 5,400+ symbols — normalized into one picture of the tape.",
  },
  {
    step: "02",
    title: "Score",
    body: "Models trained on 8 years of theory and 150k trades score conditions and rank every candidate — volatility, flow, momentum, and confirmation.",
  },
  {
    step: "03",
    title: "Curate",
    body: "Only setups that clear the bar are written up — entry criteria, target, time frame, and justification, reviewed against the day's weather report.",
  },
  {
    step: "04",
    title: "Deliver",
    body: "Finished trade cards land in your terminal before the open. You read the reasoning, size the risk, and focus on execution.",
  },
];

const personas = [
  {
    title: "Active options traders",
    body: "You're already in the market every day. The terminal replaces hours of pre-market scanning with a curated slate and the data to interrogate it.",
  },
  {
    title: "Swing traders",
    body: "Multi-day time frames, defined risk, clear invalidation. Setups ship with targets and time frames that fit around a schedule.",
  },
  {
    title: "Busy professionals",
    body: "You can't watch the tape all day — and don't need to. One morning read, a handful of curated ideas, alerts when levels trigger.",
  },
  {
    title: "Students of the game",
    body: "Every setup is a worked example with the reasoning shown. Pair the terminal with Trading School and learn the process behind every card.",
  },
];

const assurances = [
  {
    title: "Analytics only — never your broker",
    body: "The terminal never connects to your brokerage account. It has no ability to place trades, move money, or see your positions. You stay in full control.",
    icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
  },
  {
    title: "A scoreboard with losses on it",
    body: "Average loss is published next to average gain, always. We report performance the way we'd want it reported to us.",
    icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  },
  {
    title: "Reasoning on every card",
    body: "No 'trust the algorithm.' Every setup ships with its justification written in plain English — if it can't be explained, it doesn't publish.",
    icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  },
  {
    title: "Cancel anytime",
    body: "Monthly and annual plans cancel from your account in two clicks — you keep access through the period you've paid for, no retention maze.",
    icon: "M5 13l4 4L19 7",
  },
];

const faqs = [
  {
    q: "What exactly do I get every day?",
    a: "A pre-open market weather report (volatility, opportunity, direction), a curated slate of trade setups — each with entry criteria, price target, time frame, suggested options contracts, and written justification — plus live flow, insider, and chatter flags across the scan universe.",
  },
  {
    q: "Do I need to connect my brokerage account?",
    a: "No, and you can't — the terminal is analytics software by design. It never touches your broker, your positions, or your money. You execute trades wherever you already trade.",
  },
  {
    q: "How is this different from an alerts service?",
    a: "Alerts tell you what to do; the terminal shows you why. Every setup carries its full reasoning, the data behind it, and the conditions it was built for — so you're building judgment, not dependence.",
  },
  {
    q: "What experience level do I need?",
    a: "The terminal assumes you know what a call and a put are. Beyond that, every card is a worked example, and qualifying registrations include HighStrike Trading School — a full options curriculum — at no extra cost.",
  },
  {
    q: "What does it cost?",
    a: "Plans start at $99/month, with annual and lifetime options. Every plan includes the full terminal — same data, same setups, same AI. See the pricing page for details.",
  },
  {
    q: "Is this financial advice?",
    a: "No. HighStrike AI is an analytics and data tool; setups are market commentary, not recommendations. Trading involves substantial risk, including loss of principal — you make your own decisions and should consult a qualified advisor.",
  },
];

export default function Home() {
  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="hero-grid absolute inset-0" aria-hidden="true" />
        <div className="glow absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto flex max-w-5xl flex-col items-center px-5 pb-16 pt-16 text-center lg:pt-24">
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

      {/* Trust stat band */}
      <section className="border-t border-line bg-panel/40">
        <div className="mx-auto max-w-6xl px-5 py-10">
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            {trustStats.map((s) => (
              <div key={s.label} className="text-center">
                <p className="font-display text-3xl font-bold text-accent">{s.value}</p>
                <p className="mt-1 text-xs uppercase tracking-wider text-ink-3">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Platform overview */}
      <section id="platform" className="scroll-mt-16 border-t border-line">
        <div className="mx-auto max-w-6xl px-5 py-24">
          <div className="flex flex-col items-center text-center">
            <Eyebrow>The platform</Eyebrow>
            <h2 className="font-display text-3xl font-bold uppercase tracking-tight sm:text-4xl">
              One terminal. Six systems.
            </h2>
            <p className="mt-4 max-w-2xl text-ink-2">
              HighStrike AI is a full market-intelligence stack — every system feeds
              the next, and all of it lands in a single workspace before the open.
            </p>
          </div>
          <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-line bg-line text-left sm:grid-cols-2 lg:grid-cols-3">
            {platform.map((f) => (
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

      {/* Deep dive: Setup Engine */}
      <section className="border-t border-line bg-panel/30">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-24 lg:grid-cols-2">
          <div>
            <Eyebrow>Setup Engine</Eyebrow>
            <h2 className="font-display text-2xl font-bold uppercase tracking-tight sm:text-3xl">
              A finished trade card, not a ticker symbol
            </h2>
            <p className="mt-4 leading-relaxed text-ink-2">
              Most tools hand you a list of names and wish you luck. The terminal
              hands you the whole trade: where it triggers, where it&apos;s wrong,
              what it&apos;s worth, how long it has, and which contracts express it —
              with the reasoning written out above the fold.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-ink-2">
              {[
                "Entry criteria that must trigger before the trade is live",
                "Price targets and time frames set before publication — no hindsight",
                "Suggested options contracts across strikes and expiries",
                "30+ supporting data fields on every card",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span className="mt-0.5 text-accent" aria-hidden="true">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <SetupCardMockup />
        </div>
      </section>

      {/* Deep dive: Flow Scanner */}
      <section className="border-t border-line">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-24 lg:grid-cols-2">
          <div className="lg:order-2">
            <Eyebrow>Flow Scanner</Eyebrow>
            <h2 className="font-display text-2xl font-bold uppercase tracking-tight sm:text-3xl">
              The whole market, ranked by conviction
            </h2>
            <p className="mt-4 leading-relaxed text-ink-2">
              Under the setups sits the scanner: 5,400+ symbols scored continuously
              on options flow, relative volume, and momentum. When institutional-size
              positioning detaches from baseline, the flow score surfaces it — hours
              of chain-watching compressed into one sortable column.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-ink-2">
              {[
                "Unusual options activity weighed against open interest and aggressor side",
                "Relative volume versus each symbol's own baseline, not the market's",
                "Directional bias from the combination — long, short, or stand aside",
                "Every flagged name one click from its full data card",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span className="mt-0.5 text-accent" aria-hidden="true">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="lg:order-1">
            <ScannerMockup />
          </div>
        </div>
      </section>

      {/* Pipeline */}
      <section className="border-t border-line bg-panel/30">
        <div className="mx-auto max-w-6xl px-5 py-24">
          <div className="flex flex-col items-center text-center">
            <Eyebrow>How it works</Eyebrow>
            <h2 className="font-display text-3xl font-bold uppercase tracking-tight sm:text-4xl">
              From raw tape to trade card
            </h2>
            <p className="mt-4 max-w-2xl text-ink-2">
              The same disciplined process, every market day — run by machines,
              readable by humans.
            </p>
          </div>
          <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {pipeline.map((p) => (
              <div key={p.step} className="bg-panel p-7">
                <p className="font-mono-nums text-sm text-accent">{p.step}</p>
                <h3 className="mt-3 font-display text-base font-semibold">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-2">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Scoreboard */}
      <section id="scoreboard" className="scroll-mt-16 border-t border-line">
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
            {[
              { value: "39%", label: "Average gain" },
              { value: "64%", label: "Win rate" },
              { value: "-19%", label: "Average loss" },
            ].map((s) => (
              <div key={s.label} className="bg-panel px-6 py-8">
                <p className="font-display text-4xl font-bold text-accent">{s.value}</p>
                <p className="mt-1 text-xs uppercase tracking-wider text-ink-3">
                  {s.label}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-6 grid w-full max-w-3xl gap-4 sm:grid-cols-2">
            {[
              { date: "Mar 23", ticker: "DELL", status: "Target Hit", result: "+956%" },
              { date: "Mar 20", ticker: "SMCI", status: "Closed", result: "+121%" },
            ].map((t) => (
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

          <Link
            href="/results"
            className="mt-8 text-sm font-semibold text-accent transition hover:text-accent-2"
          >
            See the full scoreboard & methodology →
          </Link>

          <div className="mt-14">
            <CtaBlock />
          </div>
        </div>
      </section>

      {/* Personas */}
      <section className="border-t border-line bg-panel/30">
        <div className="mx-auto max-w-6xl px-5 py-24">
          <div className="flex flex-col items-center text-center">
            <Eyebrow>Who it&apos;s for</Eyebrow>
            <h2 className="font-display text-3xl font-bold uppercase tracking-tight sm:text-4xl">
              Built for how you actually trade
            </h2>
          </div>
          <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {personas.map((p) => (
              <div key={p.title} className="bg-panel p-7">
                <h3 className="font-display text-base font-semibold">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-2">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trading School cross-sell */}
      <section className="border-t border-line">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-24 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <Eyebrow>HighStrike Trading School</Eyebrow>
            <h2 className="font-display text-2xl font-bold uppercase tracking-tight sm:text-3xl">
              The playbook the AI was trained on — taught to you
            </h2>
            <p className="mt-4 leading-relaxed text-ink-2">
              Before there was a terminal, there was a curriculum. HighStrike Trading
              School is the structured options program we&apos;ve run since 2018 —
              process, risk management, and trade selection, taught the way the
              models learned it. Registrants during the bonus window get the full
              program, a $2,995 value, included free.
            </p>
            <Link
              href="/about"
              className="mt-6 inline-block text-sm font-semibold text-accent transition hover:text-accent-2"
            >
              The story behind the school →
            </Link>
          </div>
          <div className="rounded-2xl border border-line bg-panel p-7 lg:col-span-2">
            <p className="font-display text-sm font-semibold text-accent">Included in the bonus</p>
            <ul className="mt-4 space-y-3 text-sm text-ink-2">
              {[
                "Full options curriculum, from mechanics to management",
                "The risk framework behind every terminal setup",
                "Trade review methodology — grade your own execution",
                "Lifetime access with qualifying registration",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span className="mt-0.5 text-accent" aria-hidden="true">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Assurances */}
      <section className="border-t border-line bg-panel/30">
        <div className="mx-auto max-w-6xl px-5 py-24">
          <div className="flex flex-col items-center text-center">
            <Eyebrow>Built to be trusted</Eyebrow>
            <h2 className="font-display text-3xl font-bold uppercase tracking-tight sm:text-4xl">
              Serious software, honest terms
            </h2>
          </div>
          <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2">
            {assurances.map((a) => (
              <div key={a.title} className="bg-panel p-7">
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
                  <path d={a.icon} />
                </svg>
                <h3 className="mt-4 font-display text-base font-semibold">{a.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-2">{a.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-line">
        <div className="mx-auto max-w-3xl px-5 py-24">
          <div className="flex flex-col items-center text-center">
            <Eyebrow>FAQ</Eyebrow>
            <h2 className="font-display text-3xl font-bold uppercase tracking-tight sm:text-4xl">
              Questions, answered
            </h2>
          </div>
          <div className="mt-10 divide-y divide-line border-y border-line">
            {faqs.map((f) => (
              <details key={f.q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-base font-medium">
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
      </section>

      {/* Final CTA + waitlist */}
      <section id="waitlist" className="scroll-mt-16 border-t border-line bg-panel/30">
        <div className="mx-auto flex max-w-6xl flex-col items-center px-5 py-24 text-center">
          <h2 className="font-display text-3xl font-bold uppercase tracking-tight sm:text-4xl">
            Get access now
          </h2>
          <p className="mt-3 max-w-md text-ink-2">
            Create your account and start trading with HighStrike AI Terminal.
          </p>
          <div className="mt-8">
            <CtaBlock />
          </div>
          <div className="mt-12 w-full max-w-lg border-t border-line pt-10">
            <p className="text-sm text-ink-2">
              Not ready yet? Join the list and we&apos;ll email you when the next
              cohort opens.
            </p>
            <div className="mt-4 flex justify-center">
              <WaitlistForm compact />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
