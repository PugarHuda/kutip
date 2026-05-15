import type { Metadata } from "next";
import { Inter, Inter_Tight, JetBrains_Mono, Newsreader } from "next/font/google";
import { TopNav } from "@/components/topnav";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap"
});
const interTight = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-inter-tight",
  display: "swap"
});
const newsreader = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  // Only the weights actually referenced anywhere: 600 for display
  // headings (t-display-2xl/xl/t-h1) and 400 italic for t-serif accents.
  // Was 4 weights × 2 styles = 8 files; trimming to 2×2 = 4 cuts the
  // font payload by ~40% with no visible change to current typography.
  weight: ["400", "600"],
  variable: "--font-newsreader",
  display: "swap"
});
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap"
});

export const metadata: Metadata = {
  title: "Kutip — Citations that pay.",
  description:
    "An autonomous AI research agent that pays cited authors in USDC, attested on Kite chain.",
  // icon.svg is auto-detected from app/icon.svg. We additionally point
  // apple-touch-icon at it so iOS 17+ (which gained SVG support) uses
  // the same vector mark instead of guessing a default URL. Older iOS
  // falls back gracefully — no PNG to ship, no build-time generation.
  icons: {
    apple: { url: "/icon.svg", type: "image/svg+xml" }
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      className={`${inter.variable} ${interTight.variable} ${newsreader.variable} ${jetbrains.variable}`}
    >
      <body className="font-sans min-h-screen antialiased">
        <Providers>
          <TopNav />
          {children}
        </Providers>
      </body>
    </html>
  );
}
