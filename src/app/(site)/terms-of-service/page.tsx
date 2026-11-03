import type { Metadata } from "next";
import Link from "next/link";
import { LegalDoc, Mail, type LegalSection } from "@/components/LegalDoc";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms of Service — HighStrike",
  description:
    "The terms for using HighStrike: what it is, what it isn't (financial advice), that its prices are estimates, and what you and we agree to.",
};

const sections: LegalSection[] = [
  {
    id: "who",
    title: "Who we are",
    body: (
      <>
        <p>
          HighStrike and HighStrike AI are owned and operated by ZERO DTE HOLDINGS LLC, a Wyoming limited liability
          company (&ldquo;HighStrike&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;). These terms cover highstrike.com, the
          HighStrike app and everything in it.
        </p>
        <p>
          By creating an account or using the site, you agree to these terms and to our{" "}
          <Link href="/privacy-policy">Privacy Policy</Link>. If you don&apos;t agree, please don&apos;t use HighStrike.
        </p>
      </>
    ),
  },
  {
    id: "what",
    title: "What HighStrike is",
    body: (
      <>
        <p>
          HighStrike shows you options trade setups, one card at a time: calls, puts, spreads and iron condors on US
          stocks, each with its strikes, expiry, cost, take profit and stop. You swipe right to save a setup and left to
          pass. The setups you save are followed to their take profit, stop or expiry with an estimated result, and count
          toward your streak, the scoreboard and the weekly contest. You can share a saved setup as a link.
        </p>
        <p>
          HighStrike is not a broker. We don&apos;t place trades, hold money or securities, or connect to your brokerage
          account. Every trade you make is your own decision, made at your own broker.
        </p>
      </>
    ),
  },
  {
    id: "not-advice",
    title: "Not financial advice",
    body: (
      <>
        {LEGAL.map((p) => (
          <p key={p.slice(0, 24)}>{p}</p>
        ))}
        <p>
          Setups are built automatically by rules from market data and can be wrong, late or incomplete. Market data comes
          from third parties and may be delayed or contain errors. Options can lose their entire value.
        </p>
      </>
    ),
  },
  {
    id: "estimates",
    title: "Prices are estimates",
    body: (
      <p>
        The option prices on every card are <strong>estimates</strong>, worked out with the Black-Scholes model from each
        stock&apos;s own recent price moves. They are not live quotes. The results of saved setups, your streak&apos;s
        numbers, the scoreboard and the contests all use the same estimates. Real prices, and what you&apos;d actually be
        filled at, will differ, sometimes by a lot.
      </p>
    ),
  },
  {
    id: "account",
    title: "Your account",
    body: (
      <ul>
        <li>You must be at least 18 years old to use HighStrike.</li>
        <li>Give us a real email address and keep your password (or your Google account) secure.</li>
        <li>One account per person. Don&apos;t share it, and don&apos;t make extra accounts.</li>
        <li>You&apos;re responsible for what happens under your account.</li>
      </ul>
    ),
  },
  {
    id: "free",
    title: "Free for now, and paying later",
    body: (
      <>
        <p>
          HighStrike is free while we build it. We may add paid plans later. If we do, we&apos;ll tell you before anything
          costs money, and you&apos;ll never be charged without agreeing to it first.
        </p>
        <p>
          Any payment is processed by Stripe; we never see or store your full card number. If you bought HighStrike
          Lifetime Access before November 2, 2026, the terms you agreed to when you bought it still apply to that purchase,
          including that it isn&apos;t refundable. If you were ever charged by mistake, for example twice, email <Mail />{" "}
          and we&apos;ll put it right. Nothing here takes away any right the law gives you that can&apos;t be waived.
        </p>
      </>
    ),
  },
  {
    id: "contests",
    title: "The scoreboard and weekly contests",
    body: (
      <>
        <p>
          The scoreboard and the weekly contests rank traders by the estimated results of the setups they save. They&apos;re
          for fun and learning. You appear on them under your profile name, or as &ldquo;Trader&rdquo; and four characters
          if you haven&apos;t set one; never under your email.
        </p>
        <p>
          No purchase is needed to take part. If a contest ever has a prize, its rules and who can win are posted with
          it, and those rules apply. We may remove anyone who games the rankings, for example with several accounts.
        </p>
      </>
    ),
  },
  {
    id: "sharing",
    title: "Sharing setups",
    body: (
      <p>
        When you share a saved setup, anyone with the link can see that card and how it did. It doesn&apos;t show who
        saved it. Don&apos;t share a link anywhere you wouldn&apos;t want it seen.
      </p>
    ),
  },
  {
    id: "use",
    title: "Using HighStrike fairly",
    body: (
      <>
        <p>HighStrike is for your own personal use. You agree not to:</p>
        <ul>
          <li>Copy, resell or republish our setups, cards or other content in bulk</li>
          <li>Scrape, bulk-download or automate access to the site or the app</li>
          <li>Break into other accounts, game the scoreboard or contests, or interfere with how the site runs</li>
          <li>Use HighStrike for anything illegal</li>
        </ul>
        <p>We may suspend or close an account that breaks these rules.</p>
      </>
    ),
  },
  {
    id: "ours",
    title: "Our content",
    body: (
      <p>
        Everything on HighStrike (the setups, cards, software, videos, course material, names and logos) belongs to
        HighStrike or its licensors. Your account gives you a personal, non-transferable right to use it; it doesn&apos;t
        transfer any ownership. Sharing a saved setup through HighStrike&apos;s own share link is always fine.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes to HighStrike and these terms",
    body: (
      <p>
        We keep building HighStrike, so features will change, and some may be added, removed or paused. We may update
        these terms; the date at the top shows the latest version, and we&apos;ll tell you by email about any change that
        matters. Using HighStrike after a change means you accept it.
      </p>
    ),
  },
  {
    id: "liability",
    title: "Disclaimers and limits",
    body: (
      <>
        <p>
          HighStrike is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;. We don&apos;t promise it will be
          uninterrupted, error-free or right about any market, and we aren&apos;t responsible for trading losses or
          decisions you make using it.
        </p>
        <p>
          To the fullest extent the law allows, our total liability to you for anything to do with HighStrike is limited
          to the amount you paid us, if any, and we aren&apos;t liable for indirect or consequential losses, including
          lost profits.
        </p>
      </>
    ),
  },
  {
    id: "law",
    title: "Governing law",
    body: <p>These terms are governed by the laws of the State of Wyoming, United States.</p>,
  },
  {
    id: "contact",
    title: "Contact",
    body: (
      <p>
        Questions about these terms: <Mail />.
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalDoc
      eyebrow="Legal"
      title="Terms of Service"
      intro="The plain rules for using HighStrike, the free app for swiping options setups."
      sections={sections}
    />
  );
}
