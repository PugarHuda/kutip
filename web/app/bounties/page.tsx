import Link from "next/link";
import type { Address, Hex } from "viem";
import { bountyMarketAbi, getBountyMarketAddress } from "@/lib/bounty";
import { getPublicClient } from "@/lib/ledger";
import { explorerAddress, explorerTx, formatUSDC } from "@/lib/kite";
import { StatTile } from "@/components/ui";
import { CheckIcon, ExternalLinkIcon } from "@/components/icons";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEPLOY_BLOCK = 20950800n; // bounty market deploy rough block

interface BountyRow {
  id: number;
  sponsor: Address;
  topicHash: Hex;
  amount: bigint;
  createdAt: bigint;
  expiresAt: bigint;
  settled: boolean;
  refunded: boolean;
  tx: Hex;
}

async function fetchBounties(market: Address): Promise<BountyRow[]> {
  const client = getPublicClient();
  try {
    const logs = await client.getContractEvents({
      address: market,
      abi: bountyMarketAbi,
      eventName: "BountyCreated",
      fromBlock: DEPLOY_BLOCK,
      toBlock: "latest"
    });

    const rows: BountyRow[] = [];
    for (const log of logs) {
      const id = Number(log.args.bountyId);
      // Fetch current state (settled/refunded could have changed)
      try {
        const res = await client.readContract({
          address: market,
          abi: bountyMarketAbi,
          functionName: "bounties",
          args: [BigInt(id)]
        });
        const [sponsor, topicHash, amount, createdAt, expiresAt, settled, refunded] = res as [
          Address,
          Hex,
          bigint,
          bigint,
          bigint,
          boolean,
          boolean
        ];
        rows.push({
          id,
          sponsor,
          topicHash,
          amount,
          createdAt,
          expiresAt,
          settled,
          refunded,
          tx: log.transactionHash as Hex
        });
      } catch {
        // skip failed row
      }
    }
    return rows.sort((a, b) => b.id - a.id);
  } catch (err) {
    console.error("[bounties] fetch failed:", err);
    return [];
  }
}

