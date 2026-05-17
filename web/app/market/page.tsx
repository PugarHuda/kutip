import Link from "next/link";
import type { Address } from "viem";
import { escrowAbi, getEscrowAddress } from "@/lib/escrow";
import { bountyMarketAbi, getBountyMarketAddress } from "@/lib/bounty";
import { getPublicClient } from "@/lib/ledger";
import { formatUSDC } from "@/lib/kite";
import { ArrowRightIcon } from "@/components/icons";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function fetchEscrowSummary() {
  const escrow = getEscrowAddress();
  if (!escrow) return { total: 0n, deposits: 0 };
  try {
    const client = getPublicClient();
    const [total, logs] = await Promise.all([
      client.readContract({
        address: escrow,
        abi: escrowAbi,
        functionName: "totalPrincipalOutstanding"
      }),
      client.getContractEvents({
        address: escrow,
        abi: escrowAbi,
        eventName: "Deposited",
        fromBlock: 20950000n,
        toBlock: "latest"
      })
    ]);
    const unique = new Set(logs.map((l) => l.args.orcidHash as string));
    return { total: total as bigint, deposits: unique.size };
  } catch {
    return { total: 0n, deposits: 0 };
  }
}

async function fetchBountySummary() {
  const market = getBountyMarketAddress();
  if (!market) return { active: 0, totalActive: 0n };
  try {
    const client = getPublicClient();
    const count = (await client.readContract({
      address: market,
      abi: bountyMarketAbi,
      functionName: "bountyCount"
    })) as bigint;

    let active = 0;
    let totalActive = 0n;
    for (let i = 0n; i < count; i++) {
      try {
        const b = (await client.readContract({
          address: market,
          abi: bountyMarketAbi,
          functionName: "bounties",
          args: [i]
        })) as [Address, string, bigint, bigint, bigint, boolean, boolean];
        const settled = b[5];
        const refunded = b[6];
        const expiresAt = b[4];
        const isActive =
          !settled &&
          !refunded &&
          Number(expiresAt) * 1000 > Date.now();
        if (isActive) {
          active++;
          totalActive += b[2];
        }
      } catch {}
    }
    return { active, totalActive };
  } catch {
    return { active: 0, totalActive: 0n };
  }
}

export default async function MarketPage() {
  const [escrow, bounties] = await Promise.all([
    fetchEscrowSummary(),
    fetchBountySummary()
  ]);

  return (
    <main className="min-h-[calc(100vh-60px)]">
      <header className="px-8 py-10 border-b border-token">
        <div className="max-w-[1040px] mx-auto">
          <div className="t-caption">On-chain agent economy</div>
          <h1 className="t-display-xl mt-1.5 mb-2.5">
            Where capital meets citations.
          </h1>
          <p className="t-body ink-2 max-w-[640px] m-0">
            Two capital primitives on Kite. Escrow holds what researchers
            haven&apos;t claimed yet, earning yield on their behalf. Bounties
            let anyone sponsor research on topics they care about.
          </p>
        </div>
      </header>

      <div className="px-8 py-7 max-w-[1040px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-5">
        <Link
          href="/escrow"
          className="card p-7 hover:surface-raised transition-colors no-underline text-inherit"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="t-caption">Yield escrow</div>
            <span
              className="chip chip--success"
              style={{ padding: "2px 10px", fontSize: 10 }}
            >
              5% APY · simulated
            </span>
          </div>
          <div className="t-h2 mb-2">
            {formatUSDC(escrow.total)} USDC held
          </div>
          <div className="t-body ink-2 mb-5 max-w-[420px]">
            Unclaimed author shares accrue here until a researcher binds their
            ORCID. Principal plus yield release on claim. Production routes
            to Lucid vault.
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 t-small text-kite-500">
              Open escrow <ArrowRightIcon size={14} />
            </div>
            <div className="t-mono-sm ink-3">
              {escrow.deposits} deposit{escrow.deposits === 1 ? "" : "s"}
            </div>
          </div>
        </Link>

        <Link
          href="/bounties"
          className="card p-7 hover:surface-raised transition-colors no-underline text-inherit"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="t-caption">Citation bounties</div>
            <span className="chip" style={{ padding: "2px 10px", fontSize: 10 }}>
              topic sponsorship
            </span>
          </div>
          <div className="t-h2 mb-2">
            {bounties.active} active bount{bounties.active === 1 ? "y" : "ies"}
          </div>
          <div className="t-body ink-2 mb-5 max-w-[420px]">
            Fund research on any topic. When Kutip&apos;s agent cites a paper
            matching that topic, the bounty releases to cited authors — on
            top of the query payment.
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 t-small text-kite-500">
              Open bounty market <ArrowRightIcon size={14} />
            </div>
            <div className="t-mono text-right">
              <div className="font-semibold">
                {formatUSDC(bounties.totalActive)} USDC
              </div>
              <div className="t-mono-sm ink-3">committed</div>
            </div>
          </div>
        </Link>
      </div>
    </main>
  );
}
