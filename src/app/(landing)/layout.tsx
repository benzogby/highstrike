import Link from "next/link";
import JoinButton from "@/components/join/JoinButton";
import LandingMotion from "@/components/landing/LandingMotion";
import { Bull } from "@/components/landing/Pieces";
import "./landing.css";

// The homepage's own frame in the HighStrike reels system: a plain bar with the
// bull and the word on top, the legal lines at the foot (the rest of the site
// keeps the shared Header and Footer with the theme toggle). [data-landing]
// holds this page dark whatever the stored theme; see landing.css.

const LEGAL = [
  "The information provided by HighStrike and HighStrike AI is for informational and educational purposes only and should not be considered financial, investment, or trading advice. HighStrike does not make recommendations to buy or sell any securities. Trade ideas, analysis and insights are market commentary and should not be relied upon as the basis for any investment decision.",
  "Trading and investing involve substantial risk, including the possible loss of principal. Past performance is not indicative of future results. Conduct your own research and consult a qualified financial advisor before making investment decisions. HighStrike and its operators are not responsible for trading losses or decisions that result from using the platform.",
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
            <a href="#record">Record</a>
            <a href="#desk">The desk</a>
            <a href="#mastermind">Mastermind</a>
            <a href="#pricing">Pricing</a>
          </nav>
          <Link href="/signin" className="hs-bar__signin">
            Sign in
          </Link>
          <JoinButton className="hs-btn hs-btn--sm">Get access</JoinButton>
        </div>
      </header>

      {children}

      <footer className="hs-foot">
        <div className="hs-wrap">
          <div className="hs-foot__line">
            <Link href="/" className="hs-brand" aria-label="HighStrike, home">
              <Bull />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="hs-brand__word" src="/brand/wordmark.png" alt="" width={85} height={17} />
            </Link>
            <nav className="hs-foot__links" aria-label="Footer">
              <a href="#pricing">Pricing</a>
              <Link href="/results">Results</Link>
              <Link href="/about">About</Link>
              <a href="mailto:support@highstrike.com">Support</a>
              <Link href="/signin">Sign in</Link>
              <a href="https://www.highstrike.com/privacy-policy">Privacy</a>
            </nav>
            <span className="hs-foot__c">© 2026 HighStrike · AI options research, since 2018</span>
          </div>
          <div className="hs-foot__legal">
            {LEGAL.map((p) => (
              <p key={p.slice(0, 24)}>{p}</p>
            ))}
          </div>
        </div>
      </footer>
      <LandingMotion />
    </div>
  );
}
