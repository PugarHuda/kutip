"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark, CheckIcon } from "./icons";
import { ThemeToggle } from "./theme-toggle";
import { ConnectWallet } from "./connect-wallet";

const LINKS: {
  href: string;
  label: string;
  mobileLabel?: string;
  match: (p: string) => boolean;
}[] = [
  { href: "/", label: "Home", match: (p) => p === "/" },
  {
    href: "/dashboard",
    label: "Dashboard",
    match: (p) => p.startsWith("/dashboard") || p.startsWith("/research")
  },
  {
    href: "/registry",
    label: "Registry",
    match: (p) =>
      p.startsWith("/registry") ||
      p.startsWith("/agents") ||
      p.startsWith("/leaderboard") ||
      p.startsWith("/authors") ||
      p.startsWith("/claim")
  },
  {
    href: "/market",
    label: "Market",
    match: (p) =>
      p.startsWith("/market") ||
      p.startsWith("/escrow") ||
      p.startsWith("/bounties")
  },
  {
    href: "/gasless",
    label: "Infra",
    match: (p) => p.startsWith("/gasless") || p.startsWith("/governance")
  },
  { href: "/verify", label: "Verify", match: (p) => p.startsWith("/verify") }
];

export function TopNav() {
  const pathname = usePathname();

  // Dashboard has its own sidebar + topbar — skip the marketing topnav there.
  if (pathname?.startsWith("/dashboard")) return null;

  return (
    <nav className="topnav">
      <Link href="/" className="flex items-center gap-2 no-underline text-inherit">
        <BrandMark size={22} />
        <span className="font-display text-[20px] font-bold tracking-[-0.015em]">Kutip</span>
        <span className="ml-1.5 px-2 py-0.5 rounded-full bg-kite-100 text-kite-700 text-[11px] font-medium tracking-wide">
          v0.1
        </span>
      </Link>

      <div className="flex gap-1 items-center flex-wrap">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="topnav__link"
            data-active={link.match(pathname)}
          >
            <span className="hidden sm:inline">{link.label}</span>
            <span className="sm:hidden">{link.mobileLabel ?? link.label}</span>
          </Link>
        ))}
      </div>

      <div className="flex gap-2 items-center">
        <ThemeToggle />
        <span className="chip chip--success">
          <CheckIcon size={10} />{" "}
          <span className="hidden sm:inline">Kite testnet</span>
          <span className="sm:hidden">Kite</span>
        </span>
        <ConnectWallet />
      </div>
    </nav>
  );
}
