import Link from "next/link";
import type { Address } from "viem";
import {
  fetchLeaderboardFromGoldsky,
  isSubgraphEnabled,
  type GoldskyAuthor
} from "@/lib/goldsky";
import { getAuthorStats } from "@/lib/ledger";
import { listAuthors } from "@/lib/papers";
import { formatUSDC, explorerAddress } from "@/lib/kite";
import { ArrowRightIcon } from "@/components/icons";
import { StatTile } from "@/components/ui";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface AuthorRow {
  id: string;
  name: string;
  affiliation: string;
  wallet: string;
  orcid: string;
  earnings: bigint;
  citations: number;
}

export default async function DashboardEarningsPage() {
  const authors = listAuthors();
  const walletToMeta = new Map(
    authors.map((a) => [a.wallet.toLowerCase(), a])
  );

  let rows: AuthorRow[] = [];
  if (isSubgraphEnabled()) {
    const leaderboard = (await fetchLeaderboardFromGoldsky(20)) ?? [];
    rows = leaderboard.map((g: GoldskyAuthor) => {
      const meta = walletToMeta.get(g.id.toLowerCase());
      return {
        id: meta?.id ?? g.id,
        name: meta?.name ?? `${g.id.slice(0, 8)}…${g.id.slice(-4)}`,
        affiliation: meta?.affiliation ?? "unknown",
        wallet: g.id,
        orcid: meta?.orcid ?? "",
        earnings: BigInt(g.totalEarnings),
        citations: g.citationCount
      };
    });
  } else {
    const wallets = authors.map((a) => a.wallet as Address);
    const stats = await getAuthorStats(wallets);
    rows = authors.map((a, i) => ({
      id: a.id,
      name: a.name,
      affiliation: a.affiliation,
      wallet: a.wallet,
      orcid: a.orcid,
      earnings: stats[i].earnings,
      citations: Number(stats[i].citations)
    }));
  }

  rows.sort((a, b) => Number(b.earnings - a.earnings));
  const podium = rows.slice(0, 3);
  const rest = rows.slice(3).filter((r) => r.earnings > 0n);

  const totalEarnings = rows.reduce((s, r) => s + r.earnings, 0n);
  const totalCitations = rows.reduce((s, r) => s + r.citations, 0);
  const authorsPaid = rows.filter((r) => r.earnings > 0n).length;

  const medals = ["🥇", "🥈", "🥉"];
  // Use color-mix with surface so podium tints invert correctly in dark mode.
  const podiumAccents = [
    {
      border: "#d4af37",
      tint: "color-mix(in srgb, #d4af37 14%, var(--surface))",
      earn: "#a8821f"
    },
    {
      border: "#a8a8a8",
      tint: "color-mix(in srgb, #a8a8a8 14%, var(--surface))",
      earn: "#7a7a7a"
    },
    {
      border: "#c7832e",
      tint: "color-mix(in srgb, #c7832e 14%, var(--surface))",
      earn: "#9a6321"
    }
  ];

  return (
    <div className="px-6 lg:px-10 py-8 lg:py-10">
      <div className="max-w-[1040px] mx-auto">
        <div className="t-caption">Dashboard · Earnings</div>
        <h1 className="t-h1-tight mt-1 mb-3">Who got paid</h1>
        <p className="t-body ink-2 max-w-[620px] m-0">
          Authors whose papers Kutip cited. Rankings reflect cumulative USDC
          earned across all attested queries.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-7">
          <StatTile
            label="Authors paid"
            value={`${authorsPaid} / ${rows.length}`}
            delta={authorsPaid > 0 ? "at least 1 citation" : "none yet"}
          />
          <StatTile
            label="Citations paid"
            value={String(totalCitations)}
            delta={totalCitations > 0 ? "live-updated" : "no queries yet"}
          />
          <StatTile
            label="USDC distributed"
            value={formatUSDC(totalEarnings)}
            delta={totalEarnings > 0n ? "authors share only" : "awaiting first"}
            accent="emerald"
          />
        </div>

        {podium.some((p) => p.earnings > 0n) && (
          <>
            <h2 className="t-h2 mt-10 mb-4">Top 3</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {podium.map((r, i) => {
                const accent = podiumAccents[i];
                return (
                  <Link
                    key={r.id}
                    href={`/authors/${r.id}`}
                    className="card p-5 no-underline text-inherit hover:-translate-y-0.5 transition-transform"
                    style={{
                      borderTop: `3px solid ${accent.border}`,
                      background: `linear-gradient(180deg, ${accent.tint}, transparent)`
                    }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-2xl">{medals[i]}</span>
                      <span className="t-mono-sm ink-3">#{i + 1}</span>
                    </div>
                    <div className="t-serif text-[17px]">{r.name}</div>
                    <div className="t-small ink-3 mt-1">{r.affiliation}</div>
                    <div
                      className="t-mono font-bold mt-3 tracking-tight"
                      style={{ color: accent.earn, fontSize: 22 }}
                    >
                      {formatUSDC(r.earnings)} USDC
                    </div>
                    <div className="t-mono-sm ink-3 mt-1">
                      {r.citations} citation{r.citations === 1 ? "" : "s"}
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        )}

        {rest.length > 0 && (
          <>
            <h2 className="t-h2 mt-10 mb-3">Others</h2>
            <div className="card p-0 overflow-hidden">
              {rest.map((r, i) => (
                <Link
                  key={r.id}
                  href={`/authors/${r.id}`}
                  className="grid px-5 py-3 gap-3 items-center hover:surface-raised no-underline text-inherit"
                  style={{
                    gridTemplateColumns: "40px 1.5fr 1fr 100px 120px",
                    borderBottom:
                      i < rest.length - 1 ? "1px solid var(--border)" : "none"
                  }}
                >
                  <span className="t-mono-sm ink-3">
                    {String(i + 4).padStart(2, "0")}
                  </span>
                  <span className="t-serif text-[15px]">{r.name}</span>
                  <span className="t-small ink-2">{r.affiliation}</span>
                  <span className="t-mono-sm text-right">{r.citations}</span>
                  <span className="t-mono text-right font-semibold text-emerald-700">
                    {formatUSDC(r.earnings)}
                  </span>
                </Link>
              ))}
            </div>
          </>
        )}

        <div
          className="card mt-8 flex items-center justify-between px-5 py-4"
          style={{
            background:
              "linear-gradient(90deg, color-mix(in srgb, var(--kite-500) 7%, transparent), transparent)"
          }}
        >
          <div>
            <div className="t-small font-semibold">
              Are you one of these authors?
            </div>
            <div className="t-small ink-3 mt-0.5">
              Bind your ORCID to claim — unclaimed shares accrue 5% APY in
              escrow.
            </div>
          </div>
          <Link href="/claim" className="btn btn--primary btn--sm">
            Claim via ORCID <ArrowRightIcon />
          </Link>
        </div>

        <div className="mt-8 t-small ink-3">
          Deep-dive:{" "}
          <Link href="/leaderboard" className="tx">
            full leaderboard with filters and 7-day sparklines
          </Link>
          .
        </div>
      </div>
    </div>
  );
}
