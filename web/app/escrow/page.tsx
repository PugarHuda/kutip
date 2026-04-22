import Link from "next/link";
import type { Address, Hex } from "viem";
import { escrowAbi, getEscrowAddress } from "@/lib/escrow";
import { getPublicClient } from "@/lib/ledger";
import { explorerAddress, explorerTx, formatUSDC } from "@/lib/kite";
import { StatTile } from "@/components/ui";
import { CheckIcon, ExternalLinkIcon } from "@/components/icons";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ESCROW_DEPLOY_BLOCK = 20950000n; // slightly before actual deploy block

interface EscrowRow {
  orcidHash: Hex;
  principal: bigint;
  depositedAt: bigint;
  claimedAt: bigint;
  claimer: Address;
  tx: Hex;
  accrued?: bigint;
}

async function fetchDeposits(escrow: Address): Promise<EscrowRow[]> {
  const client = getPublicClient();
  try {
    const logs = await client.getContractEvents({
      address: escrow,
      abi: escrowAbi,
      eventName: "Deposited",
      fromBlock: ESCROW_DEPLOY_BLOCK,
      toBlock: "latest"
    });

    const byHash = new Map<string, EscrowRow>();
    for (const log of logs) {
      const h = log.args.orcidHash as Hex;
      const existing = byHash.get(h);
      if (!existing) {
        byHash.set(h, {
          orcidHash: h,
          principal: log.args.newPrincipal as bigint,
          depositedAt: 0n,
          claimedAt: 0n,
          claimer: "0x0000000000000000000000000000000000000000" as Address,
          tx: log.transactionHash as Hex
        });
      } else {
        existing.principal = log.args.newPrincipal as bigint;
      }
    }

    // Fetch live deposit state + accrued yield
    await Promise.all(
      Array.from(byHash.keys()).map(async (h) => {
        try {
          const [row, accrued] = await Promise.all([
            client.readContract({
              address: escrow,
              abi: escrowAbi,
              functionName: "deposits",
              args: [h as Hex]
            }),
            client.readContract({
              address: escrow,
              abi: escrowAbi,
              functionName: "accruedYield",
              args: [h as Hex]
            })
          ]);
          const [principal, depositedAt, claimedAt, claimer] = row as [
            bigint,
            bigint,
            bigint,
            Address
          ];
          const r = byHash.get(h)!;
          r.principal = principal;
          r.depositedAt = depositedAt;
          r.claimedAt = claimedAt;
          r.claimer = claimer;
          r.accrued = accrued as bigint;
        } catch {
          // per-row failure fine — leave placeholders
        }
      })
    );

    return Array.from(byHash.values()).sort((a, b) =>
      Number(b.principal - a.principal)
    );
  } catch (err) {
    console.error("[escrow] fetchDeposits failed:", err);
    return [];
  }
}

async function fetchTotal(escrow: Address): Promise<bigint> {
  try {
    const total = await getPublicClient().readContract({
      address: escrow,
      abi: escrowAbi,
      functionName: "totalPrincipalOutstanding"
    });
    return total as bigint;
  } catch {
    return 0n;
  }
}

