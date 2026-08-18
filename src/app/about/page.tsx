import type { Metadata } from "next";
import Eyebrow from "@/components/Eyebrow";
import CtaBlock from "@/components/CtaBlock";

export const metadata: Metadata = {
  title: "About Us — HighStrike",
  description:
    "HighStrike has been teaching traders since 2018. HighStrike AI turns eight years of theory and 150k trades of data into a daily terminal.",
};

const numbers = [
  { value: "2018", label: "Founded" },
  { value: "8 yrs", label: "Of market theory" },
  { value: "150k", label: "Trades of data" },
  { value: "Daily", label: "AI setups delivered" },
];

const principles = [
  {
    title: "Data over dogma",
    body: "Every rule in the system earned its place by surviving contact with 150k historical trades. When the data and the narrative disagree, the narrative loses.",
  },
  {
    title: "Losses on the scoreboard",
    body: "We publish average loss next to average gain, always. A track record that only shows winners isn't a track record — it's an ad. Expectancy is the number that compounds, and it needs both sides.",
  },
  {
    title: "Risk before reward",
    body: "Every setup ships with defined entry criteria, a target, and a time frame before the trade is live. Knowing where you're wrong is more valuable than being right.",
  },
  {
    title: "Tools, not gurus",
    body: "The AI does the legwork — scanning, scoring, and writing up the reasoning in plain English. You stay the decision-maker. We build instruments, not oracles.",
  },
  {
    title: "Education first",
    body: "We started as a trading school and never stopped being one. A member who understands why a setup exists will outlast one who just follows alerts.",
  },
  {
    title: "Plain English",
    body: "Every trade idea comes with its justification written out — no black boxes, no 'trust the algorithm.' If the reasoning can't be explained, it doesn't ship.",
  },
];

const story = [
  {
    period: "2018",
    title: "A trading school, first",
    body: "HighStrike started by teaching options traders a repeatable process — risk management, trade selection, and the discipline to follow both. Thousands of students later, that curriculum became the backbone of everything we build.",
  },
  {
    period: "2018–2025",
    title: "Eight years of theory, 150k trades of data",
    body: "Every trade taught, taken, and reviewed became training data. Patterns that survived — and just as importantly, the ones that didn't — were codified into a systematic playbook for reading volatility, flow, and momentum.",
  },
  {
    period: "2026",
    title: "The AI Terminal",
    body: "HighStrike AI puts that playbook to work every day: scanning the market each morning, scoring conditions, and delivering curated setups with entries, targets, time frames, and written justifications — so members focus on execution, not research.",
  },
];

export default function AboutPage() {
  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="hero-grid absolute inset-0" aria-hidden="true" />
        <div className="glow absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto flex max-w-5xl flex-col items-center px-5 pb-16 pt-16 text-center lg:pt-24">
          <Eyebrow>About us</Eyebrow>
          <h1 className="font-display text-3xl font-bold uppercase tracking-tight sm:text-5xl">
            Traders first. AI second.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-ink-2">
            HighStrike has been teaching options traders since 2018. HighStrike AI
            is that experience — eight years of theory and 150k trades of data —
            compressed into a terminal that works the market every morning so you
            don&apos;t have to.
          </p>
        </div>
      </section>

      {/* Numbers band */}
      <section className="border-t border-line bg-panel/30">
        <div className="mx-auto max-w-5xl px-5 py-14">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-4">
            {numbers.map((n) => (
              <div key={n.label} className="bg-panel px-6 py-7 text-center">
                <p className="font-display text-3xl font-bold text-accent">{n.value}</p>
                <p className="mt-1 text-xs uppercase tracking-wider text-ink-3">
                  {n.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Story */}
      <section className="border-t border-line">
        <div className="mx-auto max-w-3xl px-5 py-20">
          <h2 className="text-center font-display text-2xl font-bold uppercase tracking-tight sm:text-3xl">
            How we got here
          </h2>
          <div className="mt-10 space-y-6">
            {story.map((s) => (
              <div
                key={s.period}
                className="rounded-2xl border border-line bg-panel p-7"
              >
                <p className="font-mono-nums text-sm text-accent">{s.period}</p>
                <h3 className="mt-2 font-display text-lg font-bold">{s.title}</h3>
                <p className="mt-2 leading-relaxed text-ink-2">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Principles */}
      <section className="border-t border-line bg-panel/30">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <h2 className="text-center font-display text-2xl font-bold uppercase tracking-tight sm:text-3xl">
            What we believe
          </h2>
          <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
            {principles.map((p) => (
              <div key={p.title} className="bg-panel p-7">
                <h3 className="font-display text-base font-semibold">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-2">{p.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-14">
            <CtaBlock />
          </div>
        </div>
      </section>
    </main>
  );
}
