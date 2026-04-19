import Link from "next/link";
import { getAAAddress, getSummarizerAAAddress, isAAEnabled } from "@/lib/agent-passport";
import { getAuthorStats, getLedgerAddress } from "@/lib/ledger";
import { listAuthors } from "@/lib/papers";
import { formatUSDC, explorerAddress } from "@/lib/kite";
import { facilitatorHandshake, PIEVERSE_URL } from "@/lib/pieverse";
import type { Address } from "viem";
import { MoneyFlow } from "@/components/money-flow";
import { ArrowRightIcon, CheckIcon } from "@/components/icons";

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
            <Link href="/leaderboard" className="btn btn--ghost btn--lg">
              See author earnings
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
                <div className="flex items-start justify-between gap-4 pt-3 border-t border-token">
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
              )}
            </div>
          )}
        </div>
      </div>

      <footer className="max-w-[1280px] mx-auto flex justify-between items-center mt-20 pt-5 border-t border-token">
        <span className="t-small ink-3">Built on Kite testnet · Hackathon 2026</span>
        <span className="t-mono-sm ink-3">chain id 2368 · block time 1s · gas ≈ 0</span>
      </footer>
    </main>
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
