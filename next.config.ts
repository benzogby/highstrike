import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Tabs a member has just opened come back instantly from the browser's copy for 30 s instead of asking the server
    // again (Ben, 2026-11-02: "tab change clicks to work much quicker"). Saves still refresh what they change: Settings
    // calls router.refresh() and the server actions revalidate their paths.
    staleTimes: { dynamic: 30, static: 180 },
  },
  // Old addresses that still get visits and links, sent on for good (308).
  async redirects() {
    return [
      // The scanner runs on rules, never AI (Ben, 2026-11-03), so the post about it took a new address (src/lib/posts.ts).
      {
        source: "/blog/how-the-ai-reads-the-market-every-morning",
        destination: "/blog/how-the-smart-scanner-reads-the-market-every-morning",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
