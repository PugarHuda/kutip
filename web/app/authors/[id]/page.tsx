import Link from "next/link";
import { notFound } from "next/navigation";
import type { Address } from "viem";
import { StatTile } from "@/components/ui";
import { ArrowRightIcon, CheckIcon } from "@/components/icons";
import { getAuthor, listAuthors, listPapers } from "@/lib/papers";
import { getAuthorStats } from "@/lib/ledger";
import { lookupClaim } from "@/lib/claim-registry";
import { lookupOrcid } from "@/lib/orcid";
import { formatUSDC, explorerAddress } from "@/lib/kite";
import { fetchAuthorHistoryFromGoldsky, isSubgraphEnabled } from "@/lib/goldsky";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateStaticParams() {
  return listAuthors().map((a) => ({ id: a.id }));
}

export default async function AuthorDetailPage({
  params
}: {
  params: { id: string };
}) {
  const author = getAuthor(params.id);
  if (!author) notFound();

  const wallet = author.wallet as Address;
  const [[stats], orcidInfo, history] = await Promise.all([
    getAuthorStats([wallet]),
    author.orcid ? lookupOrcid(author.orcid) : Promise.resolve(null),
    isSubgraphEnabled()
      ? fetchAuthorHistoryFromGoldsky(author.wallet.toLowerCase(), 30)
      : Promise.resolve(null)
  ]);

  const claim = author.orcid ? lookupClaim(author.orcid) : undefined;
  const effectiveWallet = claim?.wallet ?? wallet;

  const papers = listPapers().filter((p) => p.authors.includes(author.id));
  const orcidLink = author.orcid
    ? `https://orcid.org/${author.orcid}`
    : null;

  const sparkDays = history
    ? history
        .slice()
        .reverse()
        .map((d) => Number(d.earnings) / 1e18)
    : [];

  const claimed = claim !== undefined;

  return (
    <main className="min-h-[calc(100vh-60px)] px-8 py-10">
      <div className="max-w-[960px] mx-auto">
        <Link
          href="/leaderboard"
          className="t-small ink-3 hover:text-kite-500 mb-5 inline-block"
        >
          ← All authors
        </Link>

        <div className="flex items-start justify-between flex-wrap gap-4 mb-7">
          <div>
            <div className="t-caption">Author profile</div>
            <h1 className="t-display-xl mt-1 mb-1">{author.name}</h1>
            <div className="t-body ink-2 m-0">{author.affiliation}</div>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            {claimed ? (
              <span className="chip chip--success">
                <CheckIcon size={11} /> Claimed
              </span>
            ) : (
              <span className="chip">Unclaimed</span>
            )}
            {orcidInfo?.real && (
              <span className="chip chip--success">ORCID verified</span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-7">
          <StatTile
            label="USDC earned"
            value={formatUSDC(stats.earnings)}
            delta={stats.earnings > 0n ? "attested on-chain" : "no earnings yet"}
            accent="emerald"
          />
          <StatTile
            label="Citations"
            value={String(stats.citations)}
            delta={Number(stats.citations) > 0 ? "all-time" : "waiting"}
          />
          <StatTile
            label="Papers in catalog"
            value={String(papers.length)}
            delta={papers.length > 0 ? "attributable" : "none indexed"}
          />
        </div>

        {sparkDays.length > 1 && (
          <div className="card p-5 mb-7">
            <div className="t-caption mb-2">30-day earnings</div>
            <Spark30 points={sparkDays} />
          </div>
        )}

        <div className="card p-6 mb-7">
          <div className="t-caption mb-3">On-chain identity</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="t-small ink-3 mb-1">
                {claimed ? "Claimed wallet" : "Placeholder wallet"}
              </div>
              <a
                href={explorerAddress(effectiveWallet)}
                target="_blank"
                rel="noreferrer"
                className="t-mono-sm text-kite-700 hover:text-kite-500 break-all"
              >
                {effectiveWallet}
              </a>
              {claimed && claim?.wallet.toLowerCase() !== wallet.toLowerCase() && (
                <div className="t-mono-sm ink-3 mt-1.5">
                  Original:{" "}
                  <a
                    href={explorerAddress(wallet)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-kite-700 hover:text-kite-500"
                  >
                    {wallet.slice(0, 10)}…{wallet.slice(-6)}
                  </a>
                </div>
              )}
            </div>
            <div>
              <div className="t-small ink-3 mb-1">ORCID iD</div>
              {orcidLink ? (
                <a
                  href={orcidLink}
                  target="_blank"
                  rel="noreferrer"
                  className="t-mono-sm text-kite-700 hover:text-kite-500"
                >
                  {author.orcid}
                </a>
              ) : (
                <span className="t-mono-sm ink-3">not registered</span>
              )}
              {orcidInfo?.real && (
                <div className="t-small ink-3 mt-1">
                  ✓ verified on orcid.org · {orcidInfo.worksCount ?? 0} works
                </div>
              )}
            </div>
          </div>

          {!claimed && author.orcid && (
            <div className="mt-5 pt-5 border-t border-token flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div className="t-small font-medium">Is this you?</div>
                <div className="t-small ink-3 mt-0.5">
                  Bind your real wallet to this ORCID — future payouts land in
                  your wallet instead of the placeholder.
                </div>
              </div>
              <Link
                href={`/claim?orcid=${encodeURIComponent(author.orcid)}`}
                className="btn btn--primary btn--sm"
              >
                Claim earnings <ArrowRightIcon />
              </Link>
            </div>
          )}
        </div>

        {papers.length > 0 && (
          <div className="card p-6">
            <div className="t-caption mb-3">Papers in the catalog</div>
            <ul className="space-y-4">
              {papers.map((p) => (
                <li key={p.id} className="pl-3 border-l-2 border-kite-200">
                  <div className="t-serif text-[16px]">{p.title}</div>
                  <div className="t-small ink-3 mt-0.5">
                    {p.journal} · {p.year}
                  </div>
                  <div className="t-mono-sm ink-3 mt-0.5 break-all">
                    doi:{p.doi} · co-authors:{" "}
                    {p.authors
                      .filter((aid) => aid !== author.id)
                      .map((aid) => getAuthor(aid)?.name ?? aid)
                      .join(", ") || "sole author"}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}

function Spark30({ points }: { points: number[] }) {
  if (points.length === 0) return null;
  const width = 800;
  const height = 80;
  const max = Math.max(...points, 0.00001);
  const step = width / Math.max(points.length - 1, 1);
  const path = points
    .map((v, i) => {
      const x = i * step;
      const y = height - (v / max) * (height - 4) - 2;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const area = `${path} L${width},${height} L0,${height} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-20">
      <path d={area} fill="var(--kite-500)" fillOpacity="0.1" />
      <path
        d={path}
        fill="none"
        stroke="var(--kite-500)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
