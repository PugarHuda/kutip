import Link from "next/link";
import type { Hex } from "viem";
import {
  getCitationsForQuery,
  getLedgerAddress,
  getQueryRecord
} from "@/lib/ledger";
import { explorerAddress, explorerTx, formatUSDC } from "@/lib/kite";
import { listAuthors } from "@/lib/papers";
import { getAccessMetrics, loadSummary } from "@/lib/summary-store";
import { Addr, Breadcrumb, PayoutRow } from "@/components/ui";
import { CheckIcon, CopyIcon, ExternalLinkIcon } from "@/components/icons";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function VerifyPage({ params }: { params: { queryId: string } }) {
  const rawId = params.queryId;
  const queryId = (rawId.startsWith("0x") ? rawId : `0x${rawId}`) as Hex;
  const ledger = getLedgerAddress();

  const [record, citations] = await Promise.all([
    getQueryRecord(queryId),
    getCitationsForQuery(queryId)
  ]);

  const authors = listAuthors();
  const walletToAuthor = new Map(authors.map((a) => [a.wallet.toLowerCase(), a]));
  const queryShort = `${queryId.slice(0, 10)}…${queryId.slice(-6)}`;
  const cachedSummary = loadSummary(queryId);
  const paywallMetrics = getAccessMetrics(queryId);
  const now = Date.now();
  const ageMin = record
    ? Math.max(0, Math.round((now / 1000 - Number(record.timestamp)) / 60))
    : 0;

  return (
    <main className="min-h-[calc(100vh-60px)] px-6 lg:px-14 py-12 lg:py-14">
      <div className="max-w-[820px] mx-auto">
        <div className="mb-6">
          <Breadcrumb
            items={[
              { label: "Verify", href: "/verify" },
              { label: `Query ${queryId.slice(0, 10)}…${queryId.slice(-4)}` }
            ]}
          />
        </div>

        <div
          className="card pattern-grid p-7 lg:p-8"
          style={{ background: "var(--surface-raised)", borderColor: "var(--kite-200)" }}
        >
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="t-caption text-kite-700">Attestation proof</div>
              <div className="flex items-center gap-1.5 mt-2">
                <span className="t-mono-sm ink-2">queryId · {queryShort}</span>
                <button
                  type="button"
                  className="ink-3 hover:text-[var(--ink)]"
                  aria-label="Copy query id"
                  title={queryId}
                >
                  <CopyIcon size={12} />
                </button>
              </div>
            </div>
            {record ? (
              <span className="chip chip--success chip--lg">
                <CheckIcon size={12} /> Attested on Kite · {ageMin}m ago
              </span>
            ) : ledger ? (
              <span className="chip chip--pending chip--lg">Not found on chain</span>
            ) : (
              <span className="chip chip--pending chip--lg">Contract not deployed</span>
            )}
          </div>
          <div
            className="t-serif mt-4"
            style={{ fontSize: 26, lineHeight: "34px", color: "var(--ink)" }}
          >
            {record ? (
              <>“attested query · see bibliography below”</>
            ) : (
              <>“Awaiting first attestation for this ID…”</>
            )}
          </div>
        </div>

        {!record && (
          <div className="mt-5 p-4 rounded-lg border border-amber-500/30 bg-amber-50 text-[color:var(--amber-700)] text-sm">
            No <code className="t-mono-sm">QueryRecord</code> found for{" "}
            <code className="t-mono-sm">{queryShort}</code>. Either the tx is still pending, the
            hash is wrong, or this query ran in demo mode. Run a new query from{" "}
            <Link href="/research" className="underline">
              /research
            </Link>
            .
          </div>
        )}

        {record && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-7 border-b border-token">
            <Fact label="Payer">
              <Addr
                full={record.payer}
                href={explorerAddress(record.payer)}
              >
                {record.payer.slice(0, 6)}…{record.payer.slice(-4)}
              </Addr>
            </Fact>
            <Fact label="Total paid">
              <span className="t-mono text-[15px] font-semibold">
                {formatUSDC(record.totalPaid)} USDC
              </span>
            </Fact>
            <Fact label="Authors share">
              <span className="t-small">
                {formatUSDC(record.authorsShare)} USDC · 40% of total
              </span>
            </Fact>
            <Fact label="Citation count">
              <span className="t-small">
                {record.citationCount} payouts
              </span>
            </Fact>
            <Fact label="Block timestamp">
              <span className="t-mono-sm">
                {new Date(Number(record.timestamp) * 1000).toISOString()}
              </span>
            </Fact>
            <Fact label="Contract">
              {ledger && (
                <a
                  href={explorerAddress(ledger)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5"
                >
                  <span className="t-mono-sm">
                    {ledger.slice(0, 6)}…{ledger.slice(-4)}
                  </span>
                  <span className="t-small ink-3">(AttributionLedger)</span>
                </a>
              )}
            </Fact>
          </div>
        )}

        {citations.length > 0 && (
          <div className="mt-7">
            <div className="t-caption mb-3">Payouts · {citations.length} transfers</div>
            <div className="card p-0 overflow-hidden">
              {citations.map((c, i) => {
                const author = walletToAuthor.get(c.author.toLowerCase());
                const walletShort = `${c.author.slice(0, 6)}…${c.author.slice(-4)}`;
                return (
                  <PayoutRow
                    key={`${c.author}-${c.txHash}`}
                    index={i}
                    top={i === 0}
                    name={author?.name ?? walletShort}
                    affiliation={author?.affiliation ?? "unknown affiliation"}
                    wallet={walletShort}
                    walletFull={c.author}
                    walletHref={explorerAddress(c.author)}
                    amount={`${formatUSDC(c.amount)} USDC`}
                    tx={`${c.txHash.slice(0, 10)}…`}
                    txHref={explorerTx(c.txHash)}
                  />
                );
              })}
              <div className="flex justify-between items-center px-5 py-3.5 surface-raised">
                <span className="t-small ink-2">Total authors share</span>
                <span className="t-mono font-bold text-[15px]">
                  {record ? formatUSDC(record.authorsShare) : "—"} USDC
                </span>
              </div>
            </div>
          </div>
        )}

        {cachedSummary && (
          <div
            className="mt-7 card p-6"
            style={{
              background: "var(--surface-raised)",
              borderColor: "var(--kite-200)"
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="t-caption text-kite-700">Reverse x402 · paywalled for agents</div>
              <span
                className="chip"
                style={{ padding: "1px 8px", fontSize: 10 }}
              >
                0.10 USDC / cite
              </span>
            </div>
            <div className="t-small ink-2 mb-3 max-w-[620px]">
              Downstream agents pay Kutip via x402 to cite this summary in their
              own answers. The loop closes: Kutip pays humans → Kutip earns
              from agents that reference it → humans keep earning too.
            </div>
            {paywallMetrics && paywallMetrics.accessCount > 0 ? (
              <div className="flex gap-6 text-sm">
                <div>
                  <div className="t-caption">Access count</div>
                  <div className="t-mono font-semibold text-[15px] mt-0.5">
                    {paywallMetrics.accessCount}
                  </div>
                </div>
                <div>
                  <div className="t-caption">Revenue earned</div>
                  <div className="t-mono font-semibold text-[15px] mt-0.5 text-emerald-700">
                    {(Number(paywallMetrics.revenueEarned) / 1e18).toFixed(2)} USDC
                  </div>
                </div>
                {paywallMetrics.lastAccessAt && (
                  <div>
                    <div className="t-caption">Last access</div>
                    <div className="t-small mt-0.5 ink-2">
                      {new Date(paywallMetrics.lastAccessAt).toISOString().slice(11, 19)} UTC
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="t-small ink-3">
                No agents have cited this yet — be the first by calling{" "}
                <code className="t-mono-sm">GET /api/summaries/{queryShort}</code>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2.5 justify-between items-center pt-6 mt-6 border-t border-token">
          <div className="t-small ink-3">Signed by Kutip agent · v0.1</div>
          <div className="flex gap-2">
            <button type="button" className="btn btn--ghost btn--sm">
              Copy permalink
            </button>
            <button type="button" className="btn btn--ghost btn--sm">
              Download JSON
            </button>
            {ledger && (
              <a
                href={explorerAddress(ledger)}
                target="_blank"
                rel="noreferrer"
                className="btn btn--primary btn--sm"
              >
                View on KiteScan <ExternalLinkIcon size={12} />
              </a>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="t-caption">{label}</div>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
