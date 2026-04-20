import Link from "next/link";
import type { Address } from "viem";
import { agentReputationAbi, getReputationAddress } from "@/lib/reputation";
import { getAuthorStats, getLedgerAddress } from "@/lib/ledger";
import { listAuthors } from "@/lib/papers";
import {
  fetchLeaderboardFromGoldsky,
  isSubgraphEnabled
} from "@/lib/goldsky";
import { getPublicClient } from "@/lib/ledger";
import { formatUSDC } from "@/lib/kite";
import { ArrowRightIcon } from "@/components/icons";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function fetchAgentSummary() {
  const nft = getReputationAddress();
  if (!nft) return { count: 0 };
  try {
    const count = (await getPublicClient().readContract({
      address: nft,
      abi: agentReputationAbi,
      functionName: "tokenCount"
    })) as bigint;
    return { count: Number(count) };
  } catch {
    return { count: 0 };
  }
}

async function fetchLeaderboardSummary() {
  const authors = listAuthors();
  const wallets = authors.map((a) => a.wallet as Address);

  if (isSubgraphEnabled()) {
    const data = await fetchLeaderboardFromGoldsky(20);
    if (data) {
      const totalEarnings = data.reduce(
        (s, a) => s + BigInt(a.totalEarnings),
        0n
      );
      const authorsPaid = data.filter((a) => BigInt(a.totalEarnings) > 0n).length;
      return {
        authorsPaid,
        totalAuthors: authors.length,
        totalEarnings
      };
    }
  }

  const stats = await getAuthorStats(wallets);
  const totalEarnings = stats.reduce((acc, s) => acc + s.earnings, 0n);
  const authorsPaid = stats.filter((s) => s.earnings > 0n).length;
  return { authorsPaid, totalAuthors: authors.length, totalEarnings };
}

export default async function RegistryPage() {
  const [agentSummary, leaderboardSummary] = await Promise.all([
    fetchAgentSummary(),
    fetchLeaderboardSummary()
  ]);

  return (
    <main className="min-h-[calc(100vh-60px)]">
      <header className="px-8 py-10 border-b border-token">
        <div className="max-w-[1040px] mx-auto">
          <div className="t-caption">On-chain identity registry</div>
          <h1 className="t-display-xl mt-1.5 mb-2.5">
            Who is on the other side of every citation.
          </h1>
          <p className="t-body ink-2 max-w-[640px] m-0">
            Two sides of the same ledger: the agents that issue citations and
            the authors that receive them. Both live on Kite chain, both have
            portable reputation.
          </p>
        </div>
      </header>

      <Link
        href="/claim"
        className="block no-underline text-inherit"
      >
        <div
          className="px-8 py-5 border-b border-token hover:surface-raised transition-colors"
          style={{
            background:
              "linear-gradient(90deg, color-mix(in srgb, var(--kite-500) 7%, transparent), transparent)"
          }}
        >
          <div className="max-w-[1040px] mx-auto flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3">
              <span className="chip chip--success shrink-0" style={{ marginTop: 2 }}>
                For authors
              </span>
              <div>
                <div className="t-h3 text-[16px] font-semibold leading-tight">
                  Are you a cited author? Bind your ORCID to claim earnings.
                </div>
                <div className="t-small ink-3 mt-1">
                  Unclaimed payouts accrue 5% APY in escrow until you verify
                  ownership via your ORCID iD.
                </div>
              </div>
            </div>
            <span className="flex items-center gap-1.5 t-small text-kite-500 font-medium">
              Open /claim <ArrowRightIcon size={14} />
            </span>
          </div>
        </div>
      </Link>

      <div className="px-8 py-7 max-w-[1040px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-5">
        <Link
          href="/agents"
          className="card p-7 hover:surface-raised transition-colors no-underline text-inherit"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="t-caption">Agents</div>
            <span className="chip" style={{ padding: "2px 10px", fontSize: 10 }}>
              ERC-8004 · ERC-6551
            </span>
          </div>
          <div className="t-h2 mb-2">
            {agentSummary.count} autonomous agents
          </div>
          <div className="t-body ink-2 mb-5 max-w-[420px]">
            Researcher + Summarizer, each with their own EIP-4337 wallet and
            token-bound account. Reputation travels with the NFT.
          </div>
          <div className="flex items-center gap-1.5 t-small text-kite-500">
            Open agent registry <ArrowRightIcon size={14} />
          </div>
        </Link>

        <Link
          href="/leaderboard"
          className="card p-7 hover:surface-raised transition-colors no-underline text-inherit"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="t-caption">Author earnings</div>
            <span
              className="chip chip--success"
              style={{ padding: "2px 10px", fontSize: 10 }}
            >
              Goldsky indexed
            </span>
          </div>
          <div className="t-h2 mb-2">
            {leaderboardSummary.authorsPaid} of{" "}
            {leaderboardSummary.totalAuthors} authors paid
          </div>
          <div className="t-body ink-2 mb-5 max-w-[420px]">
            Live stats per researcher: total USDC earned, citation count,
            7-day trend. Unclaimed authors accrue yield in escrow until they
            bind an ORCID.
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 t-small text-kite-500">
              Open leaderboard <ArrowRightIcon size={14} />
            </div>
            <div className="t-mono text-right">
              <div className="text-emerald-700 font-semibold">
                {formatUSDC(leaderboardSummary.totalEarnings)} USDC
              </div>
              <div className="t-mono-sm ink-3">total paid out</div>
            </div>
          </div>
        </Link>
      </div>

      <div className="px-8 pb-10 max-w-[1040px] mx-auto">
        <div className="t-small ink-3">
          Authors can bind their real wallet to an ORCID via{" "}
          <Link href="/claim" className="tx">
            /claim
          </Link>{" "}
          — unclaimed earnings sit in{" "}
          <Link href="/market" className="tx">
            escrow
          </Link>{" "}
          accruing 5% APY until then.
        </div>
      </div>
    </main>
  );
}
