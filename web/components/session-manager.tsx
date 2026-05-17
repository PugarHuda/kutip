"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount, useSignTypedData } from "wagmi";
import { kiteTestnet } from "@/lib/kite";
import { useToast } from "./toast";

const RESEARCHER_AA = (process.env.NEXT_PUBLIC_AGENT_AA_ADDRESS ??
  "0x4da7f4cFd443084027a39cc0f7c41466d9511776") as `0x${string}`;

const DOMAIN = {
  name: "Kutip Agent Passport",
  version: "1",
  chainId: kiteTestnet.id
} as const;

const TYPES = {
  SpendingIntent: [
    { name: "user", type: "address" },
    { name: "agent", type: "address" },
    { name: "maxPerQueryUSDC", type: "uint256" },
    { name: "dailyCapUSDC", type: "uint256" },
    { name: "validUntil", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "purpose", type: "string" }
  ]
} as const;

export interface SessionEnvelope {
  intent: {
    user: `0x${string}`;
    agent: `0x${string}`;
    maxPerQueryUSDC: string;
    dailyCapUSDC: string;
    validUntil: string;
    nonce: string;
    purpose: string;
  };
  signature: `0x${string}`;
  spentToday: string;
  dayAnchor: number;
  createdAt: number;
  id: string;
}

const LS_KEY_PREFIX = "kutip.passport.v1:";

function lsKey(addr: string) {
  return `${LS_KEY_PREFIX}${addr.toLowerCase()}`;
}

function readLocal(addr: string | undefined): SessionEnvelope | null {
  if (!addr || typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(lsKey(addr));
    if (!raw) return null;
    return JSON.parse(raw) as SessionEnvelope;
  } catch {
    return null;
  }
}

function writeLocal(addr: string, env: SessionEnvelope | null) {
  if (typeof window === "undefined") return;
  if (!env) {
    localStorage.removeItem(lsKey(addr));
    return;
  }
  localStorage.setItem(lsKey(addr), JSON.stringify(env));
}

function formatUSDC(raw: string): string {
  const v = BigInt(raw);
  const whole = v / 10n ** 18n;
  const frac = (v % 10n ** 18n).toString().padStart(18, "0").slice(0, 2);
  return `${whole}.${frac}`;
}

function toUnits(amount: string): bigint {
  const n = parseFloat(amount);
  if (!Number.isFinite(n) || n <= 0) return 0n;
  return BigInt(Math.round(n * 100)) * 10n ** 16n;
}

function startOfUtcDay(sec: number): number {
  return sec - (sec % 86_400);
}

function sessionIdFor(intent: SessionEnvelope["intent"], signature: string): string {
  let h = 0n;
  const src = `${intent.user}:${intent.agent}:${intent.nonce}:${signature.slice(0, 18)}`;
  for (let i = 0; i < src.length; i++) {
    h = (h * 131n + BigInt(src.charCodeAt(i))) & 0xffffffffffffffffn;
  }
  return `0x${h.toString(16).padStart(16, "0")}`;
}

