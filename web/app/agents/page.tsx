import Link from "next/link";
import type { Address } from "viem";
import { agentReputationAbi, getReputationAddress } from "@/lib/reputation";
import {
  agentRegistry8004Abi,
  erc6551RegistryAbi,
  getAgentRegistryAddress,
  getErc6551AccountImpl,
  getErc6551RegistryAddress
} from "@/lib/standards";
import { getPublicClient } from "@/lib/ledger";
import { explorerAddress, formatUSDC } from "@/lib/kite";
import { StatTile } from "@/components/ui";
import { ExternalLinkIcon } from "@/components/icons";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface AgentCard {
  tokenId: number;
  agent: Address;
  role: string;
  firstActiveAt: bigint;
  lastActiveAt: bigint;
  citationCount: bigint;
  totalEarnedWei: bigint;
  attestationCount: bigint;
  registryCard?: {
    name: string;
    capabilities: string;
    trustMethod: string;
  };
  tba?: Address;
}

async function fetchAgents(nft: Address): Promise<AgentCard[]> {
  const client = getPublicClient();
  try {
    const count = (await client.readContract({
      address: nft,
      abi: agentReputationAbi,
      functionName: "tokenCount"
    })) as bigint;

    const registry = getAgentRegistryAddress();
    const erc6551 = getErc6551RegistryAddress();
    const acctImpl = getErc6551AccountImpl();

    const ids = Array.from({ length: Number(count) }, (_, i) => BigInt(i + 1));
    return await Promise.all(
      ids.map(async (tokenId) => {
        const r = (await client.readContract({
          address: nft,
          abi: agentReputationAbi,
          functionName: "reputations",
          args: [tokenId]
        })) as readonly [
          Address,
          string,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint
        ];

        const agent = r[0];
        let registryCard: AgentCard["registryCard"] | undefined;
        let tba: Address | undefined;

        if (registry) {
          try {
            const card = (await client.readContract({
              address: registry,
              abi: agentRegistry8004Abi,
              functionName: "getAgent",
              args: [agent]
            })) as {
              name: string;
              capabilities: string;
              trustMethod: string;
            };
            registryCard = {
              name: card.name,
              capabilities: card.capabilities,
              trustMethod: card.trustMethod
            };
          } catch {
            // not registered — fine
          }
        }

        if (erc6551 && acctImpl) {
          try {
            tba = (await client.readContract({
              address: erc6551,
              abi: erc6551RegistryAbi,
              functionName: "account",
              args: [acctImpl, 2368n, nft, tokenId, 0n]
            })) as Address;
          } catch {
            // TBA not mintable yet — fine
          }
        }

        return {
          tokenId: Number(tokenId),
          agent,
          role: r[1],
          firstActiveAt: r[2],
          lastActiveAt: r[3],
          citationCount: r[4],
          totalEarnedWei: r[5],
          attestationCount: r[6],
          registryCard,
          tba
        };
      })
    );
  } catch (err) {
    console.error("[agents] fetch failed:", err);
    return [];
  }
}

