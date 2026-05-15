"use client";

import Link from "next/link";
import { useAccount } from "wagmi";

interface PassthroughRow {
  id: string;
  name: string;
  wallet: string;
  earnings: string; // bigint serialised — server can't pass bigint to a client boundary
  citations: number;
  orcid: string;
}

/**
 * "Your earnings" panel — shows up at the top of the Earnings page once
 * a wallet is connected. Filters the public leaderboard rows down to
 * the connected wallet so the user immediately sees where they stand.
 *
 * Three states the panel renders:
 *   - wallet disconnected → quiet hint that explains what this would show
 *   - wallet connected, no earnings → empty state with claim CTA
 *   - wallet connected, has earnings → big number + citation count + rank
 *
 * Why a client component: the underlying earnings list is server-rendered
 * (real on-chain reads), but the wallet identity is a browser concern
 * (wagmi reads from window.ethereum). Passing serialised rows in is
 * cheap — they're already in the page DOM as the leaderboard.
 */
export function MyEarningsCard({ rows }: { rows: PassthroughRow[] }) {
  const { address, isConnected } = useAccount();

  if (!isConnected || !address) {
    return (
      <div
        className="card mt-6 px-5 py-4 flex items-center justify-between gap-4"
        style={{
          background:
            "linear-gradient(90deg, color-mix(in srgb, var(--kite-500) 5%, transparent), transparent)"
        }}
      >
        <div>
          <div className="t-small font-semibold">See your own earnings</div>
          <div className="t-small ink-3 mt-0.5">
            Connect a wallet in the topbar — if Kutip has ever cited a paper
            you authored, your row appears here with citation count and total
            USDC accrued.
          </div>
        </div>
      </div>
    );
  }

  const lower = address.toLowerCase();
  const mine = rows.find((r) => r.wallet.toLowerCase() === lower);
  const earnings = mine ? safeBigInt(mine.earnings) : 0n;
  // Rank: 1-indexed position among rows with positive earnings.
  const ranked = rows
    .filter((r) => safeBigInt(r.earnings) > 0n)
    .sort((a, b) => Number(safeBigInt(b.earnings) - safeBigInt(a.earnings)));
  const rank =
    earnings > 0n
      ? ranked.findIndex((r) => r.wallet.toLowerCase() === lower) + 1
      : null;

  return (
    <div
      className="card mt-6 px-5 py-5 flex items-center justify-between gap-6 flex-wrap"
      style={{
        background:
          "linear-gradient(90deg, color-mix(in srgb, var(--kite-500) 10%, transparent), color-mix(in srgb, var(--emerald-500) 4%, transparent))",
        borderColor: "color-mix(in srgb, var(--kite-500) 30%, var(--border))"
      }}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="t-caption">Your earnings</span>
          {/* Explicit "connected" pill — without this, a connected wallet
              with 0 earnings reads ambiguously as "is the wallet hooked up
              or not?". Green dot + label removes the doubt. */}
          <span
            className="chip chip--success"
            style={{ padding: "2px 8px", fontSize: 10 }}
          >
            <span
              className="status-dot status-dot--done"
              style={{ width: 6, height: 6 }}
            />
            Wallet connected
          </span>
        </div>
        <div className="flex items-baseline gap-2 mt-1.5">
          <span className="t-mono font-bold text-[22px] text-emerald-700">
            {formatBigUSDC(earnings)} USDC
          </span>
          {mine && earnings > 0n && (
            <span className="t-small ink-3">
              · {mine.citations} citation{mine.citations === 1 ? "" : "s"}
              {rank !== null && <> · ranked #{rank}</>}
            </span>
          )}
        </div>
        <div className="t-mono-sm ink-3 mt-1 truncate" title={address}>
          {address.slice(0, 10)}…{address.slice(-8)}
          {mine?.orcid && <> · ORCID {mine.orcid}</>}
        </div>
      </div>

      <div className="flex gap-2 flex-none items-center">
        {earnings === 0n ? (
          <>
            <div className="t-small ink-3 max-w-[220px] text-right">
              This wallet is connected, but Kutip hasn't cited a paper you
              authored yet. Bind your ORCID below — future shares land here.
            </div>
            <Link href="/dashboard/claim" className="btn btn--primary btn--sm">
              Claim via ORCID
            </Link>
          </>
        ) : (
          <Link
            href={`/authors/${mine?.id ?? "me"}`}
            className="btn btn--ghost btn--sm"
          >
            View my history
          </Link>
        )}
      </div>
    </div>
  );
}

function formatBigUSDC(raw: bigint): string {
  const whole = raw / 10n ** 18n;
  const frac = (raw % 10n ** 18n).toString().padStart(18, "0").slice(0, 2);
  return `${whole}.${frac}`;
}

/**
 * BigInt() throws a synchronous SyntaxError on a malformed string. The
 * earnings strings cross a server→client serialisation boundary; one
 * bad row would otherwise white-screen the whole Earnings page (client
 * component, no error boundary). Fall back to 0n instead.
 */
function safeBigInt(s: string): bigint {
  try {
    return BigInt(s);
  } catch {
    return 0n;
  }
}