export function SessionManager({
  onSessionChange
}: {
  onSessionChange?: (envelope: SessionEnvelope | null) => void;
}) {
  const { address, isConnected } = useAccount();
  const { signTypedDataAsync, isPending: isSigning } = useSignTypedData();
  const toast = useToast();

  const [envelope, setEnvelope] = useState<SessionEnvelope | null>(null);
  const [maxPerQuery, setMaxPerQuery] = useState("2");
  const [dailyCap, setDailyCap] = useState("10");
  const [hours, setHours] = useState("24");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const syncFromStorage = useCallback(() => {
    if (!address) {
      setEnvelope(null);
      return;
    }
    const saved = readLocal(address);
    if (!saved) {
      setEnvelope(null);
      return;
    }
    const now = Math.floor(Date.now() / 1000);
    const today = startOfUtcDay(now);
    if (today > saved.dayAnchor) {
      const rolled: SessionEnvelope = { ...saved, spentToday: "0", dayAnchor: today };
      writeLocal(address, rolled);
      setEnvelope(rolled);
    } else {
      setEnvelope(saved);
    }
  }, [address]);

  useEffect(() => {
    syncFromStorage();
  }, [syncFromStorage]);

  useEffect(() => {
    onSessionChange?.(envelope);
  }, [envelope, onSessionChange]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (e: StorageEvent) => {
      if (e.key?.startsWith(LS_KEY_PREFIX)) syncFromStorage();
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [syncFromStorage]);

  async function createSession() {
    if (!address) return;
    setError(null);
    setBusy(true);

    const maxRaw = toUnits(maxPerQuery);
    const dailyRaw = toUnits(dailyCap);
    const hoursN = Math.max(1, parseInt(hours, 10) || 24);
    const now = Math.floor(Date.now() / 1000);
    const validUntil = BigInt(now + hoursN * 3600);
    const nonce = BigInt(Date.now());

    if (maxRaw <= 0n || dailyRaw <= 0n) {
      setError("Caps must be greater than zero");
      setBusy(false);
      return;
    }
    if (maxRaw > dailyRaw) {
      setError("Per-query cap can't exceed the daily cap");
      setBusy(false);
      return;
    }

    const intent = {
      user: address,
      agent: RESEARCHER_AA,
      maxPerQueryUSDC: maxRaw,
      dailyCapUSDC: dailyRaw,
      validUntil,
      nonce,
      purpose: "Research agent query spending"
    };

    try {
      const signature = await signTypedDataAsync({
        domain: DOMAIN,
        types: TYPES,
        primaryType: "SpendingIntent",
        message: intent
      });

      const intentStr = {
        user: address,
        agent: RESEARCHER_AA,
        maxPerQueryUSDC: maxRaw.toString(),
        dailyCapUSDC: dailyRaw.toString(),
        validUntil: validUntil.toString(),
        nonce: nonce.toString(),
        purpose: intent.purpose
      };
      const env: SessionEnvelope = {
        intent: intentStr,
        signature,
        spentToday: "0",
        dayAnchor: startOfUtcDay(now),
        createdAt: now,
        id: sessionIdFor(intentStr, signature)
      };

      writeLocal(address, env);
      setEnvelope(env);
      toast.push({
        kind: "success",
        message: "Agent Passport delegated",
        detail: `Max ${formatUSDC(maxRaw.toString())} / query · daily cap ${formatUSDC(dailyRaw.toString())} · ${hoursN}h`
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown error");
    } finally {
      setBusy(false);
    }
  }

  function revoke() {
    if (!address) return;
    writeLocal(address, null);
    setEnvelope(null);
    toast.push({
      kind: "info",
      message: "Passport session revoked",
      detail: "The agent can no longer spend on your behalf."
    });
  }

  if (!isConnected) {
    return (
      <div className="mt-5 p-3.5 surface-raised border border-token rounded-[10px]">
        <div className="t-caption mb-1">Agent Passport</div>
        <div className="t-small ink-3">
          Connect your wallet via topnav to delegate a spending budget to the agent.
        </div>
      </div>
    );
  }

  const active =
    envelope && BigInt(envelope.intent.validUntil) > BigInt(Math.floor(Date.now() / 1000));

  if (active && envelope) {
    const cap = BigInt(envelope.intent.dailyCapUSDC);
    const spent = BigInt(envelope.spentToday);
    const pct = cap > 0n ? Number((spent * 10000n) / cap) / 100 : 0;
    const hoursLeft = Math.max(
      0,
      Math.floor(
        (Number(envelope.intent.validUntil) - Math.floor(Date.now() / 1000)) / 3600
      )
    );

    return (
      <div
        className="mt-5 p-3.5 border rounded-[10px]"
        style={{
          borderColor: "color-mix(in srgb, var(--kite-500) 40%, var(--border))",
          background: "color-mix(in srgb, var(--kite-500) 5%, transparent)"
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="status-dot status-dot--done" style={{ width: 8, height: 8 }} />
            <span className="t-caption text-kite-700">Agent Passport · active</span>
          </div>
          <span className="t-mono-sm ink-3">{hoursLeft}h left</span>
        </div>
        <div className="flex justify-between items-baseline mb-1">
          <span className="t-small ink-3">Daily usage</span>
          <span className="t-mono-sm font-semibold">
            {formatUSDC(envelope.spentToday)} / {formatUSDC(envelope.intent.dailyCapUSDC)} USDC
          </span>
        </div>
        <div
          className="h-1.5 rounded-full overflow-hidden"
          style={{ background: "color-mix(in srgb, var(--kite-500) 15%, transparent)" }}
        >
          <div
            className="h-full bg-kite-500 transition-all duration-500"
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
        <div className="flex justify-between items-center mt-2.5">
          <span className="t-mono-sm ink-3">
            Max per query · {formatUSDC(envelope.intent.maxPerQueryUSDC)} USDC
          </span>
          <button
            type="button"
            onClick={revoke}
            disabled={busy}
            className="t-small text-rose-600 hover:text-rose-700 font-medium"
          >
            Revoke
          </button>
        </div>
        <div className="t-mono-sm ink-3 mt-1.5 break-all">Session id {envelope.id}</div>
      </div>
    );
  }

  return (
    <div className="mt-5 p-3.5 surface-raised border border-token rounded-[10px]">
      <div className="t-caption mb-1">Agent Passport — delegate a budget</div>
      <div className="t-small ink-3 mb-3">
        Sign once. The agent can spend within these caps until expiry. Revoke
        anytime.
      </div>

      <div className="grid grid-cols-3 gap-2 mb-2">
        <label className="block">
          <span className="t-mono-sm ink-3">Max/query</span>
          <input
            type="number"
            step="0.1"
            min="0.1"
            value={maxPerQuery}
            onChange={(e) => setMaxPerQuery(e.target.value)}
            className="card w-full h-9 px-2 mt-1 font-mono text-[12px] bg-transparent focus:outline-none focus:border-kite-500"
          />
        </label>
        <label className="block">
          <span className="t-mono-sm ink-3">Daily cap</span>
          <input
            type="number"
            step="1"
            min="0.1"
            value={dailyCap}
            onChange={(e) => setDailyCap(e.target.value)}
            className="card w-full h-9 px-2 mt-1 font-mono text-[12px] bg-transparent focus:outline-none focus:border-kite-500"
          />
        </label>
        <label className="block">
          <span className="t-mono-sm ink-3">Hours</span>
          <input
            type="number"
            step="1"
            min="1"
            max="168"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            className="card w-full h-9 px-2 mt-1 font-mono text-[12px] bg-transparent focus:outline-none focus:border-kite-500"
          />
        </label>
      </div>

      <button
        type="button"
        onClick={createSession}
        disabled={busy || isSigning}
        className="btn btn--primary btn--sm w-full justify-center mt-1"
      >
        {isSigning ? "Awaiting signature…" : busy ? "Storing…" : "Sign delegation"}
      </button>

      {error && <div className="t-small text-rose-500 mt-2">{error}</div>}
    </div>
  );
}

export function updateLocalSpent(addr: string, newSpent: string) {
  const saved = readLocal(addr);
  if (!saved) return;
  saved.spentToday = newSpent;
  writeLocal(addr, saved);
  window.dispatchEvent(new StorageEvent("storage", { key: lsKey(addr) }));
}