export default async function BountiesPage() {
  const market = getBountyMarketAddress();
  const rows = market ? await fetchBounties(market) : [];

  const active = rows.filter((r) => !r.settled && !r.refunded);
  const settled = rows.filter((r) => r.settled);
  const totalActive = active.reduce((s, r) => s + r.amount, 0n);
  const totalSettled = settled.reduce((s, r) => s + r.amount, 0n);

  return (
    <main className="min-h-[calc(100vh-60px)]">
      <header className="px-8 py-10 border-b border-token">
        <div className="max-w-[1040px] mx-auto">
          <div className="t-caption">Citation bounty market · Kite testnet</div>
          <h1 className="t-display-xl mt-1.5 mb-2.5">
            Sponsor research you care about.
          </h1>
          <p className="t-body ink-2 max-w-[640px] m-0">
            Fund a bounty for any topic. When Kutip&apos;s agent cites a paper
            matching that topic, the bounty releases to the cited authors
            — on top of the user&apos;s query payment. Researchers earn even
            when the asker doesn&apos;t know the paper exists yet.
          </p>
        </div>
      </header>

      <div className="px-8 py-7 max-w-[1040px] mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-7">
          <StatTile
            label="Active bounties"
            value={String(active.length)}
            delta={
              active.length > 0
                ? `${formatUSDC(totalActive)} USDC committed`
                : "no active sponsors"
            }
          />
          <StatTile
            label="Settled to authors"
            value={String(settled.length)}
            delta={
              settled.length > 0
                ? `${formatUSDC(totalSettled)} USDC paid`
                : "awaiting first match"
            }
            accent="emerald"
          />
          <StatTile
            label="Refunded"
            value={String(rows.filter((r) => r.refunded).length)}
            delta="expired without match"
          />
        </div>

        {!market && (
          <div className="card p-8 t-small ink-2">
            BountyMarket contract not yet configured. Set{" "}
            <code className="t-mono-sm">NEXT_PUBLIC_BOUNTY_MARKET_ADDRESS</code>{" "}
            in env.
          </div>
        )}

        {market && rows.length === 0 && (
          <div className="card p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="t-h3">No bounties yet.</div>
              <div className="t-small ink-2 mt-1 max-w-[560px]">
                Create the first bounty to sponsor research on a topic. When
                the next query matches, your funds split across the cited
                authors in the same transaction.
              </div>
              <div className="t-small ink-3 mt-3">
                Programmatic create via{" "}
                <code className="t-mono-sm">
                  node web/scripts/create-bounty.mjs &quot;your topic&quot; 1
                </code>
              </div>
            </div>
            <Link href="/research" className="btn btn--primary">
              Run a research query →
            </Link>
          </div>
        )}

        {market && rows.length > 0 && (
          <div className="card p-0 overflow-x-auto">
            <div
              className="grid gap-4 px-5 py-3 surface-raised border-b border-token min-w-[720px]"
              style={{
                gridTemplateColumns: "32px 2fr 1fr 1fr 130px 100px"
              }}
            >
              {["#", "Topic hash", "Sponsor", "Amount", "Expires", "Status"].map(
                (h, i) => (
                  <span
                    key={i}
                    className="t-caption"
                    style={{
                      textAlign: i === 3 ? "right" : "left",
                      color: i === 3 ? "var(--ink)" : "var(--ink-3)"
                    }}
                  >
                    {h}
                  </span>
                )
              )}
            </div>
            {rows.map((r, i) => {
              const status = r.settled
                ? "settled"
                : r.refunded
                ? "refunded"
                : Number(r.expiresAt) * 1000 < Date.now()
                ? "expired"
                : "active";
              const chipClass =
                status === "settled"
                  ? "chip chip--success"
                  : status === "active"
                  ? "chip"
                  : "chip chip--pending";
              const expires = new Date(Number(r.expiresAt) * 1000)
                .toISOString()
                .slice(0, 10);
              return (
                <div
                  key={r.id}
                  className="grid gap-4 px-5 py-3.5 items-center min-w-[720px]"
                  style={{
                    gridTemplateColumns: "32px 2fr 1fr 1fr 130px 100px",
                    borderBottom:
                      i < rows.length - 1 ? "1px solid var(--border)" : "none",
                    background: r.settled ? "var(--emerald-50)" : "transparent"
                  }}
                >
                  <span className="t-mono-sm ink-3">
                    {String(r.id).padStart(2, "0")}
                  </span>
                  <a
                    href={explorerTx(r.tx)}
                    target="_blank"
                    rel="noreferrer"
                    className="t-mono-sm text-kite-700 hover:text-kite-500"
                  >
                    {r.topicHash.slice(0, 14)}…{r.topicHash.slice(-4)}
                  </a>
                  <a
                    href={explorerAddress(r.sponsor)}
                    target="_blank"
                    rel="noreferrer"
                    className="t-mono-sm text-kite-700 hover:text-kite-500"
                  >
                    {r.sponsor.slice(0, 6)}…{r.sponsor.slice(-4)}
                  </a>
                  <span className="t-mono text-right font-semibold">
                    {formatUSDC(r.amount)}
                  </span>
                  <span className="t-small ink-2">{expires}</span>
                  <span className="flex justify-end">
                    <span className={chipClass} style={{ padding: "2px 8px" }}>
                      {status === "settled" && <CheckIcon size={10} />}{" "}
                      {status}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 flex justify-between items-center">
          <div className="t-small ink-3">
            {market && (
              <>
                Contract:{" "}
                <a
                  className="tx"
                  href={explorerAddress(market)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {market.slice(0, 10)}…{market.slice(-6)}{" "}
                  <ExternalLinkIcon size={11} />
                </a>
              </>
            )}
          </div>
          <span className="t-mono-sm ink-3">
            topic match is keccak-indexed · off-chain agent routes on keyword overlap
          </span>
        </div>
      </div>
    </main>
  );
}
