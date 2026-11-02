import type { Metadata, Viewport } from "next";
import { Inter, IBM_Plex_Mono, Cal_Sans } from "next/font/google";
import TrackPageview from "./TrackPageview";
import CookieBanner from "./CookieBanner";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const calSans = Cal_Sans({
  variable: "--font-cal-sans",
  subsets: ["latin"],
  weight: "400",
  // next/font has no metrics for Cal Sans, so it can't build a size-matched fallback.
  adjustFontFallback: false,
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "HighStrike — Everything You Need to Win in the Markets, Powered by AI",
  description:
    "Daily trade setups, entries, targets, and market analysis generated for you so you can focus on execution, not research.",
  metadataBase: new URL("https://www.highstrike.com"),
  icons: { icon: "/api/site/favicon" },
  openGraph: {
    title: "HighStrike — Everything You Need to Win in the Markets, Powered by AI",
    description:
      "Daily trade setups, entries, targets, and market analysis generated for you so you can focus on execution, not research.",
    type: "website",
  },
};

/** Dark only: the browser draws its own controls and scrollbars dark, and phones tint their chrome to the ground. */
export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#0a0f12",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      // The font variables live on <html> so the theme's --font-* tokens, which are
      // resolved on :root, can see them (on <body> they resolved to nothing).
      className={`${inter.variable} ${calSans.variable} ${plexMono.variable}`}
    >
      <head>
        <script
          // Marks script support before first paint. The site is dark only (Ben, 2026-11-02), so a theme stored by the
          // old light/dark switch is cleared.
          dangerouslySetInnerHTML={{
            __html: `document.documentElement.classList.add("js");try{localStorage.removeItem("hs-theme")}catch(e){}`,
          }}
        />
      </head>
      <body
        className="antialiased"
      >
        <TrackPageview />
        {children}
        <CookieBanner />
      </body>
    </html>
  );
}
