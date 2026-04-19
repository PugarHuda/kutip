"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark, CheckIcon, CopyIcon } from "./icons";
import { ThemeToggle } from "./theme-toggle";

const LINKS: {
  href: string;
  label: string;
  mobileLabel?: string;
  match: (p: string) => boolean;
}[] = [
  { href: "/", label: "Home", match: (p) => p === "/" },
  {
    href: "/research",
    label: "Research",
    match: (p) => p.startsWith("/research")
  },
  {
    href: "/registry",
    label: "Registry",
    match: (p) =>
      p.startsWith("/registry") ||
      p.startsWith("/agents") ||
      p.startsWith("/leaderboard") ||
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
  { href: "/verify", label: "Verify", match: (p) => p.startsWith("/verify") }
];

const WALLET_DISPLAY = "0x5c91…bf40c";

export function TopNav() {
  const pathname = usePathname();
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
        <button
          className="addr hidden sm:inline-flex"
          type="button"
          aria-label={`Copy wallet ${WALLET_DISPLAY}`}
          onClick={() => {
            navigator.clipboard?.writeText("0x5C91B851D9Aa20172e6067d9236920A6CBabf40c");
          }}
        >
          {WALLET_DISPLAY}
          <CopyIcon />
        </button>
      </div>
    </nav>
  );
}
