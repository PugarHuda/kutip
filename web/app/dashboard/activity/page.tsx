import Link from "next/link";
import {
  fetchRecentAttestationsFromGoldsky,
  isSubgraphEnabled,
  type GoldskyAttestation
} from "@/lib/goldsky";
import { explorerTx, explorerAddress, formatUSDC } from "@/lib/kite";
import { listAuthors } from "@/lib/papers";
import { ArrowRightIcon, CheckIcon } from "@/components/icons";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function timeAgo(tsSec: number | string): string {
  const t = typeof tsSec === "string" ? Number(tsSec) : tsSec;
  const s = Math.floor(Date.now() / 1000) - t;
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default async function DashboardActivityPage() {
  const authors = listAuthors();
  const walletToName = new Map(
    authors.map((a) => [a.wallet.toLowerCase(), a.name])
  );

  let attestations: GoldskyAttestation[] = [];
  if (isSubgraphEnabled()) {
    attestations = (await fetchRecentAttestationsFromGoldsky(20)) ?? [];
  }

  return (
    <div className="px-6 lg:px-10 py-8 lg:py-10">
      <div className="max-w-[1040px] mx-auto">
        <div className="t-caption">Dashboard · Activity</div>
        <h1 className="t-h1-tight mt-1 mb-3">Recent attestations</h1>
        <p className="t-body ink-2 max-w-[620px] m-0">
          Live feed of every query settled on Kite testnet, indexed by Goldsky.
          Each row is a citation that actually moved USDC — click through for
          the tx on KiteScan.
        </p>

        {attestations.length === 0 ? (
          <div className="card p-10 text-center mt-8">
            <div className="t-h3">No attestations yet</div>
            <div className="t-small ink-2 mt-2 max-w-[440px] mx-auto">
              Fire the first research query from the sidebar — its attestation
              will stream in here within seconds.
            </div>
            <Link href="/dashboard" className="btn btn--primary mt-5">
              Start a research query <ArrowRightIcon />
            </Link>
          </div>
        ) : (
          <div className="card p-0 overflow-hidden mt-6">
            {attestations.map((a, i) => {
              const payerName =
                walletToName.get(a.payer.toLowerCase()) ??
                `${a.payer.slice(0, 6)}…${a.payer.slice(-4)}`;
              return (
                <Link
                  key={a.id}
                  href={`/verify/${a.id}`}
                  className="no-underline text-inherit block"
                >
                  <div
                    className="grid gap-4 px-5 py-3.5 items-center transition-colors hover:surface-raised"
                    style={{
                      gridTemplateColumns: "140px 1fr 110px 130px 120px",
                      borderBottom:
                        i < attestations.length - 1
                          ? "1px solid var(--border)"
                          : "none"
                    }}
                  >
                    <span className="t-mono-sm ink-3">
                      {timeAgo(a.timestamp)}
                    </span>
                    <span className="t-serif text-[14px] truncate ink-2">
                      {payerName}
                    </span>
                    <span className="t-mono-sm ink-3 text-right">
                      {a.citationCount} cite
                      {a.citationCount === 1 ? "" : "s"}
                    </span>
                    <span className="t-mono text-right text-[14px] font-semibold text-emerald-700">
                      + {formatUSDC(BigInt(a.totalPaid))} USDC
                    </span>
                    <span className="flex justify-end">
                      <span className="chip chip--success" style={{ padding: "2px 10px", fontSize: 10 }}>
                        <CheckIcon size={10} /> {a.tx.slice(0, 8)}…
                      </span>
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
