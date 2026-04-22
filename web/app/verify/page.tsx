import Link from "next/link";
import type { Address, Hex } from "viem";
import {
  getLedgerAddress,
  getPublicClient
} from "@/lib/ledger";
import { attributionLedgerAbi } from "@/lib/abi";
import { explorerAddress, formatUSDC } from "@/lib/kite";
import { listAuthors } from "@/lib/papers";
import { CheckIcon, ExternalLinkIcon, SearchIcon } from "@/components/icons";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const LEDGER_DEPLOY_BLOCK = process.env.ATTRIBUTION_LEDGER_DEPLOY_BLOCK
  ? BigInt(process.env.ATTRIBUTION_LEDGER_DEPLOY_BLOCK)
  : 20944832n;

interface RecentQuery {
  queryId: Hex;
  payer: Address;
  totalPaid: bigint;
  citationCount: number;
  timestamp: bigint;
  txHash: Hex;
  blockNumber: bigint;
}

async function fetchRecent(ledger: Address, limit = 12): Promise<RecentQuery[]> {
  try {
    const logs = await getPublicClient().getContractEvents({
      address: ledger,
      abi: attributionLedgerAbi,
      eventName: "QueryAttested",
      fromBlock: LEDGER_DEPLOY_BLOCK,
      toBlock: "latest"
    });

    return logs
      .slice(-limit)
      .reverse()
      .map((log) => ({
        queryId: log.args.queryId as Hex,
        payer: log.args.payer as Address,
        totalPaid: log.args.totalPaid as bigint,
        citationCount: Number(log.args.citationCount),
        timestamp: log.blockNumber as bigint,
        txHash: log.transactionHash as Hex,
        blockNumber: log.blockNumber as bigint
      }));
  } catch (err) {
    console.error("[verify] fetchRecent failed:", err);
    return [];
  }
}

export default async function VerifyIndexPage() {
  const ledger = getLedgerAddress();
  const recent = ledger ? await fetchRecent(ledger) : [];
  const authors = listAuthors();
  const walletToName = new Map(
    authors.map((a) => [a.wallet.toLowerCase(), a.name])
  );

  return (
    <main className="min-h-[calc(100vh-60px)]">
      <header className="px-8 py-10 border-b border-token">
        <div className="max-w-[1040px] mx-auto">
          <div className="t-caption">Attestation registry · live</div>
          <h1 className="t-display-xl mt-1.5 mb-2.5">Verify any query.</h1>
          <p className="t-body ink-2 max-w-[640px] m-0">
            Every settled research query lands here as a cryptographic proof.
            Click any row for the full payout breakdown, or paste a queryId
            from a receipt you&apos;ve been sent.
          </p>
        </div>
      </header>

      <div className="px-8 py-7 max-w-[1040px] mx-auto">
        <form
          action="/verify/lookup"
          method="GET"
          className="card p-5 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center mb-8"
        >
          <label
            htmlFor="queryId"
            className="t-caption flex items-center gap-2"
          >
            <SearchIcon size={14} /> QueryId
          </label>
          <input
            id="queryId"
            name="q"
            type="text"
            placeholder="0x2f273ac8..."
            pattern="0x[a-fA-F0-9]{64}"
            className="flex-1 px-3 py-2.5 rounded-md border border-token bg-transparent font-mono text-[13px] focus:outline-none focus:border-kite-500"
          />
          <button type="submit" className="btn btn--primary">
            Look up →
          </button>
        </form>

        <div className="flex items-baseline justify-between mb-4">
          <h2 className="t-h3">Recent attestations</h2>
          <span className="t-small ink-3">
            {recent.length > 0
              ? `${recent.length} on-chain`
              : "no attestations yet"}
          </span>
        </div>

        {!ledger && (
          <div className="card p-8">
            <div className="t-small ink-2">
              AttributionLedger not yet configured. No attestations to list.
            </div>
          </div>
        )}

        {ledger && recent.length === 0 && (
          <div className="card p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="t-h3">Nothing settled yet.</div>
              <div className="t-small ink-2 mt-1 max-w-[520px]">
                Run the first research query — the moment its attestation lands
                on chain, it will show up here with a shareable permalink.
              </div>
            </div>
            <Link href="/research" className="btn btn--primary">
              Start a research query →
            </Link>
          </div>
        )}

        {recent.length > 0 && (
          <div className="card p-0 overflow-hidden">
            {recent.map((q) => {
              const short = `${q.queryId.slice(0, 10)}…${q.queryId.slice(-6)}`;
              const payerName =
                walletToName.get(q.payer.toLowerCase()) ??
                `${q.payer.slice(0, 6)}…${q.payer.slice(-4)}`;
              return (
                <Link
                  key={q.queryId}
                  href={`/verify/${q.queryId}`}
                  className="no-underline text-inherit grid gap-4 px-5 py-4 items-center border-b border-token last:border-b-0 transition-colors hover:surface-raised"
                  style={{
                    gridTemplateColumns: "minmax(220px, 1fr) 200px 90px 120px 90px"
                  }}
                >
                  <div>
                    <div className="font-mono text-[13px]">{short}</div>
                    <div className="t-small ink-3 mt-0.5">
                      block {q.blockNumber.toString()}
                    </div>
                  </div>
                  <div>
                    <div className="t-small">{payerName}</div>
                    <div className="t-caption" style={{ fontSize: 10, color: "var(--ink-3)" }}>
                      payer
                    </div>
                  </div>
                  <div className="t-mono text-right font-semibold">
                    {formatUSDC(q.totalPaid)}
                  </div>
                  <div className="t-small ink-2 text-right">
                    {q.citationCount} citation{q.citationCount === 1 ? "" : "s"}
                  </div>
                  <div className="text-right">
                    <span className="chip chip--success" style={{ padding: "2px 8px" }}>
                      <CheckIcon size={10} /> attested
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        <div className="mt-6 flex justify-between items-center t-small ink-3">
          <span>
            {ledger && (
              <>
                Source:{" "}
                <a
                  className="tx"
                  href={explorerAddress(ledger)}
                  target="_blank"
                  rel="noreferrer"
                >
                  AttributionLedger <ExternalLinkIcon size={11} />
                </a>
              </>
            )}
          </span>
          <span className="t-mono-sm">live · re-fetched per request</span>
        </div>
      </div>
    </main>
  );
}
