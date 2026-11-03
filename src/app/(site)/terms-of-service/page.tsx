import type { Metadata } from "next";
import Link from "next/link";
import { LegalDoc, Mail, type LegalSection } from "@/components/LegalDoc";
import { LEGAL } from "@/lib/legal";
import { MONTHLY_PRICE, TRIAL_PRICE } from "@/lib/offer";

export const metadata: Metadata = {
  title: "Terms of Service — HighStrike",
  description:
    "The terms for using HighStrike and its membership ($14 for your first week, then $99/month until you cancel): what it is, what it isn't (financial advice), and what you and we agree to.",
};

const sections: LegalSection[] = [
  {
    id: "who",
    title: "Who we are",
    body: (
      <>
        <p>
          HighStrike is owned and operated by ZERO DTE HOLDINGS LLC, a Wyoming limited liability
          company (&ldquo;HighStrike&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;). These terms cover highstrike.com, the
          HighStrike app and everything in it.
        </p>
        <p>
          By creating an account, buying the membership or using the site, you agree to these terms and to our{" "}
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
        <p>HighStrike is an options-research and education service. A membership includes:</p>
        <ul>
          <li>
            The smart scanner&apos;s daily trade ideas, each with an entry, target, time frame and written reasoning, and
            where there&apos;s enough price history, a suggested option with an estimated price
          </li>
          <li>The tools: the terminal, the scanner, price alerts, insider filings, the crowd and the app on your phone</li>
          <li>HighStrike Trading School, the course library, the live recordings included</li>
          <li>Updates to all of the above</li>
        </ul>
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
          Ideas, scores, estimated option prices and write-ups are produced by software following set rules, and can be
          wrong, late or incomplete. An option price marked &ldquo;est.&rdquo; is an estimate from the stock&apos;s own
          past moves, not a live quote; check the real price at your broker. Market data comes from third parties and may
          be delayed or contain errors. Results we publish are past results; they don&apos;t promise yours.
        </p>
      </>
    ),
  },
  {
    id: "account",
    title: "Your account",
    body: (
      <ul>
        <li>You must be at least 18 years old to use HighStrike.</li>
        <li>Give us a real email address and keep your password (or your Google account) secure.</li>
        <li>
          A membership is for one person. Don&apos;t share your login or let others use your account; we may close
          accounts that are shared.
        </li>
        <li>You&apos;re responsible for what happens under your account.</li>
      </ul>
    ),
  },
  {
    id: "membership",
    title: "The membership, your first week and payment",
    body: (
      <>
        <p>
          The HighStrike membership costs <strong>{TRIAL_PRICE} (US dollars) for your first 7 days</strong>, then{" "}
          <strong>{MONTHLY_PRICE} per month</strong>. Access to everything starts as soon as your first payment goes
          through.
        </p>
        <p>
          <strong>It renews automatically.</strong> Unless you cancel before your first week ends, your membership renews
          at {MONTHLY_PRICE} per month, charged to the card you paid with on the day your week ends and on the same day
          each month after, until you cancel. You agree to this when you tick the box at checkout.
        </p>
        <p>
          <strong>One first week per person.</strong> The {TRIAL_PRICE} week is for new members. If your email, account or
          card has had one before, your membership starts at {MONTHLY_PRICE} per month, and checkout tells you so before
          anything is charged.
        </p>
        <p>
          Payments are processed by Stripe. We never see or store your full card number. If the price ever changes,
          we&apos;ll email members at least 30 days before it applies to them, so you can cancel first.
        </p>
      </>
    ),
  },
  {
    id: "cancel",
    title: "Cancelling",
    body: (
      <>
        <p>
          You can cancel anytime in Settings → Billing, on Stripe&apos;s secure billing page, in a couple of clicks.
        </p>
        <ul>
          <li>Cancel during your first week and you&apos;re never charged {MONTHLY_PRICE}. Your access lasts until the week ends.</li>
          <li>Cancel later and your access lasts until the end of the month you&apos;ve paid for. Nothing more is charged.</li>
        </ul>
        <p>
          Trouble cancelling? Email <Mail /> and we&apos;ll cancel it for you.
        </p>
      </>
    ),
  },
  {
    id: "failed-payments",
    title: "If a payment fails",
    body: (
      <p>
        If a monthly payment doesn&apos;t go through, your access pauses right away and we email you. Paying it with any
        card opens everything again at once. Stripe may try the card again for a while; if the payment is still missing
        after that, the membership ends.
      </p>
    ),
  },
  {
    id: "refunds",
    title: "Refunds",
    body: (
      <>
        <p>
          <strong>Payments are final.</strong> The first week and each month give you instant access to everything, the
          full course library included, so they aren&apos;t refundable, partial months included. That includes an account
          closed for breaking these terms. You can cancel anytime, so the next payment never comes.
        </p>
        <p>
          If you were charged by mistake, for example twice, email <Mail /> and we&apos;ll put it right. Nothing here
          takes away any right the law gives you that can&apos;t be waived.
        </p>
      </>
    ),
  },
  {
    id: "use",
    title: "Using HighStrike fairly",
    body: (
      <>
        <p>HighStrike is for your own personal use. You agree not to:</p>
        <ul>
          <li>Copy, resell, republish or share our setups, alerts, videos or course material</li>
          <li>Scrape, bulk-download or automate access to the site or the app</li>
          <li>Try to get around the paywall, break into other accounts, or interfere with how the site runs</li>
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
        Everything on HighStrike (the setups, write-ups, software, videos, course material, names and logos) belongs to
        HighStrike or its licensors. Your membership gives you a personal, non-transferable right to use it; it
        doesn&apos;t transfer any ownership.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes to HighStrike and these terms",
    body: (
      <p>
        We keep improving HighStrike, so features will change, and some may be added or removed. We may update these
        terms; the date at the top shows the latest version, and we&apos;ll tell members by email about any change that
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
          to the amount you paid us, and we aren&apos;t liable for indirect or consequential losses, including lost
          profits.
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
      intro="The plain rules for using HighStrike and its membership: $14 for your first week, then $99/month until you cancel."
      sections={sections}
    />
  );
}
