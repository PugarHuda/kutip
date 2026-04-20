"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckIcon } from "@/components/icons";
import { explorerAddress } from "@/lib/kite";

interface SafeStats {
  enabled: boolean;
  address?: string;
  owners?: string[];
  threshold?: number;
  ownerCount?: number;
  nonce?: number;
  version?: string;
  kiteBalance?: string;
  usdcBalance?: string;
  error?: string;
}

function formatKite(raw: string | undefined): string {
  if (!raw) return "—";
  const v = BigInt(raw);
  const whole = v / 10n ** 18n;
  const frac = (v % 10n ** 18n).toString().padStart(18, "0").slice(0, 4);
  return `${whole}.${frac}`;
}

function formatUSDC(raw: string | undefined): string {
  if (!raw) return "—";
  const v = BigInt(raw);
  const whole = v / 10n ** 18n;
  const frac = (v % 10n ** 18n).toString().padStart(18, "0").slice(0, 2);
  return `${whole}.${frac}`;
}

const OWNER_LABELS: Record<string, string> = {
  operator: "Operator EOA",
  ecosystem: "Ecosystem backup",
  guardian: "Researcher guardian"
};

export default function GovernancePage() {
  const [stats, setStats] = useState<SafeStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/safe-stats", { cache: "no-store" });
        const j = await res.json();
        if (!cancelled) setStats(j);
      } catch {
        /* ignore */
      }
    }
    load();
    const t = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  if (stats?.enabled === false) {
    return (
      <main className="px-8 py-14 max-w-[640px] mx-auto text-center">
        <h1 className="t-display-xl">Governance Safe not configured.</h1>
        <p className="t-body ink-2 mt-3">
          Deploy via <code className="t-mono-sm">node scripts/deploy-safe.mjs</code>{" "}
          then set <code className="t-mono-sm">NEXT_PUBLIC_OPERATOR_SAFE</code> in env.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-60px)] px-8 py-10">
      <div className="max-w-[960px] mx-auto">
        <div className="t-caption">Governance</div>
        <h1 className="t-display-xl mt-1.5 mb-3">
          No single person can move Kutip&apos;s money.
        </h1>
        <p className="t-body ink-2 max-w-[680px] m-0">
          The ecosystem fund and escrow withdrawals are gated by a Safe
          multisig on Kite testnet. Two of three signers must approve any
          transaction — so even if one signer&apos;s key leaks, funds stay
          put. Attestation signing stays on the agent&apos;s AA (fast path),
          config changes go through the Safe (slow path).
        </p>

        {!stats && (
          <div className="mt-8 t-small ink-3">Loading Safe state…</div>
        )}

        {stats?.address && (
          <>
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="card p-5">
                <div className="t-caption">Signers required</div>
                <div
                  className="t-mono font-bold mt-1 text-kite-700"
                  style={{ fontSize: 44, lineHeight: "44px" }}
                >
                  {stats.threshold ?? "?"} / {stats.ownerCount ?? "?"}
                </div>
                <div className="t-small ink-3 mt-1">threshold / total</div>
              </div>
              <div className="card p-5">
                <div className="t-caption">Safe balance</div>
                <div className="t-mono font-bold mt-1 text-[26px] leading-[30px]">
                  {formatUSDC(stats.usdcBalance)}
                </div>
                <div className="t-small ink-3 mt-1">USDC · {formatKite(stats.kiteBalance)} KITE</div>
              </div>
              <div className="card p-5">
                <div className="t-caption">Safe version / nonce</div>
                <div className="t-mono font-bold mt-1 text-[22px] leading-[26px]">
                  v{stats.version} · {stats.nonce}
                </div>
                <div className="t-small ink-3 mt-1">contract version · tx count</div>
              </div>
            </div>

            <h2 className="t-h2 mt-10 mb-4">Safe address</h2>
            <div className="card p-5 flex items-center justify-between flex-wrap gap-3">
              <a
                href={explorerAddress(stats.address as `0x${string}`)}
                target="_blank"
                rel="noreferrer"
                className="t-mono text-[15px] text-kite-700 hover:text-kite-500 break-all"
              >
                {stats.address}
              </a>
              <span className="chip chip--success">
                <CheckIcon size={11} /> Live on Kite testnet
              </span>
            </div>

            <h2 className="t-h2 mt-10 mb-4">Owners</h2>
            <div className="flex flex-col gap-3">
              {(stats.owners ?? []).map((o, i) => (
                <div
                  key={o}
                  className="card p-4 flex items-start justify-between gap-4 flex-wrap"
                >
                  <div>
                    <div className="t-caption">Signer {i + 1}</div>
                    <a
                      href={explorerAddress(o as `0x${string}`)}
                      target="_blank"
                      rel="noreferrer"
                      className="t-mono-sm text-kite-700 hover:text-kite-500 mt-1 break-all block"
                    >
                      {o}
                    </a>
                  </div>
                  <span className="chip" style={{ padding: "2px 10px", fontSize: 10 }}>
                    weight 1
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-10 card p-7">
              <div className="t-caption mb-3">Migration path</div>
              <p className="t-body ink-2 m-0 max-w-[680px]">
                AttributionLedger, Escrow, and BountyMarket currently have an
                immutable <code className="t-mono-sm">operator</code> set to the
                Operator EOA. The next deploy will pass this Safe address
                instead — from that point, fee-split constant changes, escrow
                parameter updates, and emergency pauses all require two
                signatures. Attestation signing stays on the Researcher AA
                (which is rate-limited by Passport session delegation), so
                query latency is unaffected.
              </p>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
