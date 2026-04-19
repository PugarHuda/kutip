import type { Metadata } from "next";
import { Inter, Inter_Tight, JetBrains_Mono, Newsreader } from "next/font/google";
import { TopNav } from "@/components/topnav";
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
  style: ["italic"],
  weight: ["400", "500"],
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
    "An autonomous AI research agent that pays cited authors in USDC, attested on Kite chain."
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
        <TopNav />
        {children}
      </body>
    </html>
  );
}
