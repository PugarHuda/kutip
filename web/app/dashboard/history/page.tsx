import Link from "next/link";
import { listSummaries } from "@/lib/summary-store";
import { ArrowRightIcon } from "@/components/icons";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default async function DashboardHistoryPage() {
  const summaries = await listSummaries();

  return (
    <div className="px-6 lg:px-10 py-8 lg:py-10">
      <div className="max-w-[1040px] mx-auto">
        <div className="t-caption">Dashboard · History</div>
        <h1 className="t-h1-tight mt-1 mb-3">Research history</h1>
        <p className="t-body ink-2 max-w-[620px] m-0">
          Every research query Kutip has run and paid out. Open one for the
          full synthesis, its keccak256 digest, and the on-chain attestation.
        </p>

        {summaries.length === 0 ? (
          <div className="card p-10 text-center mt-8">
            <div className="t-h3">No research runs yet</div>
            <div className="t-small ink-2 mt-2 max-w-[440px] mx-auto">
              Run a query — its full summary and payout breakdown will be
              kept here for good.
            </div>
            <Link href="/research" className="btn btn--primary mt-5">
              Start a research query <ArrowRightIcon />
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3 mt-7">
            {summaries.map((s) => {
              const preview = s.summary
                .replace(/\s+/g, " ")
                .trim()
                .slice(0, 180);
              return (
                <Link
                  key={s.queryId}
                  href={`/dashboard/verify/${s.queryId}`}
                  className="card p-5 no-underline text-inherit transition-colors hover:surface-raised block"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="t-serif text-[16px] min-w-0">
                      {s.query}
                    </div>
                    <span className="t-mono-sm ink-3 flex-none">
                      {timeAgo(s.savedAt)}
                    </span>
                  </div>
                  <p
                    className="t-small ink-2 mt-1.5 mb-3"
                    style={{ lineHeight: "1.55" }}
                  >
                    {preview}
                    {s.summary.length > 180 ? "…" : ""}
                  </p>
                  <div className="flex items-center gap-4 flex-wrap t-mono-sm ink-3">
                    <span className="text-emerald-700 font-semibold">
                      {(s.totalPaidUSDC / 1e18).toFixed(2)} USDC paid
                    </span>
                    <span>·</span>
                    <span>{s.citations.length} citations</span>
                    <span>·</span>
                    <span title={`Summary digest ${s.summaryHash}`}>
                      digest {s.summaryHash.slice(0, 10)}…
                    </span>
                    <span className="ml-auto flex items-center gap-1 text-kite-700">
                      Open <ArrowRightIcon size={13} />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