export default async function AgentsPage() {
  const nft = getReputationAddress();
  const agents = nft ? await fetchAgents(nft) : [];
  const totalCitations = agents.reduce((s, a) => s + Number(a.citationCount), 0);
  const totalEarned = agents.reduce((s, a) => s + a.totalEarnedWei, 0n);

  return (
    <main className="min-h-[calc(100vh-60px)]">
      <header className="px-8 py-10 border-b border-token">
        <div className="max-w-[1040px] mx-auto">
          <div className="t-caption">Agent reputation · on-chain ERC-721</div>
          <h1 className="t-display-xl mt-1.5 mb-2.5">
            Kutip&apos;s agents have receipts.
          </h1>
          <p className="t-body ink-2 max-w-[640px] m-0">
            Every agent in the Kutip fleet holds a reputation NFT. Citations
            paid, attestations landed, USDC routed — all accumulate on-chain
            and travel with the wallet. Transferrable identity, auditable
            history, production-ready for ERC-6551 token-bound accounts.
          </p>
        </div>
      </header>

      <div className="px-8 py-7 max-w-[1040px] mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-7">
          <StatTile
            label="Registered agents"
            value={String(agents.length)}
            delta={`${agents.length} NFTs minted`}
          />
          <StatTile
            label="Citations paid (total)"
            value={String(totalCitations)}
            delta="across all agents"
          />
          <StatTile
            label="USDC routed (total)"
            value={formatUSDC(totalEarned)}
            delta="sum of on-chain attestations"
            accent="emerald"
          />
        </div>

        {!nft && (
          <div className="card p-8 t-small ink-2">
            AgentReputation contract not yet configured. Set{" "}
            <code className="t-mono-sm">
              NEXT_PUBLIC_AGENT_REPUTATION_ADDRESS
            </code>{" "}
            in env.
          </div>
        )}

        {nft && agents.length === 0 && (
          <div className="card p-8">
            <div className="t-h3">No agents minted yet.</div>
            <div className="t-small ink-2 mt-1">
              Run the deploy script with `forge script script/DeployReputation.s.sol`.
            </div>
          </div>
        )}

        {nft && agents.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {agents.map((a) => (
              <div
                key={a.tokenId}
                className="card p-6"
                style={{
                  background:
                    a.role === "Researcher"
                      ? "var(--surface-raised)"
                      : "var(--surface)"
                }}
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="t-caption">{a.role} · #{a.tokenId}</div>
                    <div className="t-h2 mt-1" style={{ fontSize: 24 }}>
                      {a.role === "Researcher" ? "🧠 Researcher" : "📝 Summarizer"}
                    </div>
                  </div>
                  <span
                    className="chip"
                    style={{ padding: "2px 10px", fontSize: 10 }}
                  >
                    ERC-721 · #{a.tokenId}
                  </span>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="ink-3">AA wallet</span>
                    <a
                      href={explorerAddress(a.agent)}
                      target="_blank"
                      rel="noreferrer"
                      className="t-mono-sm text-kite-700 hover:text-kite-500"
                    >
                      {a.agent.slice(0, 6)}…{a.agent.slice(-4)}
                    </a>
                  </div>
                  {a.tba && (
                    <div className="flex justify-between items-center">
                      <span className="ink-3 flex items-center gap-1.5">
                        TBA{" "}
                        <span
                          className="chip"
                          style={{ padding: "0 6px", fontSize: 9 }}
                        >
                          ERC-6551
                        </span>
                      </span>
                      <a
                        href={explorerAddress(a.tba)}
                        target="_blank"
                        rel="noreferrer"
                        className="t-mono-sm text-kite-700 hover:text-kite-500"
                      >
                        {a.tba.slice(0, 6)}…{a.tba.slice(-4)}
                      </a>
                    </div>
                  )}
                  {a.registryCard && (
                    <div className="flex justify-between items-center">
                      <span className="ink-3 flex items-center gap-1.5">
                        Trust{" "}
                        <span
                          className="chip chip--success"
                          style={{ padding: "0 6px", fontSize: 9 }}
                        >
                          ERC-8004
                        </span>
                      </span>
                      <span className="t-mono-sm ink-2">
                        {a.registryCard.trustMethod}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="ink-3">Citations paid</span>
                    <span className="t-mono font-semibold">
                      {a.citationCount.toString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="ink-3">Attestations landed</span>
                    <span className="t-mono font-semibold">
                      {a.attestationCount.toString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="ink-3">Total USDC routed</span>
                    <span className="t-mono font-semibold text-emerald-700">
                      {formatUSDC(a.totalEarnedWei)}
                    </span>
                  </div>
                  {a.registryCard?.capabilities && (
                    <div className="pt-2 border-t border-token">
                      <div className="ink-3 mb-1">Capabilities</div>
                      <code className="t-mono-sm ink-2 block break-all">
                        {a.registryCard.capabilities.slice(0, 100)}
                        {a.registryCard.capabilities.length > 100 ? "…" : ""}
                      </code>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-2 border-t border-token">
                    <span className="ink-3">First active</span>
                    <span className="t-small ink-2">
                      {a.firstActiveAt > 0n
                        ? new Date(Number(a.firstActiveAt) * 1000)
                            .toISOString()
                            .slice(0, 10)
                        : "—"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 flex justify-between items-center">
          <div className="t-small ink-3">
            {nft && (
              <>
                Contract:{" "}
                <a
                  className="tx"
                  href={explorerAddress(nft)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {nft.slice(0, 10)}…{nft.slice(-6)}{" "}
                  <ExternalLinkIcon size={11} />
                </a>
              </>
            )}
          </div>
          <span className="t-mono-sm ink-3">
            ERC-8004 registry · ERC-6551 TBAs · all on Kite testnet
          </span>
        </div>
      </div>
    </main>
  );
}
