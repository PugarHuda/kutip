import Link from "next/link";
import type { Address } from "viem";
import { getAuthorStats, getLedgerAddress } from "@/lib/ledger";
import { listAuthors } from "@/lib/papers";
import {
  fetchLeaderboardFromGoldsky,
  fetchRecentAttestationsFromGoldsky,
  isSubgraphEnabled,
  type GoldskyAttestation,
  type GoldskyAuthor
} from "@/lib/goldsky";
import { formatUSDC, explorerAddress, explorerTx } from "@/lib/kite";
import { ArrowRightIcon, CheckIcon } from "@/components/icons";
import { StatTile, Breadcrumb } from "@/components/ui";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const RESEARCHER_AA = "0x4da7f4cFd443084027a39cc0f7c41466d9511776" as const;
const SUMMARIZER_AA = "0xA6C36bA2BC8E84fCF276721F30FC79ceD609ef5c" as const;

export default async function DashboardPage() {
  const authors = listAuthors();
  const wallets = authors.map((a) => a.wallet as Address);

  const [stats, recent, subgraphAuthors] = await Promise.all([
    getAuthorStats(wallets),
    isSubgraphEnabled()
      ? fetchRecentAttestationsFromGoldsky(10)
      : Promise.resolve(null),
    isSubgraphEnabled()
      ? fetchLeaderboardFromGoldsky(5)
      : Promise.resolve(null)
  ]);

  const totalPaid = stats.reduce((acc, s) => acc + s.earnings, 0n);
  const totalCitations = stats.reduce((acc, s) => acc + Number(s.citations), 0);
  const authorsPaid = stats.filter((s) => s.citations > 0n).length;
  const ledger = getLedgerAddress();

  return (
    <main className="min-h-[calc(100vh-60px)] px-6 lg:px-10 py-8">
      <div className="max-w-[1280px] mx-auto">
        <div className="mb-4">
          <Breadcrumb items={[{ label: "Dashboard" }]} />
        </div>

        <header className="flex items-end justify-between flex-wrap gap-4 mb-7">
          <div>
            <div className="t-caption">Mission control</div>
            <h1 className="t-display-xl mt-1 mb-1">
              Kutip dashboard.
            </h1>
            <p className="t-body ink-2 m-0 max-w-[520px]">
              Everything the agent is doing, right now. Every attestation, every
              author paid, every cross-chain mirror.
            </p>
          </div>
          <Link href="/research" className="btn btn--primary btn--lg">
            Start a research query <ArrowRightIcon />
          </Link>
        </header>

        {/* stat strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-7">
          <StatTile
            label="Citations attested"
            value={String(totalCitations)}
            delta={totalCitations > 0 ? "live from subgraph" : "no queries yet"}
          />
          <StatTile
            label="USDC distributed"
            value={formatUSDC(totalPaid)}
            delta={totalPaid > 0n ? "to real wallets" : "awaiting first query"}
            accent="emerald"
          />
          <StatTile
            label="Authors paid"
            value={`${authorsPaid} / ${authors.length}`}
            delta={`${authorsPaid} wallets with earnings`}
          />
          <StatTile
            label="Attestations on chain"
            value={String(recent?.length ?? 0)}
            delta={
              recent && recent.length > 0
                ? "10 most recent shown below"
                : "subgraph warming up"
            }
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">
          {/* Main content: activity + earnings */}
          <div className="flex flex-col gap-5">
            {/* Recent activity */}
            <section className="card p-0 overflow-hidden">
              <header className="px-5 py-4 border-b border-token flex items-center justify-between">
                <div>
                  <div className="t-caption">Recent activity</div>
                  <div className="t-h3 text-[16px] font-semibold mt-0.5">
                    Latest attestations
                  </div>
                </div>
                <Link
                  href="/verify"
                  className="t-small ink-3 hover:text-kite-500"
                >
                  All attestations →
                </Link>
              </header>
              {!recent || recent.length === 0 ? (
                <div className="p-8 text-center t-small ink-3">
                  No attestations yet.{" "}
                  <Link href="/research" className="text-kite-700">
                    Run the first query →
                  </Link>
                </div>
              ) : (
                <ul className="divide-y divide-[color:var(--border)]">
                  {recent.slice(0, 6).map((a: GoldskyAttestation) => (
                    <ActivityRow key={a.id} a={a} />
                  ))}
                </ul>
              )}
            </section>

            {/* Top authors */}
            <section className="card p-0 overflow-hidden">
              <header className="px-5 py-4 border-b border-token flex items-center justify-between">
                <div>
                  <div className="t-caption">Top earners</div>
                  <div className="t-h3 text-[16px] font-semibold mt-0.5">
                    Most-cited authors
                  </div>
                </div>
                <Link
                  href="/leaderboard"
                  className="t-small ink-3 hover:text-kite-500"
                >
                  Full leaderboard →
                </Link>
              </header>
              {!subgraphAuthors || subgraphAuthors.length === 0 ? (
                <div className="p-8 text-center t-small ink-3">
                  No author earnings yet.
                </div>
              ) : (
                <ul className="divide-y divide-[color:var(--border)]">
                  {subgraphAuthors.slice(0, 5).map((a: GoldskyAuthor, i) => {
                    const meta = authors.find(
                      (x) => x.wallet.toLowerCase() === a.id.toLowerCase()
                    );
                    return (
                      <AuthorRow
                        key={a.id}
                        rank={i + 1}
                        name={meta?.name ?? `Unclaimed ${a.id.slice(0, 8)}…`}
                        wallet={a.id}
                        authorId={meta?.id}
                        earnings={a.totalEarnings}
                        citations={a.citationCount}
                      />
                    );
                  })}
                </ul>
              )}
            </section>
          </div>

          {/* Sidebar: agent state + quick actions */}
          <aside className="flex flex-col gap-4">
            <section className="card p-5">
              <div className="t-caption mb-3">Agent identities</div>
              <div className="space-y-3">
                <IdentityBlock
                  label="Researcher"
                  subtitle="Primary AA · pays authors"
                  address={RESEARCHER_AA}
                />
                <IdentityBlock
                  label="Summarizer"
                  subtitle="Sub-agent · 5% fee"
                  address={SUMMARIZER_AA}
                />
                {ledger && (
                  <IdentityBlock
                    label="Ledger"
                    subtitle="AttributionLedger contract"
                    address={ledger}
                  />
                )}
              </div>
            </section>

            <section className="card p-5">
              <div className="t-caption mb-3">Quick actions</div>
              <div className="flex flex-col gap-2">
                <Link
                  href="/research"
                  className="btn btn--primary btn--sm justify-between"
                >
                  <span>Run a query</span>
                  <ArrowRightIcon />
                </Link>
                <Link
                  href="/claim"
                  className="btn btn--ghost btn--sm justify-between"
                >
                  <span>Claim earnings (ORCID)</span>
                  <ArrowRightIcon />
                </Link>
                <Link
                  href="/bounties"
                  className="btn btn--ghost btn--sm justify-between"
                >
                  <span>Sponsor research</span>
                  <ArrowRightIcon />
                </Link>
              </div>
            </section>

            <section className="card p-5">
              <div className="t-caption mb-3">Infrastructure</div>
              <div className="flex flex-col gap-1.5">
                <InfraLink
                  href="/gasless"
                  label="Gasless / paymaster"
                  badge="Active"
                />
                <InfraLink
                  href="/governance"
                  label="Safe 2-of-3 governance"
                  badge="Live"
                />
                <InfraLink
                  href="/agents"
                  label="Agent registry (ERC-8004)"
                  badge="2 agents"
                />
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}

function ActivityRow({ a }: { a: GoldskyAttestation }) {
  const paid = BigInt(a.totalPaid);
  const date = new Date(Number(a.timestamp) * 1000);
  const short = `${a.id.slice(0, 10)}…${a.id.slice(-4)}`;
  return (
    <li className="px-5 py-3 flex items-center justify-between gap-4 hover:surface-raised transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <span className="status-dot status-dot--done" style={{ width: 8, height: 8 }} />
        <div className="min-w-0">
          <div className="t-small font-semibold truncate">
            Query attested · {a.citationCount} citations
          </div>
          <div className="t-mono-sm ink-3">
            {short} ·{" "}
            {date.toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit"
            })}
          </div>
        </div>
      </div>
      <div className="text-right flex-none">
        <div className="t-mono font-semibold text-emerald-700">
          +{formatUSDC(paid)} USDC
        </div>
        <a
          href={explorerTx(a.tx)}
          target="_blank"
          rel="noreferrer"
          className="t-mono-sm text-kite-700 hover:text-kite-500"
        >
          kitescan ↗
        </a>
      </div>
    </li>
  );
}

