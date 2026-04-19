import { listAuthors } from "@/lib/papers";
import { getAuthorStats, getLedgerAddress } from "@/lib/ledger";
import { explorerAddress, formatUSDC } from "@/lib/kite";
import {
  fetchAuthorHistoryFromGoldsky,
  fetchLeaderboardFromGoldsky,
  isSubgraphEnabled
} from "@/lib/goldsky";
import { Addr, StatTile } from "@/components/ui";
import { ExternalLinkIcon } from "@/components/icons";
import type { Address } from "viem";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function Spark({ trend }: { trend: "up" | "down" | "flat" }) {
  const paths = {
    up: "M1 18 L8 14 L15 16 L22 10 L29 8 L36 5 L43 6",
    down: "M1 6  L8 9  L15 8  L22 14 L29 13 L36 16 L43 18",
    flat: "M1 12 L8 10 L15 12 L22 11 L29 13 L36 11 L43 12"
  };
  const col =
    trend === "up" ? "var(--emerald-500)" : trend === "down" ? "var(--rose-500)" : "var(--ink-3)";
  return (
    <svg width={46} height={22} viewBox="0 0 46 22" className="block">
      <path
        d={paths[trend]}
        stroke={col}
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Real 7-day sparkline from subgraph data — one line per point. */
function RealSpark({ points }: { points: number[] }) {
  if (points.length === 0) return <Spark trend="flat" />;
  const max = Math.max(...points, 1);
  const w = 46;
  const h = 22;
  const pad = 2;
  const step = (w - pad * 2) / Math.max(points.length - 1, 1);
  const d = points
    .map((v, i) => {
      const x = pad + i * step;
      const y = h - pad - (v / max) * (h - pad * 2);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="block">
      <path
        d={d}
        stroke="var(--emerald-500)"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default async function LeaderboardPage() {
  const authors = listAuthors();
  const wallets = authors.map((a) => a.wallet as Address);

  const useSubgraph = isSubgraphEnabled();
  const walletToMeta = new Map(
    authors.map((a) => [a.wallet.toLowerCase(), a])
  );

  type Row = {
    id: string;
    name: string;
    affiliation: string;
    wallet: string;
    orcid: string;
    earnings: bigint;
    citations: number;
    sparkPoints: number[];
  };

  let rows: Row[];
  let dataSource: "goldsky" | "rpc";

  if (useSubgraph) {
    const leaderboard = await fetchLeaderboardFromGoldsky(50);
    if (leaderboard) {
      dataSource = "goldsky";
      // Per-author 7d sparkline — fire in parallel for top 20
      const history = await Promise.all(
        leaderboard.slice(0, 20).map((a) => fetchAuthorHistoryFromGoldsky(a.id, 7))
      );
      rows = leaderboard.map((a, i) => {
        const meta = walletToMeta.get(a.id.toLowerCase());
        const days = history[i] ?? [];
        return {
          id: a.id,
          name: meta?.name ?? `Unclaimed · ${a.id.slice(0, 10)}…`,
          affiliation: meta?.affiliation ?? "unknown author",
          wallet: a.id,
          orcid: meta?.orcid ?? "",
          earnings: BigInt(a.totalEarnings),
          citations: a.citationCount,
          sparkPoints: days
            .slice()
            .reverse()
            .map((d) => Number(d.earnings) / 1e18)
        };
      });
    } else {
      dataSource = "rpc";
      const stats = await getAuthorStats(wallets);
      rows = authors.map((a, i) => ({
        id: a.id,
        name: a.name,
        affiliation: a.affiliation,
        wallet: a.wallet,
        orcid: a.orcid,
        earnings: stats[i].earnings,
        citations: Number(stats[i].citations),
        sparkPoints: []
      }));
    }
  } else {
    dataSource = "rpc";
    const stats = await getAuthorStats(wallets);
    rows = authors.map((a, i) => ({
      id: a.id,
      name: a.name,
      affiliation: a.affiliation,
      wallet: a.wallet,
      orcid: a.orcid,
      earnings: stats[i].earnings,
      citations: Number(stats[i].citations),
      sparkPoints: []
    }));
  }

  rows.sort(
    (a, b) => Number(b.earnings - a.earnings) || b.citations - a.citations
  );

  const ledgerAddr = getLedgerAddress();
  const totalEarnings = rows.reduce((acc, r) => acc + r.earnings, 0n);
  const totalCitations = rows.reduce((acc, r) => acc + r.citations, 0);
  const authorsPaid = rows.filter((r) => r.earnings > 0n).length;

  return (
    <main className="min-h-[calc(100vh-60px)]">
      <header className="px-8 py-10 border-b border-token">
        <div className="max-w-[1280px] mx-auto">
          <div className="t-caption">Attribution ledger · live</div>
          <h1 className="t-display-xl mt-1.5 mb-2.5">Author earnings.</h1>
          <p className="t-body ink-2 max-w-[640px] m-0">
            Who Kutip&apos;s agent has cited — and paid — this week. Stats read live from the
            AttributionLedger contract on Kite testnet.
          </p>
        </div>
      </header>

      <div className="px-8 py-7 max-w-[1280px] mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-7">
          <StatTile
            label="Authors tracked"
            value={`${authorsPaid} / ${authors.length}`}
            delta={`+ ${authorsPaid} paid`}
          />
          <StatTile
            label="Total citations paid"
            value={String(totalCitations)}
            delta={totalCitations > 0 ? "live-updated" : "no queries yet"}
          />
          <StatTile
            label="USDC paid out"
            value={formatUSDC(totalEarnings)}
            delta={totalEarnings > 0n ? "authors share only (40%)" : "awaiting first attestation"}
            accent="emerald"
          />
        </div>

        {totalEarnings === 0n && (
          <div className="card p-8 mb-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="t-h3">No earnings yet.</div>
              <div className="t-small ink-2 mt-1 max-w-[560px]">
                Run your first research query and every cited author on the list below
                will receive a USDC payout the moment the attestation lands on chain.
              </div>
            </div>
            <a href="/research" className="btn btn--primary">
              Start a research query →
            </a>
          </div>
        )}

        <div className="flex justify-between items-center mb-4">
          <div className="flex gap-1.5">
            <button
              type="button"
              aria-pressed="true"
              className="btn btn--ghost btn--sm surface-raised"
            >
              All time
            </button>
            <button type="button" className="btn btn--ghost btn--sm">
              This week
            </button>
            <button type="button" className="btn btn--ghost btn--sm">
              This month
            </button>
          </div>
          <div className="t-small ink-3">
            Sort: <strong style={{ color: "var(--ink)" }}>USDC earned ↓</strong>
          </div>
        </div>

        <div className="card p-0 overflow-x-auto">
          <div
            className="grid gap-4 px-5 py-3 surface-raised border-b border-token min-w-[760px]"
            style={{ gridTemplateColumns: "54px 1.6fr 1.5fr 100px 130px 160px 80px" }}
          >
            {["#", "Author", "Affiliation", "Citations ↕", "USDC earned ↓", "Wallet", "7-day"].map(
              (h, i) => (
                <span
                  key={i}
                  className="t-caption"
                  style={{
                    textAlign: i >= 3 && i < 6 ? "right" : "left",
                    color: i === 4 ? "var(--ink)" : "var(--ink-3)"
                  }}
                >
                  {h}
                </span>
              )
            )}
          </div>
          {rows.map((r, i) => {
            const top = i === 0 && r.earnings > 0n;
            const trend: "up" | "down" | "flat" =
              r.citations > 0 ? "up" : r.earnings > 0n ? "flat" : "flat";
            const walletShort = `${r.wallet.slice(0, 6)}…${r.wallet.slice(-4)}`;
            const useRealSpark = r.sparkPoints.length > 1;
            return (
              <div
                key={r.id}
                className="grid gap-4 px-5 py-3.5 items-center transition-colors hover:surface-raised min-w-[760px]"
                style={{
                  gridTemplateColumns: "54px 1.6fr 1.5fr 100px 130px 160px 80px",
                  background: top ? "var(--emerald-50)" : "transparent",
                  borderLeft: top ? "2px solid var(--emerald-500)" : "2px solid transparent",
                  borderBottom:
                    i < rows.length - 1 ? "1px solid var(--border)" : "none"
                }}
              >
                <span className="t-mono-sm ink-3">{String(i + 1).padStart(2, "0")}</span>
                <span className="t-serif text-[17px]">{r.name}</span>
                <span className="t-small ink-2">{r.affiliation}</span>
                <span className="t-mono text-right">{r.citations}</span>
                <span
                  className="t-mono text-right text-[15px] font-semibold"
                  style={{ color: top ? "var(--emerald-700)" : "var(--ink)" }}
                >
                  {formatUSDC(r.earnings)}
                </span>
                <span className="flex justify-end">
                  <Addr
                    full={r.wallet}
                    href={explorerAddress(r.wallet as `0x${string}`)}
                  >
                    {walletShort}
                  </Addr>
                </span>
                <span className="flex justify-end">
                  {useRealSpark ? (
                    <RealSpark points={r.sparkPoints} />
                  ) : (
                    <Spark trend={trend} />
                  )}
                </span>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex justify-between items-center">
          <div className="t-small ink-3">
            {ledgerAddr ? (
              <>
                {dataSource === "goldsky" ? (
                  <>Stats indexed by Goldsky subgraph · sparklines show real 7-day history</>
                ) : (
                  <>
                    Stats read live from{" "}
                    <a
                      className="tx"
                      href={explorerAddress(ledgerAddr)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      AttributionLedger contract on Kite testnet{" "}
                      <ExternalLinkIcon size={11} />
                    </a>
                  </>
                )}
              </>
            ) : (
              <>AttributionLedger not yet deployed — values shown are placeholders.</>
            )}
          </div>
          <span className="t-mono-sm ink-3">
            {dataSource === "goldsky" ? "goldsky · cached 15s" : "rpc · per-request"}
          </span>
        </div>
      </div>
    </main>
  );
}
