import type { Metadata } from "next";
import { Inter, Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
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
  title: "HighStrike — Everything You Need to Win in the Markets, Powered by AI",
  description:
    "Daily trade setups, entries, targets, and market analysis generated for you so you can focus on execution, not research.",
  metadataBase: new URL("https://highstrike-one.vercel.app"),
  openGraph: {
    title: "HighStrike — Everything You Need to Win in the Markets, Powered by AI",
    description:
      "Daily trade setups, entries, targets, and market analysis generated for you so you can focus on execution, not research.",
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
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  );
}