function AuthorRow({
  rank,
  name,
  wallet,
  authorId,
  earnings,
  citations
}: {
  rank: number;
  name: string;
  wallet: string;
  authorId?: string;
  earnings: string;
  citations: number;
}) {
  const medals = ["🥇", "🥈", "🥉"];
  const medal = medals[rank - 1];
  const href = authorId ? `/authors/${authorId}` : explorerAddress(wallet as `0x${string}`);
  return (
    <li>
      <Link
        href={href}
        className="px-5 py-3 flex items-center justify-between gap-4 hover:surface-raised transition-colors no-underline text-inherit"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="t-mono-sm w-7 text-center">{medal ?? rank}</span>
          <div className="min-w-0">
            <div className="t-serif text-[15px] truncate">{name}</div>
            <div className="t-mono-sm ink-3">{citations} citations</div>
          </div>
        </div>
        <div className="t-mono font-semibold text-right">
          {formatUSDC(BigInt(earnings))} USDC
        </div>
      </Link>
    </li>
  );
}

function IdentityBlock({
  label,
  subtitle,
  address
}: {
  label: string;
  subtitle: string;
  address: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="t-small font-semibold">{label}</span>
        <span className="t-mono-sm ink-3">
          {address.slice(0, 6)}…{address.slice(-4)}
        </span>
      </div>
      <a
        href={explorerAddress(address as `0x${string}`)}
        target="_blank"
        rel="noreferrer"
        className="t-mono-sm ink-3 hover:text-kite-500 break-all block mt-0.5"
      >
        {subtitle}
      </a>
    </div>
  );
}

function InfraLink({
  href,
  label,
  badge
}: {
  href: string;
  label: string;
  badge: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-2 py-1.5 hover:text-kite-500 transition-colors t-small no-underline text-inherit"
    >
      <span>{label}</span>
      <span className="chip chip--success" style={{ padding: "2px 8px", fontSize: 10 }}>
        <CheckIcon size={10} /> {badge}
      </span>
    </Link>
  );
}
