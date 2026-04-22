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

      {sessionActive && session ? (
        <div className="pt-1 border-t border-token">
          <div className="flex items-center gap-1.5 t-mono-sm">
            <span
              className="status-dot status-dot--done"
              style={{ width: 6, height: 6 }}
            />
            <span className="text-kite-700 font-medium">Passport active</span>
          </div>
          <div className="t-mono-sm ink-3 mt-0.5">
            {formatUSDC(session.spentToday)} /{" "}
            {formatUSDC(session.intent.dailyCapUSDC)} today
          </div>
        </div>
      ) : (
        <div className="pt-1 border-t border-token">
          <div className="t-mono-sm ink-3">No Passport session</div>
          <div className="t-mono-sm ink-3 opacity-60 mt-0.5">
            Sign from /research sidebar
          </div>
        </div>
      )}
    </div>
  );
}