export default async function EscrowPage() {
  const escrow = getEscrowAddress();
  const rows = escrow ? await fetchDeposits(escrow) : [];
  const total = escrow ? await fetchTotal(escrow) : 0n;
  const totalYield = rows.reduce((s, r) => s + (r.accrued ?? 0n), 0n);
  const unclaimed = rows.filter((r) => r.claimer === "0x0000000000000000000000000000000000000000");
  const claimed = rows.filter((r) => r.claimer !== "0x0000000000000000000000000000000000000000");

  return (
    <main className="min-h-[calc(100vh-60px)]">
      <header className="px-8 py-10 border-b border-token">
        <div className="max-w-[1040px] mx-auto">
          <div className="t-caption">Unclaimed-yield escrow · Kite testnet</div>
          <h1 className="t-display-xl mt-1.5 mb-2.5">
            Citations earn yield until claimed.
          </h1>
          <p className="t-body ink-2 max-w-[640px] m-0">
            When Kutip cites a paper whose author hasn&apos;t bound their ORCID
            yet, their share goes here. Principal sits safely, 5% APY accrues,
            and both release to the researcher the moment they verify their
            ORCID on <Link href="/claim" className="tx">/claim</Link>.
          </p>
          {process.env.NEXT_PUBLIC_YIELD_VAULT && (
            <div className="mt-4 t-small ink-3">
              Yield target:{" "}
              <a
                href={`https://testnet.kitescan.ai/address/${process.env.NEXT_PUBLIC_YIELD_VAULT}`}
                target="_blank"
                rel="noreferrer"
                className="t-mono-sm text-kite-700 hover:text-kite-500"
              >
                SimpleYieldVault ({process.env.NEXT_PUBLIC_YIELD_VAULT.slice(0, 10)}…{process.env.NEXT_PUBLIC_YIELD_VAULT.slice(-4)})
              </a>{" "}
              — ERC-4626-shaped. Swap-ready for Aave/Compound when Kite
              DeFi ships.
            </div>
          )}
        </div>
      </header>

      <div className="px-8 py-7 max-w-[1040px] mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-7">
          <StatTile
            label="Unclaimed principal"
            value={formatUSDC(total)}
            delta={`${unclaimed.length} author${unclaimed.length === 1 ? "" : "s"} waiting`}
          />
          <StatTile
            label="Yield accrued"
            value={formatUSDC(totalYield)}
            delta="5% APY · simulated"
            accent="emerald"
          />
          <StatTile
            label="Claimed + withdrawn"
            value={String(claimed.length)}
            delta={claimed.length > 0 ? "researchers paid out" : "no claims yet"}
          />
        </div>

        {!escrow && (
          <div className="card p-8">
            <div className="t-small ink-2">
              Escrow contract not yet configured. Set{" "}
              <code className="t-mono-sm">NEXT_PUBLIC_ESCROW_ADDRESS</code> in
              env.
            </div>
          </div>
        )}

        {escrow && rows.length === 0 && (
          <div className="card p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="t-h3">Escrow empty.</div>
              <div className="t-small ink-2 mt-1 max-w-[560px]">
                Deposits appear here the moment the next research query names
                an unclaimed author. Or seed manually via{" "}
                <code className="t-mono-sm">scripts/seed-escrow.mjs</code>.
              </div>
            </div>
            <Link href="/research" className="btn btn--primary">
              Start a research query →
            </Link>
          </div>
        )}

        {escrow && rows.length > 0 && (
          <div className="card p-0 overflow-x-auto">
            <div
              className="grid gap-4 px-5 py-3 surface-raised border-b border-token min-w-[720px]"
              style={{
                gridTemplateColumns: "32px 2fr 1.2fr 1fr 1fr 100px"
              }}
            >
              {["", "ORCID hash", "Deposited", "Principal", "Yield", "Status"].map(
                (h, i) => (
                  <span
                    key={i}
                    className="t-caption"
                    style={{
                      textAlign: i >= 3 && i < 5 ? "right" : "left",
                      color: i === 3 ? "var(--ink)" : "var(--ink-3)"
                    }}
                  >
                    {h}
                  </span>
                )
              )}
            </div>
            {rows.map((r, i) => {
              const isClaimed =
                r.claimer !== "0x0000000000000000000000000000000000000000";
              const depositDate = r.depositedAt
                ? new Date(Number(r.depositedAt) * 1000).toISOString().slice(0, 10)
                : "—";
              return (
                <div
                  key={r.orcidHash}
                  className="grid gap-4 px-5 py-3.5 items-center transition-colors hover:surface-raised min-w-[720px]"
                  style={{
                    gridTemplateColumns: "32px 2fr 1.2fr 1fr 1fr 100px",
                    borderBottom:
                      i < rows.length - 1 ? "1px solid var(--border)" : "none",
                    background: isClaimed ? "var(--emerald-50)" : "transparent"
                  }}
                >
                  <span className="t-mono-sm ink-3">{String(i + 1).padStart(2, "0")}</span>
                  <a
                    href={explorerTx(r.tx)}
                    target="_blank"
                    rel="noreferrer"
                    className="t-mono-sm text-kite-700 hover:text-kite-500"
                  >
                    {r.orcidHash.slice(0, 12)}…{r.orcidHash.slice(-6)}
                  </a>
                  <span className="t-small ink-2">{depositDate}</span>
                  <span className="t-mono text-right font-semibold">
                    {formatUSDC(r.principal)}
                  </span>
                  <span className="t-mono text-right text-emerald-700">
                    + {formatUSDC(r.accrued ?? 0n)}
                  </span>
                  <span className="flex justify-end">
                    {isClaimed ? (
                      <span
                        className="chip chip--success"
                        style={{ padding: "2px 8px" }}
                      >
                        <CheckIcon size={10} /> claimed
                      </span>
                    ) : (
                      <Link
                        href="/claim"
                        className="chip"
                        style={{ padding: "2px 8px" }}
                      >
                        claim →
                      </Link>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 flex justify-between items-center">
          <div className="t-small ink-3">
            {escrow && (
              <>
                Contract:{" "}
                <a
                  className="tx"
                  href={explorerAddress(escrow)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {escrow.slice(0, 10)}…{escrow.slice(-6)}{" "}
                  <ExternalLinkIcon size={11} />
                </a>
              </>
            )}
          </div>
          <span className="t-mono-sm ink-3">
            APY 5% · simulated · prod routes to Lucid vault
          </span>
        </div>
      </div>
    </main>
  );
}
