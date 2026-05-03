"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";

interface WalletBalance {
  address: string;
  balance: string | null;
  label: string;
}

interface BalancesResponse {
  eoa: WalletBalance | null;
  researcher: WalletBalance | null;
  summarizer: WalletBalance | null;
  escrow: WalletBalance | null;
}

interface SessionEnvelope {
  id: string;
  intent: {
    maxPerQueryUSDC: string;
    dailyCapUSDC: string;
    validUntil: string;
  };
  spentToday: string;
}

function formatUSDC(raw: string | null | undefined): string {
  if (!raw) return "—";
  const v = BigInt(raw);
  const whole = v / 10n ** 18n;
  const frac = (v % 10n ** 18n).toString().padStart(18, "0").slice(0, 2);
  return `${whole}.${frac}`;
}

function readSession(addr: string | undefined): SessionEnvelope | null {
  if (!addr || typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`kutip.passport.v1:${addr.toLowerCase()}`);
    return raw ? (JSON.parse(raw) as SessionEnvelope) : null;
  } catch {
    return null;
  }
}

export function AgentStateFooter() {
  const { address } = useAccount();
  const [balances, setBalances] = useState<BalancesResponse | null>(null);
  const [session, setSession] = useState<SessionEnvelope | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/balances", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as BalancesResponse;
        if (!cancelled) setBalances(json);
      } catch {
        /* ignore */
      }
    }
    load();
    const t = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    setSession(readSession(address));
    const onStorage = () => setSession(readSession(address));
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [address]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const aa = balances?.researcher;
  const aaBal = aa?.balance ? BigInt(aa.balance) : null;
  const lowBalance = aaBal !== null && aaBal < 10n ** 17n; // < 0.1 USDC

  const sessionActive =
    session !== null &&
    BigInt(session.intent.validUntil) > BigInt(Math.floor(now / 1000));

  return (
    <div className="px-4 py-3 border-t border-token space-y-2">
      <div className="t-caption flex items-center justify-between">
        <span>Agent state</span>
        {aa ? (
          <span
            className="status-dot"
            style={{
              width: 7,
              height: 7,
              background: lowBalance
                ? "var(--rose-500)"
                : "var(--emerald-500)"
            }}
            title={lowBalance ? "Low balance" : "Healthy"}
          />
        ) : (
          <span
            className="status-dot status-dot--pending"
            style={{ width: 7, height: 7 }}
          />
        )}
      </div>

      <div className="flex items-baseline justify-between">
        <span className="t-small ink-3">Researcher AA</span>
        <span
          className={`t-mono-sm font-semibold ${
            lowBalance ? "text-rose-500" : ""
          }`}
        >
          {aa ? formatUSDC(aa.balance) : "…"}
        </span>
      </div>

      <KitePassPanel />

      {sessionActive && session ? (
        <div className="pt-1 border-t border-token">
          <div className="flex items-center gap-1.5 t-mono-sm">
            <span
              className="status-dot status-dot--done"
              style={{ width: 6, height: 6 }}
            />
            <span className="text-kite-700 font-medium">Local session</span>
          </div>
          <div className="t-mono-sm ink-3 mt-0.5">
            {formatUSDC(session.spentToday)} /{" "}
            {formatUSDC(session.intent.dailyCapUSDC)} today
          </div>
        </div>
      ) : null}
    </div>
  );
}

interface KitePassRule {
  timeWindow: string;
  budget: string;
  amountUsed: string;
  humanLabel: string;
}

interface KitePassInfo {
  configured: boolean;
  address?: string;
  explorer?: string;
  ruleCount?: number;
  rules?: KitePassRule[];
  error?: string;
}

function KitePassPanel() {
  const [info, setInfo] = useState<KitePassInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/kitepass/info", { cache: "no-store" });
        if (!res.ok && res.status !== 502) return;
        const j = (await res.json()) as KitePassInfo;
        if (!cancelled) setInfo(j);
      } catch {
        /* ignore */
      }
    }
    load();
    const t = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  if (!info?.configured || !info.address) {
    return (
      <div className="pt-1 border-t border-token">
        <div className="t-mono-sm ink-3">KitePass not configured</div>
      </div>
    );
  }

  if (info.error || !info.rules) {
    return (
      <div className="pt-1 border-t border-token">
        <div className="flex items-center gap-1.5 t-mono-sm">
          <span
            className="status-dot status-dot--pending"
            style={{ width: 6, height: 6 }}
          />
          <span className="ink-2 font-medium">KitePass · check failed</span>
        </div>
      </div>
    );
  }

  const daily = info.rules.find((r) => r.humanLabel === "daily");
  const perTx = info.rules.find((r) => r.humanLabel === "per-tx");
  const dailyBudget = daily ? BigInt(daily.budget) : 0n;
  const dailyUsed = daily ? BigInt(daily.amountUsed) : 0n;
  const pct =
    dailyBudget > 0n
      ? Number((dailyUsed * 10000n) / dailyBudget) / 100
      : 0;

  return (
    <div className="pt-1 border-t border-token">
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 t-mono-sm">
          <span
            className="status-dot status-dot--done"
            style={{ width: 6, height: 6 }}
          />
          <span className="text-kite-700 font-medium">KitePass on-chain</span>
        </div>
        <a
          href={info.explorer}
          target="_blank"
          rel="noreferrer"
          className="t-mono-sm ink-3 hover:text-kite-500"
        >
          ↗
        </a>
      </div>
      {daily && (
        <>
          <div className="flex items-baseline justify-between mt-1.5">
            <span className="t-mono-sm ink-3">Daily</span>
            <span className="t-mono-sm font-semibold">
              {formatUSDC(daily.amountUsed)} /{" "}
              {formatUSDC(daily.budget)}
            </span>
          </div>
          <div
            className="h-1 mt-1 rounded-full overflow-hidden"
            style={{
              background: "color-mix(in srgb, var(--kite-500) 12%, transparent)"
            }}
          >
            <div
              className="h-full bg-kite-500 transition-all duration-500"
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </div>
        </>
      )}
      {perTx && (
        <div className="flex items-baseline justify-between mt-1.5">
          <span className="t-mono-sm ink-3">Per-tx cap</span>
          <span className="t-mono-sm">{formatUSDC(perTx.budget)}</span>
        </div>
      )}
    </div>
  );
}
