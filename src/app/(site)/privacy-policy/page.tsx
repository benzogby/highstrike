import type { Metadata } from "next";
import Link from "next/link";
import { LegalDoc, Mail, type LegalSection } from "@/components/LegalDoc";

export const metadata: Metadata = {
  title: "Privacy Policy — HighStrike",
  description:
    "What HighStrike collects, why, who processes it for us (Supabase, Google, Stripe, Resend, Vercel) and how to have it deleted.",
};

const providers = [
  { name: "Supabase", does: "stores accounts and app data, handles sign-in and sends sign-in emails" },
  { name: "Google", does: "signs you in, if you choose Continue with Google" },
  { name: "Stripe", does: "takes the payment and keeps the payment record" },
  { name: "Resend", does: "sends the price-alert emails you set up" },
  { name: "Vercel", does: "hosts the site and app, and sees each request as it serves it" },
];

const sections: LegalSection[] = [
  {
    id: "who",
    title: "Who we are",
    body: (
      <p>
        HighStrike is owned and operated by ZERO DTE HOLDINGS LLC, a Wyoming limited liability company (&ldquo;we&rdquo;,
        &ldquo;us&rdquo;). This policy explains what we collect on highstrike.com and in the HighStrike app, and what we
        do with it. It goes with our <Link href="/terms-of-service">Terms of Service</Link>.
      </p>
    ),
  },
  {
    id: "collect",
    title: "What we collect",
    body: (
      <ul>
        <li>
          <strong>Your account:</strong> your email address and password (stored securely by our sign-in provider; we
          never see it in plain text). If you sign in with Google, we receive your name, email address and profile photo
          from Google.
        </li>
        <li>
          <strong>Your profile:</strong> the name, bio and picture you choose to add.
        </li>
        <li>
          <strong>What you set up in the app:</strong> your watchlists, price alerts and app activity.
        </li>
        <li>
          <strong>Your payment:</strong> Stripe takes your card details. We keep a Stripe customer ID and a record that
          you paid; we never see or store your full card number.
        </li>
        <li>
          <strong>Site visits:</strong> for each page view, the page, the site you came from, your device type (phone,
          tablet or desktop), your approximate location (country, region and city, worked out from your connection by our
          host), a random visitor ID kept in your browser, a session ID, and your account ID if you&apos;re signed in. We
          don&apos;t store your IP address.
        </li>
        <li>
          <strong>Messages:</strong> anything you send us by email, and your email address if you joined a waitlist.
        </li>
      </ul>
    ),
  },
  {
    id: "use",
    title: "How we use it",
    body: (
      <ul>
        <li>To run your account and give you the access you paid for</li>
        <li>To take payment and keep records the law requires</li>
        <li>To send the alert emails you ask for, and important emails about your account or these policies</li>
        <li>To see which pages people use, so we can improve the site</li>
        <li>To keep HighStrike secure and stop abuse, like shared or stolen accounts</li>
      </ul>
    ),
  },
  {
    id: "share",
    title: "Who processes it for us",
    body: (
      <>
        <p>We don&apos;t sell your information, and we don&apos;t use advertising networks. A few companies run parts of HighStrike for us and process data only to do that:</p>
        <ul>
          {providers.map((p) => (
            <li key={p.name}>
              <strong>{p.name}</strong> {p.does}
            </li>
          ))}
        </ul>
        <p>We may also share information if the law requires it, or with a buyer if HighStrike is ever sold.</p>
      </>
    ),
  },
  {
    id: "cookies",
    title: "Cookies and browser storage",
    body: (
      <p>
        We use cookies to keep you signed in, and your browser&apos;s storage to remember things like your theme and the
        random visitor ID above. Stripe sets its own cookies on the payment step to prevent fraud. We don&apos;t use
        advertising or cross-site tracking cookies.
      </p>
    ),
  },
  {
    id: "keep",
    title: "How long we keep it",
    body: (
      <p>
        We keep your account and app data for as long as you have an account. Page-view records are kept for a limited
        time and then deleted. Payment records are kept as long as tax and accounting law requires, even after an account
        is closed.
      </p>
    ),
  },
  {
    id: "choices",
    title: "Your choices",
    body: (
      <>
        <p>
          You can change your profile and turn off alerts in the app at any time. Email <Mail /> to see a copy of your
          data, correct it, or have your account and data deleted. We&apos;ll answer within 30 days.
        </p>
        <p>
          Depending on where you live (for example California or the EU), you may have further rights under local law;
          email us and we&apos;ll honor them.
        </p>
      </>
    ),
  },
  {
    id: "security",
    title: "Security",
    body: (
      <p>
        Data is encrypted in transit, and access to your account data is limited to you and to the HighStrike admins who
        run the service. No system is perfectly secure, but we work to protect what you trust us with.
      </p>
    ),
  },
  {
    id: "children",
    title: "Children",
    body: <p>HighStrike is for adults 18 and over. We don&apos;t knowingly collect information from anyone younger.</p>,
  },
  {
    id: "where",
    title: "Where your data is",
    body: <p>HighStrike is run from the United States. Your information is processed there and wherever the providers above run their services.</p>,
  },
  {
    id: "changes",
    title: "Changes to this policy",
    body: (
      <p>
        If we change this policy, we&apos;ll update the date at the top, and tell members by email about any change that
        matters.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    body: (
      <p>
        Questions about your privacy: <Mail />.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalDoc
      eyebrow="Legal"
      title="Privacy Policy"
      intro="What HighStrike collects, why, and how to have it deleted. No ad networks, and we never sell your data."
      sections={sections}
    />
  );
}
