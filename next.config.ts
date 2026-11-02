import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Tabs a member has just opened come back instantly from the browser's copy for 30 s instead of asking the server
    // again (Ben, 2026-11-02: "tab change clicks to work much quicker"). Saves still refresh what they change: Settings
    // calls router.refresh() and the server actions revalidate their paths.
    staleTimes: { dynamic: 30, static: 180 },
  },
};

export default nextConfig;
