import type { NextConfig } from "next";

/**
 * Security headers on every response (the security review, 2026-11-20; docs/security-checklist.md): HTTPS only for two
 * years, no MIME sniffing, no framing by other sites, no referrer path sent to other sites, browser features the app
 * doesn't use switched off, and a CSP for the things that can be pinned without breaking Stripe, Supabase or YouTube
 * (frames, plugins, the base URL, form targets). Payment is left to Stripe's frames for Apple Pay.
 */
const SECURITY_HEADERS = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), usb=(), serial=(), bluetooth=(), hid=(), browsing-topics=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'self'; base-uri 'self'; object-src 'none'; form-action 'self' https://checkout.stripe.com https://accounts.google.com; upgrade-insecure-requests",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  experimental: {
    // Tabs a member has just opened come back instantly from the browser's copy for 30 s instead of asking the server
    // again (Ben, 2026-11-02: "tab change clicks to work much quicker"). Saves still refresh what they change: Settings
    // calls router.refresh() and the server actions revalidate their paths.
    staleTimes: { dynamic: 30, static: 180 },
  },
  // Old addresses that still get visits and links, sent on for good (308).
  async redirects() {
    return [
      // Ben removed the Results page on 2026-11-03: its numbers were typed in by hand and nothing updated them. Members
      // see every graded idea, wins and losses, on Ideas' Track record.
      { source: "/results", destination: "/", permanent: true },
      // The scanner runs on rules, never AI (Ben, 2026-11-03), so the post about it took a new address (src/lib/posts.ts).
      {
        source: "/blog/how-the-ai-reads-the-market-every-morning",
        destination: "/blog/how-the-smart-scanner-reads-the-market-every-morning",
        permanent: true,
      },
      // Setups became Ideas' Track record tab (Ben, 2026-11-03), so old links and bookmarks land there for good.
      { source: "/setups", destination: "/ideas/record", permanent: true },
    ];
  },
};

export default nextConfig;
