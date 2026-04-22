import Link from "next/link";
import { ArrowRightIcon, BrandMark } from "@/components/icons";

export default function NotFound() {
  return (
    <main className="min-h-[calc(100vh-60px)] flex items-center justify-center px-6 py-16">
      <div className="max-w-[520px] text-center">
        <div className="flex items-center justify-center gap-2 mb-6">
          <BrandMark size={28} />
          <span className="font-display text-[22px] font-bold tracking-[-0.015em]">
            Kutip
          </span>
        </div>

        <div
          className="font-mono font-bold tracking-tight mb-2 text-kite-700"
          style={{ fontSize: 88, lineHeight: "88px" }}
        >
          404
        </div>

        <h1 className="t-h2 m-0">We lost this citation.</h1>
        <p className="t-body ink-2 mt-3 mb-7">
          The page you&apos;re looking for doesn&apos;t exist, or was moved when
          we reorganised the navigation. Here&apos;s where it probably lives
          now:
        </p>

        <div className="card p-4 flex flex-col gap-2 text-left">
          <QuickLink
            href="/dashboard"
            title="Dashboard"
            subtitle="Run a research query, see activity, earnings"
          />
          <QuickLink
            href="/dashboard/verify"
            title="Verify an attestation"
            subtitle="Paste a queryId to audit the on-chain receipt"
          />
          <QuickLink
            href="/dashboard/leaderboard"
            title="Author leaderboard"
            subtitle="Top earning researchers on Kite testnet"
          />
          <QuickLink
            href="/dashboard/claim"
            title="Claim via ORCID"
            subtitle="Bind your wallet to claim accrued payouts"
          />
        </div>

        <Link
          href="/"
          className="t-small ink-3 hover:text-kite-500 mt-7 inline-block transition-colors"
        >
          ← Back to landing
        </Link>
      </div>
    </main>
  );
}

function QuickLink({
  href,
  title,
  subtitle
}: {
  href: string;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:surface-raised transition-colors no-underline text-inherit"
    >
      <div>
        <div className="t-small font-semibold">{title}</div>
        <div className="t-small ink-3 mt-0.5">{subtitle}</div>
      </div>
      <ArrowRightIcon size={14} />
    </Link>
  );
}
