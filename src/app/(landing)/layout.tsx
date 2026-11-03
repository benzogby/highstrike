import Link from "next/link";
import LandingMotion from "@/components/landing/LandingMotion";
import { Bull } from "@/components/landing/Pieces";
import CookieSettings from "@/components/landing/CookieSettings";
import { LEGAL } from "@/lib/legal";
import "./landing.css";

// The homepage's own frame: a black bar with the bull and the word, fixed over
// the page as it scrolls; the footer with every link, the legal pages and who
// runs HighStrike. Swiping is the only product, free for now (2026-11-02), so
// there's no price and no floating buy bar. See landing.css.

/** The footer's columns: this page, the rest of the site, and the legal pages (with Cookie settings under them). */
const FOOT = [
  {
    title: "HighStrike",
    links: [
      { href: "/#how", label: "How it works" },
      { href: "/#cards", label: "On a card" },
      { href: "/#faq", label: "Questions" },
      { href: "/signup", label: "Start free" },
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
            <a href="#how">How it works</a>
            <a href="#cards">On a card</a>
            <a href="#faq">Questions</a>
          </nav>
          <Link href="/signin" className="hs-bar__signin">
            Sign in
          </Link>
          <Link href="/signup" className="hs-btn hs-btn--sm">
            Start free
          </Link>
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
              <p>Options setups you swipe: calls, puts, spreads and iron condors on 350+ stocks. Free while we build.</p>
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
      <LandingMotion />
    </div>
  );
}
