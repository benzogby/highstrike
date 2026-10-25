import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import Footer from "@/components/Footer";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/lib/supabaseConfig";

// The brand mark an admin uploaded (Admin ▸ Site), else the built-in favicon.
async function logoUrl() {
  try {
    const { data } = await createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
      .from("site_settings")
      .select("key, value")
      .in("key", ["logo_dark", "logo"]);
    const map = Object.fromEntries((data ?? []).filter((r) => r.value).map((r) => [r.key, r.value as string]));
    return map.logo_dark ?? map.logo ?? "/api/site/favicon";
  } catch {
    return "/api/site/favicon";
  }
}

// The homepage has its own dark header (the rest of the site keeps the shared
// Header with its theme toggle). [data-landing] switches globals.css to the
// dark tokens for as long as this page is open.
function LandingHeader({ logo }: { logo: string }) {
  return (
    <header className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-4">
      <Link href="/" className="flex items-center gap-2.5 text-ink">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} alt="" width={34} height={34} className="h-[34px] w-[34px]" />
        <span className="font-display text-[19px] tracking-[-0.01em]">HighStrike</span>
      </Link>
      <nav aria-label="Main" className="flex items-center gap-1">
        <a href="#what" className="hidden px-3 py-2.5 text-sm text-ink-2 transition hover:text-ink md:inline-flex">
          What you get
        </a>
        <a href="#results" className="hidden px-3 py-2.5 text-sm text-ink-2 transition hover:text-ink md:inline-flex">
          Results
        </a>
        <Link href="/signin" className="px-3 py-2.5 text-sm text-ink-2 transition hover:text-ink">
          Sign in
        </Link>
        <Link
          href="/signup"
          className="press whitespace-nowrap rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-bg transition hover:bg-white"
        >
          Try free
        </Link>
      </nav>
    </header>
  );
}

export default async function LandingLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div data-landing>
      <LandingHeader logo={await logoUrl()} />
      {children}
      <Footer />
    </div>
  );
}
