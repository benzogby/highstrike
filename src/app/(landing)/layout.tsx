import Link from "next/link";
import JoinButton from "@/components/join/JoinButton";
import LandingMotion from "@/components/landing/LandingMotion";
import { Bull } from "@/components/landing/Pieces";
import CookieSettings from "@/components/landing/CookieSettings";
import LandingDock from "@/components/landing/LandingDock";
import { LEGAL } from "@/lib/legal";
import { MONTHLY_PRICE, TRIAL_PRICE } from "@/lib/offer";
import "./landing.css";

// The homepage's own frame in the HighStrike reels system: a black bar with the
// bull and the word, fixed over the page as it scrolls; the footer with every
// link, the legal pages and who runs HighStrike; and the floating bar at the
// foot once the hero's button has gone (LandingDock). See landing.css.

/** The footer's columns: this page, the rest of the site, and the legal pages (with Cookie settings under them). */
const FOOT = [
  {
    title: "HighStrike",
    links: [
      { href: "/#scanner", label: "Smart scanner" },
      { href: "/#tools", label: "Tools" },
      { href: "/#trading-school", label: "Trading School" },
      { href: "/#app", label: "Mobile app" },
      { href: "/#pricing", label: "Pricing" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/blog", label: "Blog" },
      { href: "/about", label: "About" },
      { href: "/company", label: "Company" },
      { href: "/signin", label: "Sign in" },
      { href: "mailto:support@highstrike.com", label: "Support" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/terms-of-service", label: "Terms of Service" },
      { href: "/terms-of-service#refunds", label: "Refund policy" },
      { href: "/privacy-policy", label: "Privacy Policy" },
      { href: "/privacy-policy#cookies", label: "Cookie policy" },
    ],
  },
];

export default function LandingLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div data-landing="">
      <header className="hs-bar">
        <div className="hs-wrap hs-bar__in">
          <Link href="/" className="hs-brand" aria-label="HighStrike, home">
            <Bull />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="hs-brand__word" src="/brand/wordmark.png" alt="" width={85} height={17} />
          </Link>
          <nav className="hs-bar__links" aria-label="Main">
            <a href="#scanner">Scanner</a>
            <a href="#tools">Tools</a>
            <a href="#trading-school">Trading School</a>
            <a href="#app">App</a>
            <a href="#pricing">Pricing</a>
          </nav>
          <Link href="/signin" className="hs-bar__signin">
            Sign in
          </Link>
          <JoinButton className="hs-btn hs-btn--sm">Get HighStrike</JoinButton>
        </div>
      </header>

      {children}

      <footer className="hs-foot">
        <div className="hs-wrap">
          <div className="hs-foot__top">
            <div className="hs-foot__about">
              <Link href="/" className="hs-brand" aria-label="HighStrike, home">
                <Bull />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="hs-brand__word" src="/brand/wordmark.png" alt="" width={85} height={17} />
              </Link>
              <p>
                Options education, tools and smart scanning, since 2018. {TRIAL_PRICE} for your first week, then {MONTHLY_PRICE}/month.
              </p>
              <p>
                HighStrike is owned and operated by ZERO DTE HOLDINGS LLC, a Wyoming limited liability company.
                <br />
                <a href="mailto:support@highstrike.com">support@highstrike.com</a>
              </p>
            </div>
            {FOOT.map((col) => (
              <nav key={col.title} className="hs-foot__col" aria-label={col.title}>
                <h2>{col.title}</h2>
                <ul>
                  {col.links.map((l) => (
                    <li key={l.label}>
                      {l.href.startsWith("/") && !l.href.startsWith("/#") ? <Link href={l.href}>{l.label}</Link> : <a href={l.href}>{l.label}</a>}
                    </li>
                  ))}
                  {col.title === "Legal" && (
                    <li>
                      <CookieSettings />
                    </li>
                  )}
                </ul>
              </nav>
            ))}
          </div>
          <div className="hs-foot__legal">
            {LEGAL.map((p) => (
              <p key={p.slice(0, 24)}>{p}</p>
            ))}
          </div>
          <div className="hs-foot__base">
            <span>© {new Date().getFullYear()} ZERO DTE HOLDINGS LLC. All rights reserved.</span>
            <span>Market commentary and education, not investment advice.</span>
          </div>
        </div>
      </footer>
      <LandingDock price={TRIAL_PRICE} />
      <LandingMotion />
    </div>
  );
}
