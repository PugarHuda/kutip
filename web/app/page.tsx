import Link from "next/link";
import { getAAAddress, getSummarizerAAAddress, isAAEnabled } from "@/lib/agent-passport";
import { getAuthorStats, getLedgerAddress } from "@/lib/ledger";
import { listAuthors } from "@/lib/papers";
import { formatUSDC, explorerAddress } from "@/lib/kite";
import { facilitatorHandshake, PIEVERSE_URL } from "@/lib/pieverse";
import type { Address } from "viem";
import { MoneyFlow } from "@/components/money-flow";
import { ArrowRightIcon } from "@/components/icons";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomePage() {
  const aaAddress = isAAEnabled() ? getAAAddress() : null;
  const summarizerAddress = isAAEnabled() ? getSummarizerAAAddress() : null;
  const ledgerAddress = getLedgerAddress();

  const authors = listAuthors();
  const wallets = authors.map((a) => a.wallet as Address);
  const [stats, facilitator] = await Promise.all([
    getAuthorStats(wallets),
    facilitatorHandshake()
  ]);
  const totalPaid = stats.reduce((acc, s) => acc + s.earnings, 0n);
  const totalCitations = stats.reduce((acc, s) => acc + Number(s.citations), 0);
  const authorsPaid = stats.filter((s) => s.citations > 0n).length;

  return (
    <main className="pattern-grid relative px-10 pt-14 pb-16">
      <div className="max-w-[1280px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-14 items-center">
        <div className="lg:col-span-7">
          <div className="flex gap-2 mb-5">
            <span className="chip">
              <span className="status-dot status-dot--done" style={{ width: 6, height: 6 }} />
              Live on Kite testnet
            </span>
            <span
              className="chip chip--mono"
              style={{ background: "transparent", border: "1px solid var(--border)" }}
            >
              Hackathon 2026 · Novel track
            </span>
          </div>

          <h1 className="t-display-2xl max-w-[640px] m-0">
            The research agent<br />
            that <span className="text-kite-500">pays its sources.</span>
          </h1>

          <p className="t-body ink-2 max-w-[540px] mt-5" style={{ fontSize: 18, lineHeight: "28px" }}>
            Every citation triggers a payment to the author — in USDC, on Kite chain, in one
            second. Attestation, not attribution theater.
          </p>

          <p className="t-small ink-3 max-w-[540px] mt-3">
            <em className="t-serif not-italic text-kite-700">Kutip</em> (koo-teep) is Indonesian
            for <em className="t-serif">cite</em>.
          </p>

          <div className="flex gap-3 mt-8">
            <Link href="/research" className="btn btn--primary btn--lg">
              Start a research query <ArrowRightIcon />
            </Link>
            <Link href="/registry" className="btn btn--ghost btn--lg">
              See who&apos;s getting paid
            </Link>
          </div>

          <div className="flex gap-12 mt-12 pt-6 border-t border-token">
            <div>
              <div className="t-caption">Authors tracked</div>
              <div className="t-mono text-2xl font-semibold text-kite-700 mt-1 tracking-tight">
                {authorsPaid} / {authors.length}
              </div>
            </div>
            <div>
              <div className="t-caption">Total paid out</div>
              <div className="t-mono text-2xl font-semibold text-kite-700 mt-1 tracking-tight">
                {formatUSDC(totalPaid)} USDC
              </div>
            </div>
            <div>
              <div className="t-caption">Citations attested</div>
              <div className="t-mono text-2xl font-semibold text-kite-700 mt-1 tracking-tight">
                {totalCitations}
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="card-elev p-6 pb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="t-caption">How the money moves</span>
              <span className="chip chip--success">
                <span
                  className="status-dot status-dot--done animate-pulse-dot"
                  style={{ width: 6, height: 6 }}
                />
                live
              </span>
            </div>
            <MoneyFlow />
          </div>

          {(aaAddress || ledgerAddress) && (
            <div className="mt-4 card p-4 text-sm flex flex-col gap-3">
              {aaAddress && (
                <IdentityRow
                  label="Researcher (AA)"
                  badge="Main agent"
                  value={aaAddress}
                  sub="EIP-4337 smart account · pays authors"
                />
              )}
              {summarizerAddress && (
                <IdentityRow
                  label="Summarizer (AA)"
                  badge="Sub-agent"
                  value={summarizerAddress}
                  sub="Receives 5% per query from the Researcher"
                />
              )}
              {ledgerAddress && (
                <IdentityRow
                  label="AttributionLedger"
                  badge="Settles here"
                  value={ledgerAddress}
                  sub="Revenue split contract"
                />
              )}
              {facilitator.reachable && (
                <details className="pt-3 border-t border-token group">
                  <summary className="t-small ink-3 cursor-pointer list-none flex items-center justify-between hover:text-kite-700">
                    <span>Infrastructure details</span>
                    <span className="t-mono-sm ink-3 group-open:rotate-180 transition-transform">
                      ▾
                    </span>
                  </summary>
                  <div className="mt-3 flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="t-caption">x402 facilitator</span>
                        <span
                          className="chip chip--success"
                          style={{ padding: "1px 7px", fontSize: 10 }}
                        >
                          Live · {facilitator.latencyMs}ms
                        </span>
                      </div>
                      <a
                        href={PIEVERSE_URL}
                        target="_blank"
                        rel="noreferrer"
                        className="block t-mono-sm text-kite-700 hover:text-kite-500 break-all"
                      >
                        {PIEVERSE_URL.replace("https://", "")}
                      </a>
                      <div className="t-small ink-3 mt-0.5">
                        Pieverse v{facilitator.version ?? "?"} · Kite testnet{" "}
                        {facilitator.supportsKiteTestnet ? "supported" : "not found"}
                      </div>
                    </div>
                  </div>
                </details>
              )}
            </div>
          )}
        </div>
      </div>

      <section className="max-w-[1280px] mx-auto mt-20">
        <div className="flex items-baseline justify-between mb-5">
          <h2 className="t-h2 m-0">Built on six primitives, not one.</h2>
          <span className="t-small ink-3 hidden sm:inline">
            Tap any tile to inspect it live
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <FeatureTile
            href="/gasless"
            icon={<GasIcon />}
            title="Gasless"
            subtitle="Paymaster covers KITE, agent pays in USDC"
          />
          <FeatureTile
            href="/research"
            icon={<SignatureIcon />}
            title="Passport session"
            subtitle="Sign once, agent spends within caps"
            accent="indigo"
          />
          <FeatureTile
            href="/claim"
            icon={<OrcidIcon />}
            title="ORCID OAuth"
            subtitle="Real ownership proof, on-chain binding"
            accent="emerald"
          />
          <FeatureTile
            href="/verify"
            icon={<ChainIcon />}
            title="Cross-chain"
            subtitle="Mirror receipts to Avalanche Fuji"
            accent="rose"
          />
          <FeatureTile
            href="/governance"
            icon={<SafeIcon />}
            title="Safe 2-of-3"
            subtitle="No single person moves the funds"
            accent="amber"
          />
          <FeatureTile
            href="https://github.com/PugarHuda/kutip/tree/main/mcp"
            external
            icon={<PlugIcon />}
            title="MCP server"
            subtitle="Accessible from Claude Desktop"
            accent="cyan"
          />
        </div>
      </section>

      <footer className="max-w-[1280px] mx-auto mt-20 pt-5 border-t border-token">
        <span className="t-small ink-3">Built on Kite testnet · Hackathon 2026</span>
      </footer>
    </main>
  );
}

