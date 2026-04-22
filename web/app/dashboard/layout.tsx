"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { BrandMark } from "@/components/icons";
import { ConnectWallet } from "@/components/connect-wallet";
import { ThemeToggle } from "@/components/theme-toggle";

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  match: (p: string) => boolean;
  group?: "main" | "author" | "infra";
}

function Icon({ d }: { d: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  );
}

const NAV: NavItem[] = [
  {
    href: "/dashboard",
    label: "Research",
    group: "main",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.3-4.3" />
      </svg>
    ),
    match: (p) => p === "/dashboard" || p === "/research"
  },
  {
    href: "/dashboard/overview",
    label: "Overview",
    group: "main",
    icon: <Icon d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" />,
    match: (p) => p.startsWith("/dashboard/overview")
  },
  {
    href: "/dashboard/activity",
    label: "Activity",
    group: "main",
    icon: <Icon d="M22 12h-4l-3 9L9 3l-3 9H2" />,
    match: (p) => p.startsWith("/dashboard/activity")
  },
  {
    href: "/dashboard/earnings",
    label: "Earnings",
    group: "main",
    icon: <Icon d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />,
    match: (p) => p.startsWith("/dashboard/earnings")
  },
  {
    href: "/dashboard/claim",
    label: "Claim as Author",
    group: "author",
    icon: <Icon d="M20 6 9 17l-5-5" />,
    match: (p) => p.startsWith("/dashboard/claim") || p === "/claim"
  },
  {
    href: "/dashboard/verify",
    label: "Verify attestation",
    group: "author",
    icon: <Icon d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />,
    match: (p) => p.startsWith("/dashboard/verify") || p.startsWith("/verify")
  },
  {
    href: "/dashboard/leaderboard",
    label: "Leaderboard",
    group: "author",
    icon: <Icon d="M3 3v18h18M9 17V9M15 17V5M21 17v-7" />,
    match: (p) => p.startsWith("/dashboard/leaderboard") || p.startsWith("/leaderboard")
  },
  {
    href: "/dashboard/gasless",
    label: "Gasless",
    group: "infra",
    icon: <Icon d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />,
    match: (p) => p.startsWith("/dashboard/gasless") || p.startsWith("/gasless")
  },
  {
    href: "/dashboard/governance",
    label: "Governance",
    group: "infra",
    icon: <Icon d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
    match: (p) => p.startsWith("/dashboard/governance") || p.startsWith("/governance")
  },
  {
    href: "/dashboard/agents",
    label: "Agent Registry",
    group: "infra",
    icon: <Icon d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M23 21v-2a4 4 0 0 0-3-3.87M13 3.13a4 4 0 0 1 0 7.75M9 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0z" />,
    match: (p) => p.startsWith("/dashboard/agents") || p.startsWith("/agents")
  },
  {
    href: "/dashboard/bounties",
    label: "Bounties",
    group: "infra",
    icon: <Icon d="M12 2 15 8l6 .75-4.5 4.1 1.2 6.15L12 16l-5.7 3 1.2-6.15L3 8.75 9 8z" />,
    match: (p) => p.startsWith("/dashboard/bounties") || p.startsWith("/bounties")
  },
  {
    href: "/dashboard/escrow",
    label: "Escrow Yield",
    group: "infra",
    icon: <Icon d="M21 12a9 9 0 1 1-9-9M21 3v6h-6" />,
    match: (p) => p.startsWith("/dashboard/escrow") || p.startsWith("/escrow")
  }
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <aside
        className={`
          fixed lg:sticky top-0 left-0 h-screen z-40
          w-[240px] lg:w-[220px] flex-none
          border-r border-token surface
          transition-transform duration-200
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0
          flex flex-col
        `}
        aria-label="Dashboard navigation"
      >
        <div className="px-5 py-4 border-b border-token">
          <Link
            href="/"
            className="flex items-center gap-2 no-underline text-inherit"
          >
            <BrandMark size={22} />
            <span className="font-display text-[18px] font-bold tracking-[-0.015em]">
              Kutip
            </span>
            <span className="ml-auto px-2 py-0.5 rounded-full bg-kite-100 text-kite-700 text-[10px] font-medium tracking-wide">
              v0.1
            </span>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2">
          <SectionLabel>Agent</SectionLabel>
          {NAV.filter((n) => n.group === "main").map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={item.match(pathname)}
              onClick={() => setMobileOpen(false)}
            />
          ))}

          <SectionLabel>Author</SectionLabel>
          {NAV.filter((n) => n.group === "author").map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={item.match(pathname)}
              onClick={() => setMobileOpen(false)}
            />
          ))}

          <SectionLabel>Infrastructure</SectionLabel>
          {NAV.filter((n) => n.group === "infra").map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={item.match(pathname)}
              onClick={() => setMobileOpen(false)}
            />
          ))}
        </nav>

        <div className="px-4 py-3 border-t border-token flex items-center justify-between">
          <Link
            href="/"
            className="t-small ink-3 hover:text-kite-500 transition-colors"
          >
            ← Exit to Home
          </Link>
          <ThemeToggle />
        </div>
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="sticky top-0 z-20 flex items-center justify-between px-5 py-3 border-b border-token surface">
          <button
            type="button"
            className="lg:hidden flex items-center gap-2 t-small"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 12h18M3 6h18M3 18h18" />
            </svg>
            Menu
          </button>

          <div className="hidden lg:flex items-center gap-2 t-small ink-3">
            <span className="chip chip--success">
              <span
                className="status-dot status-dot--done animate-pulse-dot"
                style={{ width: 6, height: 6 }}
              />
              Kite testnet · chain 2368
            </span>
          </div>

          <ConnectWallet />
        </div>

        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-3 pt-3 pb-1 t-caption ink-3">{children}</div>
  );
}

function NavLink({
  item,
  active,
  onClick
}: {
  item: NavItem;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13.5px] transition-colors no-underline"
      style={
        active
          ? {
              background: "color-mix(in srgb, var(--kite-500) 10%, transparent)",
              color: "var(--kite-700)",
              fontWeight: 600
            }
          : { color: "var(--ink-2)" }
      }
    >
      <span
        className="flex-none"
        style={active ? { color: "var(--kite-500)" } : {}}
      >
        {item.icon}
      </span>
      <span>{item.label}</span>
    </Link>
  );
}
