import type { Metadata } from "next";
import { Inter, Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Highstrike — Stock Market Analytics",
  description:
    "Institutional-grade market analytics, screening, and real-time data — built for serious traders.",
  metadataBase: new URL("https://highstrike.vercel.app"),
  openGraph: {
    title: "Highstrike — Stock Market Analytics",
    description:
      "Institutional-grade market analytics, screening, and real-time data — built for serious traders.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${spaceGrotesk.variable} ${plexMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
