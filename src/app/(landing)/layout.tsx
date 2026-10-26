import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/lib/supabaseConfig";
import LandingMotion from "@/components/landing/LandingMotion";
import "./landing.css";

// The homepage's own frame: a plain bar on top and one quiet line at the foot
// (the rest of the site keeps the shared Header and Footer with the theme
// toggle). [data-landing] holds this page light; see landing.css.

const LEGAL = [
  "The information provided by HighStrike and HighStrike AI is for informational and educational purposes only and should not be considered financial, investment, or trading advice. HighStrike does not make recommendations to buy or sell any securities. Trade ideas, analysis and insights are market commentary and should not be relied upon as the basis for any investment decision.",
  "Trading and investing involve substantial risk, including the possible loss of principal. Past performance is not indicative of future results. Conduct your own research and consult a qualified financial advisor before making investment decisions. HighStrike and its operators are not responsible for trading losses or decisions that result from using the platform.",
];

async function logoUrl() {
  try {
    const { data } = await createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
      .from("site_settings")
      .select("key, value")
      .in("key", ["logo", "logo_dark"]);
    const map = Object.fromEntries((data ?? []).filter((r) => r.value).map((r) => [r.key, r.value as string]));
    return map.logo ?? map.logo_dark ?? "/api/site/favicon";
  } catch {
    return "/api/site/favicon";
  }
}

export default async function LandingLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const logo = await logoUrl();
  return (
    <div data-landing>
      <header className="hs-wrap hs-header">
        <Link href="/" className="hs-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} alt="" width={30} height={30} style={{ width: 30, height: 30 }} />
          HighStrike
        </Link>
        <nav className="hs-nav" aria-label="Main">
          <a href="#lookup" className="hs-nav__wide">
            Lookup
          </a>
          <a href="#how" className="hs-nav__wide">
            How it works
          </a>
          <a href="#record" className="hs-nav__wide">
            Record
          </a>
          <a href="#pricing" className="hs-nav__wide">
            Pricing
          </a>
          <Link href="/signin">Sign in</Link>
          <Link href="/signup" className="hs-button">
            Start free trial
          </Link>
        </nav>
      </header>

      {children}

      <footer className="hs-wrap hs-footer">
        <div className="hs-footer__legal">
          {LEGAL.map((p) => (
            <p key={p.slice(0, 24)}>{p}</p>
          ))}
          <p>
            Photographs, via Wikimedia Commons:{" "}
            <a href="https://commons.wikimedia.org/w/index.php?curid=3263404" className="hs-link" style={{ fontWeight: 400 }}>
              “NYSE Advanced Trading Floor”
            </a>{" "}
            by Asy arch, English Wikipedia,{" "}
            <a href="https://creativecommons.org/licenses/by-sa/3.0/" className="hs-link" style={{ fontWeight: 400 }}>
              CC BY-SA 3.0
            </a>
            , shown in grayscale;{" "}
            <a
              href="https://commons.wikimedia.org/wiki/File:Lower_Manhattan_at_Sunrise_(54090715629).jpg"
              className="hs-link"
              style={{ fontWeight: 400 }}
            >
              “Lower Manhattan at Sunrise”
            </a>{" "}
            by Eric Kilby,{" "}
            <a href="https://creativecommons.org/licenses/by-sa/2.0/" className="hs-link" style={{ fontWeight: 400 }}>
              CC BY-SA 2.0
            </a>
            , cropped.
          </p>
        </div>
        <div className="hs-footer__line">
          <span>AI options research, since 2018</span>
          <nav className="hs-footer__links" aria-label="Footer">
            <Link href="/pricing">Pricing</Link>
            <Link href="/results">Results</Link>
            <Link href="/about">About</Link>
            <a href="mailto:support@highstrike.com">Support</a>
            <Link href="/signin">Sign in</Link>
          </nav>
          <span>
            © 2026 HighStrike ·{" "}
            <a href="https://www.highstrike.com/privacy-policy" className="hs-link" style={{ fontWeight: 400 }}>
              Privacy
            </a>
          </span>
        </div>
      </footer>
      <LandingMotion />
    </div>
  );
}
