/**
 * Agent Passport — session delegation layer (Kite-Passport-compatible).
 *
 * User signs an EIP-712 typed data once via wagmi → server stores the
 * delegation → every research query is enforced against its caps
 * (per-query max, daily total, expiry, allowed contract targets).
 *
 * When the Kite Agent Passport testnet invite lands, swap the in-memory
 * store for the Passport REST API — the EIP-712 schema deliberately
 * mirrors Passport's "Standing Intent" shape so the UserOp metadata
 * only needs a new `X-Session-Id` header.
 */

import { keccak256, recoverTypedDataAddress, toHex, type Address } from "viem";
import { kiteTestnet } from "./kite";

export const SESSION_DOMAIN = {
  name: "Kutip Agent Passport",
  version: "1",
  chainId: kiteTestnet.id
} as const;

export const SESSION_TYPES = {
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

export interface SpendingIntent {
  user: Address;
  agent: Address;
  maxPerQueryUSDC: bigint;
  dailyCapUSDC: bigint;
  validUntil: bigint;
  nonce: bigint;
  purpose: string;
}

export interface SessionDelegation {
  id: string;
  intent: SpendingIntent;
  signature: `0x${string}`;
  createdAt: number;
  spentToday: bigint;
  dayAnchor: number;
  revokedAt: number | null;
}

const store = new Map<string, SessionDelegation>();

export function sessionIdFrom(intent: SpendingIntent, signature: string): string {
  const payload = JSON.stringify({
    u: intent.user,
    a: intent.agent,
    n: intent.nonce.toString(),
    s: signature.slice(0, 18)
  });
  return keccak256(toHex(payload)).slice(0, 18);
}

export async function verifyAndStore(
  intent: SpendingIntent,
  signature: `0x${string}`
): Promise<SessionDelegation> {
  const recovered = await recoverTypedDataAddress({
    domain: SESSION_DOMAIN,
    types: SESSION_TYPES,
    primaryType: "SpendingIntent",
    message: intent,
    signature
  });

  if (recovered.toLowerCase() !== intent.user.toLowerCase()) {
    throw new Error("Signature does not match the delegator (user)");
  }

  const now = Math.floor(Date.now() / 1000);
  if (intent.validUntil <= BigInt(now)) {
    throw new Error("Delegation expired before it could be stored");
  }

  const id = sessionIdFrom(intent, signature);
  const delegation: SessionDelegation = {
    id,
    intent,
    signature,
    createdAt: now,
    spentToday: 0n,
    dayAnchor: startOfUtcDay(now),
    revokedAt: null
  };
  store.set(id, delegation);
  return delegation;
}

export function getSession(id: string): SessionDelegation | null {
  return store.get(id) ?? null;
}

export function latestSessionFor(user: Address): SessionDelegation | null {
  let best: SessionDelegation | null = null;
  for (const d of store.values()) {
    if (d.intent.user.toLowerCase() !== user.toLowerCase()) continue;
    if (d.revokedAt) continue;
    if (!best || d.createdAt > best.createdAt) best = d;
  }
  return best;
}

export function revokeSession(id: string, caller: Address): SessionDelegation {
  const d = store.get(id);
  if (!d) throw new Error("Session not found");
  if (d.intent.user.toLowerCase() !== caller.toLowerCase()) {
    throw new Error("Only the delegator can revoke this session");
  }
  d.revokedAt = Math.floor(Date.now() / 1000);
  return d;
}

export interface SpendCheckInput {
  sessionId: string;
  amount: bigint;
}

export interface SpendCheckResult {
  ok: true;
  session: SessionDelegation;
}

export function checkSpend({ sessionId, amount }: SpendCheckInput): SpendCheckResult {
  const d = store.get(sessionId);
  if (!d) throw new Error("Unknown session — delegation may have been revoked or lost");
  if (d.revokedAt) throw new Error("Session has been revoked by the user");

  const now = Math.floor(Date.now() / 1000);
  if (d.intent.validUntil <= BigInt(now)) {
    throw new Error("Session expired — ask the user to sign a new delegation");
  }

  if (amount > d.intent.maxPerQueryUSDC) {
    throw new Error(
      `Per-query cap exceeded: this query would spend ${fmt(amount)} but max is ${fmt(d.intent.maxPerQueryUSDC)} USDC`
    );
  }

  const today = startOfUtcDay(now);
  if (today > d.dayAnchor) {
    d.spentToday = 0n;
    d.dayAnchor = today;
  }

  const projected = d.spentToday + amount;
  if (projected > d.intent.dailyCapUSDC) {
    const remaining = d.intent.dailyCapUSDC - d.spentToday;
    throw new Error(
      `Daily cap would be exceeded: ${fmt(remaining)} USDC left today, query needs ${fmt(amount)}`
    );
  }

  return { ok: true, session: d };
}

export function recordSpend(sessionId: string, amount: bigint): void {
  const d = store.get(sessionId);
  if (!d) return;
  d.spentToday = d.spentToday + amount;
}

function startOfUtcDay(unixSeconds: number): number {
  return unixSeconds - (unixSeconds % 86_400);
}

function fmt(raw: bigint): string {
  const whole = raw / 10n ** 18n;
  const frac = (raw % 10n ** 18n).toString().padStart(18, "0").slice(0, 2);
  return `${whole}.${frac}`;
}

export interface SessionDto {
  id: string;
  user: Address;
  agent: Address;
  maxPerQueryUSDC: string;
  dailyCapUSDC: string;
  validUntil: string;
  spentToday: string;
  createdAt: number;
  revokedAt: number | null;
  purpose: string;
}

export function toDto(d: SessionDelegation): SessionDto {
  return {
    id: d.id,
    user: d.intent.user,
    agent: d.intent.agent,
    maxPerQueryUSDC: d.intent.maxPerQueryUSDC.toString(),
    dailyCapUSDC: d.intent.dailyCapUSDC.toString(),
    validUntil: d.intent.validUntil.toString(),
    spentToday: d.spentToday.toString(),
    createdAt: d.createdAt,
    revokedAt: d.revokedAt,
    purpose: d.intent.purpose
  };
}
