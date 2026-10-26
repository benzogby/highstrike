import Link from "next/link";
import { Cormorant_Garamond, Hanken_Grotesk } from "next/font/google";
import { createClient } from "@supabase/supabase-js";
import Footer from "@/components/Footer";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/lib/supabaseConfig";

// The HighStrike design system's two families (docs/design-system.md). Loaded
// here rather than in the root layout, so only pages that use them fetch them.
const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["500", "600"],
  style: ["normal", "italic"],
});

const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

// The brand mark an admin uploaded (Admin ▸ Site), else the built-in favicon.
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

// White, a hairline below, the bull mark in black. The rest of the site keeps
// the shared Header with its theme toggle; [data-landing] holds this page light.
function LandingHeader({ logo }: { logo: string }) {
  const anchor = "hidden px-3 py-2 text-[14px] text-lx-ink-2 transition-colors hover:text-lx-ink md:inline-flex";
  return (
    <header className="sticky top-0 z-40 border-b border-lx-line bg-white">
      <div className="mx-auto flex h-[68px] max-w-[1240px] items-center justify-between gap-3 px-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5 text-lx-ink">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} alt="" width={28} height={28} className="h-7 w-7 brightness-0" />
          <span className="font-lx-serif text-[22px] font-medium leading-none sm:text-[24px]">HighStrike</span>
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1 sm:gap-2">
          <a href="#briefing" className={anchor}>
            The briefing
          </a>
          <a href="#record" className={anchor}>
            The record
          </a>
          <a href="#membership" className={anchor}>
            Membership
          </a>
          <Link
            href="/signin"
            className="whitespace-nowrap px-2 py-2 text-[14px] text-lx-ink-2 transition-colors hover:text-lx-ink sm:px-3"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="inline-flex h-10 items-center whitespace-nowrap rounded-[4px] bg-lx-ink px-3.5 text-[13.5px] font-medium text-white transition-colors hover:bg-[#262628] sm:px-4 sm:text-[14px]"
          >
            Start free trial
          </Link>
        </nav>
      </div>
    </header>
  );
}

export default async function LandingLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div data-landing className={`${cormorant.variable} ${hanken.variable} bg-white font-lx-sans text-lx-ink`}>
      <LandingHeader logo={await logoUrl()} />
      {children}
      <Footer />
    </div>
  );
}
