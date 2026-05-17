import Link from "next/link";
import {
  fetchRecentAttestationsFromGoldsky,
  isSubgraphEnabled,
  type GoldskyAttestation
} from "@/lib/goldsky";
import { getLedgerAddress, getPublicClient } from "@/lib/ledger";
import { attributionLedgerAbi } from "@/lib/abi";
import { formatUSDC } from "@/lib/kite";
import { listAuthors } from "@/lib/papers";
import { ArrowRightIcon, CheckIcon } from "@/components/icons";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const LEDGER_DEPLOY_BLOCK = process.env.ATTRIBUTION_LEDGER_DEPLOY_BLOCK
  ? BigInt(process.env.ATTRIBUTION_LEDGER_DEPLOY_BLOCK)
  : 20944832n;

/**
 * RPC fallback for the activity feed.
 *
 * The Goldsky subgraph is the fast path, but it's only wired when
 * NEXT_PUBLIC_SUBGRAPH_URL is set. Without it, this reads QueryAttested
 * events straight off the AttributionLedger so the feed still works —
 * same path /verify uses. Mapped onto GoldskyAttestation so the render
 * block below doesn't care which source it got.
 */
async function fetchRecentOnChain(limit: number): Promise<GoldskyAttestation[]> {
  const ledger = getLedgerAddress();
  if (!ledger) return [];
  try {
    const client = getPublicClient();
    const logs = await client.getContractEvents({
      address: ledger,
      abi: attributionLedgerAbi,
      eventName: "QueryAttested",
      fromBlock: LEDGER_DEPLOY_BLOCK,
      toBlock: "latest"
    });
    const recent = logs.slice(-limit).reverse();

    // Events carry block height, not wall-clock time. Resolve real
    // block timestamps for the "When" column — dedupe so a busy block
    // with several attestations is fetched once.
    const uniqueBlocks = [...new Set(recent.map((l) => l.blockNumber as bigint))];
    const blockTimes = new Map<bigint, bigint>();
    await Promise.all(
      uniqueBlocks.map(async (bn) => {
        const block = await client.getBlock({ blockNumber: bn });
        blockTimes.set(bn, block.timestamp);
      })
    );

    return recent.map((log) => ({
      id: log.args.queryId as string,
      payer: log.args.payer as string,
      totalPaid: (log.args.totalPaid as bigint).toString(),
      authorsShare: "0",
      citationCount: Number(log.args.citationCount),
      block: (log.blockNumber as bigint).toString(),
      timestamp: String(blockTimes.get(log.blockNumber as bigint) ?? 0n),
      tx: log.transactionHash as string
    }));
  } catch (err) {
    console.error("[activity] fetchRecentOnChain failed:", err);
    return [];
  }
}

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
  // Subgraph off or returned nothing — read the ledger directly so the
  // feed reflects on-chain truth regardless of indexer availability.
  if (attestations.length === 0) {
    attestations = await fetchRecentOnChain(20);
  }

  return (
    <div className="px-6 lg:px-10 py-8 lg:py-10">
      <div className="max-w-[1040px] mx-auto">
        <div className="t-caption">Dashboard · Activity</div>
        <h1 className="t-h1-tight mt-1 mb-3">Recent attestations</h1>
        <p className="t-body ink-2 max-w-[620px] m-0">
          Live feed of every query settled on Kite testnet, read straight from
          the AttributionLedger. Each row actually moved USDC — click through
          for the tx on KiteScan.
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
            {/* Header row — explicit column labels so the table reads
                without guessing which value is the queryId vs payer. */}
            <div
              className="grid gap-4 px-5 py-2.5 t-caption ink-3"
              style={{
                gridTemplateColumns: "44px 110px 1.4fr 1fr 90px 110px 100px",
                borderBottom: "1px solid var(--border)",
                background: "color-mix(in srgb, var(--ink) 3%, transparent)"
              }}
            >
              <span>#</span>
              <span>When</span>
              <span>Query ID</span>
              <span>Payer</span>
              <span className="text-right">Cites</span>
              <span className="text-right">USDC</span>
              <span className="text-right">Tx</span>
            </div>

            {attestations.map((a, i) => {
              const payerName =
                walletToName.get(a.payer.toLowerCase()) ??
                `${a.payer.slice(0, 6)}…${a.payer.slice(-4)}`;
              // Pad to 2 digits so #01/#10 align visually. Use total
              // length so the most-recent row gets the highest number
              // (visual feed-as-history rather than feed-as-newest).
              const seq = String(attestations.length - i).padStart(2, "0");
              return (
                <Link
                  key={a.id}
                  href={`/dashboard/verify/${a.id}`}
                  className="no-underline text-inherit block"
                >
                  <div
                    className="grid gap-4 px-5 py-3.5 items-center transition-colors hover:surface-raised"
                    style={{
                      gridTemplateColumns: "44px 110px 1.4fr 1fr 90px 110px 100px",
                      borderBottom:
                        i < attestations.length - 1
                          ? "1px solid var(--border)"
                          : "none"
                    }}
                  >
                    <span className="t-mono-sm ink-3 font-semibold">
                      #{seq}
                    </span>
                    <span className="t-mono-sm ink-3">
                      {timeAgo(a.timestamp)}
                    </span>
                    <span
                      className="t-mono-sm ink-2 truncate"
                      title={a.id}
                    >
                      {a.id.slice(0, 10)}…{a.id.slice(-6)}
                    </span>
                    <span className="t-serif text-[14px] truncate ink-2">
                      {payerName}
                    </span>
                    <span className="t-mono-sm ink-3 text-right">
                      {a.citationCount}
                    </span>
                    <span className="t-mono text-right text-[14px] font-semibold text-emerald-700">
                      + {formatUSDC(BigInt(a.totalPaid))}
                    </span>
                    <span className="flex justify-end">
                      <span
                        className="chip chip--success"
                        style={{ padding: "2px 10px", fontSize: 10 }}
                        title={a.tx}
                      >
                        <CheckIcon size={10} /> {a.tx.slice(0, 6)}…
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
