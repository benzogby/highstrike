import type { Metadata } from "next";
import Eyebrow from "@/components/Eyebrow";
import CtaBlock from "@/components/CtaBlock";

export const metadata: Metadata = {
  title: "Results — HighStrike",
  description:
    "HighStrike AI's scoreboard: average gain, win rate, and average loss — published together, with the methodology behind the numbers.",
};

const stats = [
  {
    value: "39%",
    label: "Average gain",
    note: "Mean return across winning trades closed by the AI's published exit criteria.",
  },
  {
    value: "64%",
    label: "Win rate",
    note: "Share of published setups that closed at target or in profit.",
  },
  {
    value: "-19%",
    label: "Average loss",
    note: "Mean return across losing trades — published, because a scoreboard without losses is an ad.",
  },
];

const highlights = [
  {
    date: "Mar 23",
    ticker: "DELL",
    status: "Target Hit",
    result: "+956%",
    note: "Short-dated calls into an AI-infrastructure earnings run. An open right tail is what letting winners run occasionally produces — outliers are not the expectation.",
  },
  {
    date: "Mar 20",
    ticker: "SMCI",
    status: "Closed",
    result: "+121%",
    note: "Momentum continuation setup flagged by unusual options activity and confirming price action; closed on time-frame expiry.",
  },
];

const methodology = [
  {
    title: "Every published setup counts",
    body: "The scoreboard is computed over all setups published to the terminal — not a curated subset. If the AI put it in front of members, it's in the denominator.",
  },
  {
    title: "Losses are reported, always",
    body: "Average loss is a first-class metric on every scoreboard we publish. Expectancy — win rate × average gain, minus loss rate × average loss — is the number that actually compounds, and it can't be computed from winners alone.",
  },
  {
    title: "Defined exits, not hindsight",
    body: "Each setup ships with entry criteria, a price target, and a time frame before the trade is live. Results are scored against those published rules, not against the best price the chart touched afterward.",
  },
  {
    title: "Built on 150k trades of history",
    body: "The models are trained and evaluated on 8 years of theory and data from 150k trades. Large samples are what separate a statistical edge from a hot streak.",
  },
];

const expectations = [
  "Outliers like +956% are rare tail events, not the baseline — most winners are ordinary.",
  "Losing streaks happen at any win rate; at 64%, three losses in a row is routine probability.",
  "Position sizing, not signal quality, determines whether a drawdown is survivable.",
  "Your results depend on your fills, sizing, and discipline — no two members trade identically.",
];

export default function ResultsPage() {
  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="hero-grid absolute inset-0" aria-hidden="true" />
        <div className="glow absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto flex max-w-5xl flex-col items-center px-5 pb-16 pt-16 text-center lg:pt-24">
          <Eyebrow>Scoreboard</Eyebrow>
          <h1 className="font-display text-3xl font-bold uppercase tracking-tight sm:text-5xl">
            The numbers, all of them.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-ink-2">
            Most services show you their winners. A real track record is three
            numbers published together — how often we win, how much we make when we
            do, and how much we lose when we don&apos;t.
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="border-t border-line bg-panel/30">
        <div className="mx-auto max-w-5xl px-5 py-20">
          <div className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-3">
            {stats.map((s) => (
              <div key={s.label} className="bg-panel px-7 py-9">
                <p className="font-display text-5xl font-bold text-accent">{s.value}</p>
                <p className="mt-2 text-xs uppercase tracking-wider text-ink-3">
                  {s.label}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-ink-2">{s.note}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-center text-xs text-ink-3">
            Metrics computed across published HighStrike AI setups. Past performance
            is not indicative of future results.
          </p>
        </div>
      </section>

      {/* Recent highlights */}
      <section className="border-t border-line">
        <div className="mx-auto max-w-5xl px-5 py-20">
          <h2 className="text-center font-display text-2xl font-bold uppercase tracking-tight sm:text-3xl">
            Recent highlights
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-ink-2">
            Selected recent trades from the terminal — highlights, not the full
            distribution. The scoreboard above is the honest summary.
          </p>
          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            {highlights.map((t) => (
              <div
                key={t.ticker}
                className="rounded-2xl border border-line bg-panel p-7"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-ink-3">{t.date}</p>
                    <p className="font-display text-2xl font-bold">{t.ticker}</p>
                    <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-ink-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-up" aria-hidden="true" />
                      {t.status}
                    </p>
                  </div>
                  <p className="font-mono-nums text-3xl text-up">{t.result}</p>
                </div>
                <p className="mt-5 border-t border-line pt-4 text-sm leading-relaxed text-ink-2">
                  {t.note}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Methodology */}
      <section className="border-t border-line bg-panel/30">
        <div className="mx-auto max-w-5xl px-5 py-20">
          <h2 className="text-center font-display text-2xl font-bold uppercase tracking-tight sm:text-3xl">
            How the scoreboard is measured
          </h2>
          <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2">
            {methodology.map((m) => (
              <div key={m.title} className="bg-panel p-7">
                <h3 className="font-display text-base font-semibold">{m.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-2">{m.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What to expect */}
      <section className="border-t border-line">
        <div className="mx-auto max-w-3xl px-5 py-20">
          <h2 className="text-center font-display text-2xl font-bold uppercase tracking-tight sm:text-3xl">
            What you should expect
          </h2>
          <ul className="mt-8 space-y-4">
            {expectations.map((e) => (
              <li
                key={e}
                className="flex items-start gap-3 rounded-xl border border-line bg-panel px-6 py-4 text-ink-2"
              >
                <span className="mt-0.5 text-accent" aria-hidden="true">✓</span>
                {e}
              </li>
            ))}
          </ul>
          <div className="mt-14">
            <CtaBlock />
          </div>
        </div>
      </section>
    </main>
  );
}