function FeatureTile({
  href,
  icon,
  title,
  subtitle,
  accent = "kite",
  external
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  accent?: "kite" | "indigo" | "emerald" | "rose" | "amber" | "cyan";
  external?: boolean;
}) {
  const accentColor: Record<string, string> = {
    kite: "#5566ff",
    indigo: "#6366f1",
    emerald: "#10b981",
    rose: "#ec4899",
    amber: "#f59e0b",
    cyan: "#06b6d4"
  };
  const color = accentColor[accent];

  const content = (
    <>
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
        style={{
          background: `color-mix(in srgb, ${color} 14%, transparent)`,
          color
        }}
      >
        {icon}
      </div>
      <div className="t-h3 text-[15px] font-semibold">{title}</div>
      <div className="t-small ink-3 mt-1 leading-snug">{subtitle}</div>
    </>
  );

  const base =
    "card p-4 hover:surface-raised transition-colors no-underline text-inherit block";

  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={base}>
        {content}
      </a>
    );
  }
  return (
    <Link href={href} className={base}>
      {content}
    </Link>
  );
}

function GasIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h9V4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v17Z" />
      <path d="M12 9h2.5a2.5 2.5 0 0 1 2.5 2.5V17a2 2 0 0 0 4 0v-6l-4-4" />
    </svg>
  );
}
function SignatureIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 19c-3 0-3-2-6-2s-3 2-6 2-3-2-6-2" />
      <path d="M4 15c3-11 10-9 11 0" />
    </svg>
  );
}
function OrcidIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9v8M9 7v.01M12 10h3a4 4 0 0 1 0 8h-3V10Z" />
    </svg>
  );
}
function ChainIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 17H7A5 5 0 0 1 7 7h2M15 7h2a5 5 0 0 1 0 10h-2M8 12h8" />
    </svg>
  );
}
function SafeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 9v-2M12 17v-2" />
    </svg>
  );
}
function PlugIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22v-5M9 9V2M15 9V2M5 9h14l-1 6a5 5 0 0 1-5 4h-2a5 5 0 0 1-5-4L5 9Z" />
    </svg>
  );
}

function IdentityRow({
  label,
  badge,
  value,
  sub
}: {
  label: string;
  badge: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="t-caption">{label}</span>
          <span className="chip" style={{ padding: "1px 7px", fontSize: 10 }}>
            {badge}
          </span>
        </div>
        <a
          href={explorerAddress(value as `0x${string}`)}
          target="_blank"
          rel="noreferrer"
          className="block t-mono-sm text-kite-700 hover:text-kite-500 break-all"
        >
          {value}
        </a>
        <div className="t-small ink-3 mt-0.5">{sub}</div>
      </div>
    </div>
  );
}
