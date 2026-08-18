import type { Metadata } from "next";
import Eyebrow from "@/components/Eyebrow";
import WaitlistForm from "@/components/WaitlistForm";

export const metadata: Metadata = {
  title: "Pricing — HighStrike",
  description:
    "Plans for HighStrike AI Terminal: monthly, annual Alpha, and Lifetime access. Every plan includes the full terminal.",
};

const tiers = [
  {
    name: "Monthly",
    price: "$99",
    cadence: "per month",
    blurb: "Full terminal access, cancel anytime.",
    features: [
      "Daily AI market weather report",
      "Daily trade setups with entries, targets & time frames",
      "Unusual options & insider activity flags",
      "Social chatter monitoring",
      "Suggested options contracts",
    ],
    highlight: false,
  },
  {
    name: "Alpha (Annual)",
    price: "$79",
    cadence: "per month, billed annually",
    blurb: "Two months free and locked-in founder pricing.",
    features: [
      "Everything in Monthly",
      "Founder pricing locked for life",
      "FREE access to HighStrike Trading School ($2,995 value)*",
      "Priority support",
      "Early access to new terminal features",
    ],
    highlight: true,
  },
  {
    name: "Lifetime",
    price: "$1,995",
    cadence: "one-time payment",
    blurb: "Pay once. Every feature, forever.",
    features: [
      "Everything in Alpha",
      "Lifetime terminal access — no renewals ever",
      "All future features & data sources included",
      "Lifetime access to HighStrike Trading School",
    ],
    highlight: false,
  },
];

const comparison: { feature: string; monthly: string; alpha: string; lifetime: string }[] = [
  { feature: "AI market weather report", monthly: "✓", alpha: "✓", lifetime: "✓" },
  { feature: "Daily trade setups", monthly: "✓", alpha: "✓", lifetime: "✓" },
  { feature: "Insider & unusual options flags", monthly: "✓", alpha: "✓", lifetime: "✓" },
  { feature: "Suggested options contracts", monthly: "✓", alpha: "✓", lifetime: "✓" },
  { feature: "Trading School access", monthly: "—", alpha: "✓*", lifetime: "✓" },
  { feature: "Founder pricing lock", monthly: "—", alpha: "✓", lifetime: "n/a" },
  { feature: "Priority support", monthly: "—", alpha: "✓", lifetime: "✓" },
  { feature: "Future features included", monthly: "✓", alpha: "✓", lifetime: "✓" },
];

const faqs = [
  {
    q: "Can I cancel anytime?",
    a: "Yes. Monthly and Alpha plans can be cancelled from your account at any time — you keep access through the end of the period you've paid for, and you won't be billed again.",
  },
  {
    q: "What's the difference between Alpha and Lifetime?",
    a: "Alpha is our annual plan: you pay for ten months and get twelve, keep founder pricing for as long as you stay subscribed, and get Trading School included. Lifetime is a single payment for permanent access — no renewals, ever, with every future feature included.",
  },
  {
    q: "Is the Trading School bonus really included?",
    a: "Yes — registrants during the bonus window get full access to HighStrike Trading School ($2,995 value) at no extra cost. The bonus window and terms are shown at checkout.",
  },
  {
    q: "Do I need options approval with my broker?",
    a: "To trade the suggested contracts, yes — you'll need an options-approved brokerage account. The terminal itself is analytics software and works with any broker; many members start by following setups on the stock alone.",
  },
  {
    q: "Is this financial advice?",
    a: "No. HighStrike AI is an analytics and data tool. Setups are market commentary, not recommendations — you make your own trading decisions and should consult a qualified financial advisor. Trading involves substantial risk of loss.",
  },
];

export default function PricingPage() {
  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="hero-grid absolute inset-0" aria-hidden="true" />
        <div className="glow absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto flex max-w-5xl flex-col items-center px-5 pb-16 pt-16 text-center lg:pt-24">
          <Eyebrow>Pricing</Eyebrow>
          <h1 className="font-display text-3xl font-bold uppercase tracking-tight sm:text-5xl">
            One terminal. Three ways in.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-ink-2">
            Every plan includes the full HighStrike AI Terminal — same data, same
            setups, same AI. The only choice is how you pay.
          </p>
        </div>
      </section>

      {/* Tiers */}
      <section className="border-t border-line bg-panel/30">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="grid gap-6 lg:grid-cols-3">
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
                <h2 className="font-display text-lg font-semibold">{t.name}</h2>
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
                  href="#get-access"
                  className={`mt-8 block rounded-lg py-2.5 text-center font-display text-sm font-semibold transition ${
                    t.highlight
                      ? "bg-accent text-bg hover:bg-accent-2"
                      : "border border-line-strong text-ink hover:border-accent/50 hover:text-accent"
                  }`}
                >
                  Get Access Now
                </a>
              </div>
            ))}
          </div>
          <p className="mt-5 text-center text-xs text-ink-3">
            *Trading School bonus applies during the current registration window —
            terms shown at checkout.
          </p>
        </div>
      </section>

      {/* Comparison table */}
      <section className="border-t border-line">
        <div className="mx-auto max-w-4xl px-5 py-20">
          <h2 className="text-center font-display text-2xl font-bold uppercase tracking-tight sm:text-3xl">
            Compare plans
          </h2>
          <div className="mt-10 overflow-x-auto rounded-2xl border border-line">
            <table className="w-full min-w-[36rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line bg-panel-2 text-left">
                  <th className="px-6 py-4 font-display font-semibold">Feature</th>
                  <th className="px-6 py-4 text-center font-display font-semibold">Monthly</th>
                  <th className="px-6 py-4 text-center font-display font-semibold text-accent">
                    Alpha
                  </th>
                  <th className="px-6 py-4 text-center font-display font-semibold">Lifetime</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line bg-panel">
                {comparison.map((row) => (
                  <tr key={row.feature}>
                    <td className="px-6 py-3.5 text-ink-2">{row.feature}</td>
                    <td className="px-6 py-3.5 text-center font-mono-nums">{row.monthly}</td>
                    <td className="px-6 py-3.5 text-center font-mono-nums text-accent">
                      {row.alpha}
                    </td>
                    <td className="px-6 py-3.5 text-center font-mono-nums">{row.lifetime}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-line bg-panel/30">
        <div className="mx-auto max-w-3xl px-5 py-20">
          <h2 className="text-center font-display text-2xl font-bold uppercase tracking-tight sm:text-3xl">
            Pricing questions
          </h2>
          <div className="mt-8 divide-y divide-line border-y border-line">
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

      {/* Get access */}
      <section id="get-access" className="scroll-mt-16 border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center px-5 py-20 text-center">
          <h2 className="font-display text-2xl font-bold uppercase tracking-tight sm:text-3xl">
            Get access now
          </h2>
          <p className="mt-3 max-w-md text-ink-2">
            Join the list and we&apos;ll reach out when the next cohort opens.
          </p>
          <div className="mt-8 flex justify-center">
            <WaitlistForm compact />
          </div>
        </div>
      </section>
    </main>
  );
}
