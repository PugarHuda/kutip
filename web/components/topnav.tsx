"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRightIcon, BrandMark, CheckIcon } from "./icons";
import { ThemeToggle } from "./theme-toggle";
import { ConnectWallet } from "./connect-wallet";

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

      <div className="flex gap-2 items-center">
        <ThemeToggle />
        <span className="chip chip--success hidden sm:inline-flex">
          <CheckIcon size={10} />
          <span>Kite testnet</span>
        </span>
        <ConnectWallet />
        <Link
          href="/dashboard"
          className="btn btn--primary btn--sm ml-1"
        >
          <span className="hidden sm:inline">Enter Dashboard</span>
          <span className="sm:hidden">Dashboard</span>
          <ArrowRightIcon size={14} />
        </Link>
      </div>
    </nav>
  );
}
