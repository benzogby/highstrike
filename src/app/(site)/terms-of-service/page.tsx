import type { Metadata } from "next";
import Link from "next/link";
import { LegalDoc, Mail, type LegalSection } from "@/components/LegalDoc";
import { LEGAL } from "@/lib/legal";
import { LIFETIME_PRICE } from "@/lib/offer";

export const metadata: Metadata = {
  title: "Terms of Service — HighStrike",
  description:
    "The terms for using HighStrike and buying its lifetime membership: what it is, what it isn't (financial advice), and what you and we agree to.",
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
          <li>The daily trade setups, each with an entry, target, time frame and written reasoning</li>
          <li>The tools: the AI terminal, the flow scanner, price alerts, insider filings and the crowd</li>
          <li>The Alpha Mastermind course library, the live recordings included</li>
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
          Setups, scores and write-ups are produced in part by software and AI and can be wrong, late or incomplete. Market
          data comes from third parties and may be delayed or contain errors. Results we publish are past results; they
          don&apos;t promise yours.
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
    title: "The lifetime membership and payment",
    body: (
      <>
        <p>
          HighStrike Lifetime Access costs {LIFETIME_PRICE} (US dollars), paid once by card. There is no subscription
          and nothing renews. Access starts as soon as the payment goes through.
        </p>
        <p>
          <strong>Lifetime means for as long as HighStrike runs.</strong> It is the lifetime of the service, not of the
          buyer. If we ever shut HighStrike down, the membership ends with it.
        </p>
        <p>
          Payments are processed by Stripe. We never see or store your full card number. We may change the price for new
          buyers at any time; that doesn&apos;t change what you paid or what you have.
        </p>
      </>
    ),
  },
  {
    id: "refunds",
    title: "Refunds",
    body: (
      <>
        <p>
          <strong>All sales are final.</strong> The membership gives you instant access to everything, the full course
          library included, so the {LIFETIME_PRICE} payment is not refundable. That includes an account closed for
          breaking these terms.
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
      intro="The plain rules for using HighStrike and buying the lifetime membership."
      sections={sections}
    />
  );
}
