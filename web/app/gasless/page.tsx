"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRightIcon } from "@/components/icons";
import { explorerAddress } from "@/lib/kite";

interface GaslessStats {
  paymaster: Wallet;
  researcherAA: Wallet | null;
  summarizerAA: Wallet | null;
  operatorEOA: Wallet | null;
  stats: {
    userGasPaid: string;
    userGasCurrency: string;
    note: string;
  };
}

interface Wallet {
  address: string;
  kiteBalance: string | null;
  usdcBalance: string | null;
  allowanceToPaymaster?: string | null;
  role: string;
}

function formatKite(raw: string | null | undefined): string {
  if (!raw) return "—";
  const v = BigInt(raw);
  const whole = v / 10n ** 18n;
  const frac = (v % 10n ** 18n).toString().padStart(18, "0").slice(0, 4);
  return `${whole}.${frac}`;
}

function formatUSDC(raw: string | null | undefined): string {
  if (!raw) return "—";
  const v = BigInt(raw);
  const whole = v / 10n ** 18n;
  const frac = (v % 10n ** 18n).toString().padStart(18, "0").slice(0, 2);
  return `${whole}.${frac}`;
}

export default function GaslessPage() {
  const [data, setData] = useState<GaslessStats | null>(null);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/gasless-stats", { cache: "no-store" });
        if (!res.ok) return;
        if (!cancelled) setData(await res.json());
      } catch {
        /* ignore */
      }
    }
    load();
    const t = setInterval(load, 10000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  return (
    <main className="min-h-[calc(100vh-60px)] px-8 py-10">
      <div className="max-w-[1040px] mx-auto">
        <div className="t-caption">Infrastructure</div>
        <h1 className="t-display-xl mt-1.5 mb-3">
          The agent pays for <span className="text-kite-500">its own gas.</span>
        </h1>
        <p className="t-body ink-2 max-w-[680px] m-0">
          Kutip&apos;s Researcher never holds KITE native tokens. When it submits an
          attestation, the Kite paymaster fronts the gas in KITE, then pulls its
          cost back in USDC from the agent&apos;s own smart account — in the same
          UserOperation, atomically. You, the user, pay zero gas in any currency.
        </p>

        <div className="mt-7 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div
            className="card p-5"
            style={{
              borderColor: "color-mix(in srgb, var(--emerald-500) 40%, var(--border))",
              background:
                "linear-gradient(180deg, color-mix(in srgb, var(--emerald-500) 6%, transparent), transparent)"
            }}
          >
            <div className="t-caption">Gas paid by user</div>
            <div
              className="t-mono font-bold mt-1"
              style={{ fontSize: 40, lineHeight: "44px", color: "var(--emerald-600)" }}
            >
              0
            </div>
            <div className="t-small ink-3 mt-1">
              not KITE, not USDC, not anything. zero.
            </div>
          </div>
          <div className="card p-5">
            <div className="t-caption">Paymaster covers</div>
            <div className="t-mono font-bold mt-1 text-[30px] leading-[36px]">
              {data ? formatKite(data.paymaster.kiteBalance) : "…"}
            </div>
            <div className="t-small ink-3 mt-1">
              KITE in paymaster ready to sponsor UserOps
            </div>
          </div>
          <div className="card p-5">
            <div className="t-caption">Agent pays paymaster in</div>
            <div className="t-mono font-bold mt-1 text-[30px] leading-[36px]">
              USDC
            </div>
            <div className="t-small ink-3 mt-1">
              via approve + transferFrom in postOp, live every query
            </div>
          </div>
        </div>

        <h2 className="t-h2 mt-12 mb-4">Live agent state</h2>
        <div className="flex flex-col gap-4">
          {data?.researcherAA && (
            <WalletCard
              title="Researcher AA"
              subtitle="Agent's own EIP-4337 smart account"
              w={data.researcherAA}
              highlightNoKite
              highlightAllowance
            />
          )}
          {data?.summarizerAA && (
            <WalletCard
              title="Summarizer AA"
              subtitle="Sub-agent · receives 5% from each query"
              w={data.summarizerAA}
              highlightNoKite
            />
          )}
          {data && (
            <WalletCard
              title="Paymaster"
              subtitle="Kite's gasless sponsor · 0x9Adc…e92d"
              w={data.paymaster}
            />
          )}
          {data?.operatorEOA && (
            <WalletCard
              title="Operator EOA"
              subtitle="Never signs attestations · only funds AAs"
              w={data.operatorEOA}
            />
          )}
        </div>

        <div className="mt-10 card p-7">
          <div className="t-caption">How a query settles gas</div>
          <ol className="mt-4 space-y-4">
            {[
              [
                "1",
                "Researcher AA builds UserOp",
                "approve(paymaster) → transfer(summarizer) → transfer(ledger) → attestAndSplit()"
              ],
              [
                "2",
                "Bundler validates + paymaster pre-approves",
                "Paymaster signs that it will sponsor, sets up postOp hook"
              ],
              [
                "3",
                "Batch executes on-chain",
                "All 4 calls atomic · fails together or succeeds together"
              ],
              [
                "4",
                "Paymaster postOp pulls USDC",
                "transferFrom(Researcher AA → paymaster, ~0.02 USDC) · gas reimbursed"
              ],
              [
                "5",
                "User sees result",
                "Zero signatures required after initial Passport delegation"
              ]
            ].map(([n, h, d]) => (
              <li key={n} className="flex gap-4">
                <div className="w-7 h-7 rounded-full bg-kite-500 text-white flex items-center justify-center t-mono-sm font-bold flex-none mt-0.5">
                  {n}
                </div>
                <div>
                  <div className="t-h3 text-[15px] font-semibold">{h}</div>
                  <div className="t-small ink-2 mt-0.5">{d}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-8 flex justify-end">
          <Link href="/research" className="btn btn--primary">
            Watch it happen live <ArrowRightIcon />
          </Link>
        </div>
      </div>
    </main>
  );
}

function WalletCard({
  title,
  subtitle,
  w,
  highlightNoKite,
  highlightAllowance
}: {
  title: string;
  subtitle: string;
  w: Wallet;
  highlightNoKite?: boolean;
  highlightAllowance?: boolean;
}) {
  const kiteValue = w.kiteBalance ? BigInt(w.kiteBalance) : 0n;
  const noKite = kiteValue === 0n;
  const approved =
    w.allowanceToPaymaster &&
    BigInt(w.allowanceToPaymaster) > 10n ** 18n;

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="t-caption flex items-center gap-2">
            <span>{title}</span>
            {highlightNoKite && noKite && (
              <span
                className="chip chip--success"
                style={{ padding: "2px 8px", fontSize: 10 }}
              >
                0 KITE — by design
              </span>
            )}
            {highlightAllowance && approved && (
              <span
                className="chip chip--success"
                style={{ padding: "2px 8px", fontSize: 10 }}
              >
                Paymaster approved ∞
              </span>
            )}
          </div>
          <div className="t-small ink-3 mt-0.5">{subtitle}</div>
          <a
            href={explorerAddress(w.address as `0x${string}`)}
            target="_blank"
            rel="noreferrer"
            className="t-mono-sm text-kite-700 hover:text-kite-500 mt-1.5 break-all block"
          >
            {w.address}
          </a>
        </div>
        <div className="text-right flex-none">
          <div
            className="t-mono font-bold text-[20px]"
            style={noKite && highlightNoKite ? { color: "var(--emerald-600)" } : undefined}
          >
            {formatKite(w.kiteBalance)} <span className="t-small ink-3">KITE</span>
          </div>
          <div className="t-mono ink-2 text-[14px] mt-0.5">
            {formatUSDC(w.usdcBalance)} <span className="t-small ink-3">USDC</span>
          </div>
        </div>
      </div>
    </div>
  );
}
