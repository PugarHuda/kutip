/**
 * Author claim registry — maps ORCID → claimed wallet address.
 *
 * Persistence path (on-chain):
 *   1. User proves ORCID via OAuth (see /lib/orcid-oauth.ts)
 *   2. User signs EIP-191 message binding ORCID to their wallet
 *   3. Operator relays the binding to NameRegistry.sol on Kite testnet
 *      via bindOnChain() → permanent + auditable
 *   4. lookupClaim() reads from contract first, falls back to in-memory
 *      Map for warm cache (and for the dev/no-contract flow)
 *
 * Why both layers:
 *   - On-chain is authoritative and survives Lambda cold-starts
 *   - In-memory is ~100x faster for the attestation hot path (read-per-
 *     citation during flattenCitationsForContract)
 *
 * Read-through pattern: cache miss → RPC → populate cache → return.
 */

import { ethers } from "ethers";
import {
  keccak256,
  toBytes,
  encodeFunctionData,
  type Address,
  type Hex
} from "viem";
import { getPublicClient } from "./ledger";
import { isAAEnabled, sendBatchUserOp } from "./agent-passport";

export interface AuthorClaim {
  orcid: string;
  wallet: Address;
  signedAt: string;
  signature: Hex;
}

const globalKey = "__KUTIP_CLAIMS__";
type GlobalWithClaims = typeof globalThis & {
  [globalKey]?: Map<string, AuthorClaim>;
};

function cache(): Map<string, AuthorClaim> {
  const g = globalThis as GlobalWithClaims;
  if (!g[globalKey]) g[globalKey] = new Map<string, AuthorClaim>();
  return g[globalKey]!;
}

export function normalizeOrcid(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}

export function buildClaimMessage(orcid: string, wallet: Address): string {
  return `Kutip claim\n\nI verify that I, ORCID ${normalizeOrcid(orcid)}, own wallet ${wallet.toLowerCase()}.\n\nThis binding controls future USDC payouts from the Kutip attribution ledger.`;
}

export function orcidHash(orcid: string): Hex {
  return keccak256(toBytes(normalizeOrcid(orcid)));
}

export function getNameRegistryAddress(): Address | null {
  const a =
    process.env.NEXT_PUBLIC_NAME_REGISTRY ?? process.env.KUTIP_NAME_REGISTRY;
  return a && a.startsWith("0x") ? (a as Address) : null;
}

export function isOnChainClaimEnabled(): boolean {
  return getNameRegistryAddress() !== null;
}

const nameRegistryAbi = [
  {
    type: "function",
    name: "bind",
    stateMutability: "nonpayable",
    inputs: [
      { name: "orcidHash", type: "bytes32" },
      { name: "wallet", type: "address" },
      { name: "signature", type: "bytes" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "walletOf",
    stateMutability: "view",
    inputs: [{ name: "orcidHash", type: "bytes32" }],
    outputs: [{ name: "", type: "address" }]
  },
  {
    type: "function",
    name: "isBound",
    stateMutability: "view",
    inputs: [{ name: "orcidHash", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }]
  },
  {
    type: "function",
    name: "bindings",
    stateMutability: "view",
    inputs: [{ name: "", type: "bytes32" }],
    outputs: [
      { name: "wallet", type: "address" },
      { name: "signedAt", type: "uint64" },
      { name: "signature", type: "bytes" }
    ]
  }
] as const;

/**
 * Read a binding from chain. Returns null if not bound.
 * Populates cache as a side effect.
 */
export async function readBindingFromChain(
  orcid: string
): Promise<AuthorClaim | null> {
  const addr = getNameRegistryAddress();
  if (!addr) return null;
  try {
    const h = orcidHash(orcid);
    const binding = (await getPublicClient().readContract({
      address: addr,
      abi: nameRegistryAbi,
      functionName: "bindings",
      args: [h]
    })) as readonly [Address, bigint, Hex];
    const [wallet, signedAt, signature] = binding;
    if (wallet === "0x0000000000000000000000000000000000000000") return null;
    const claim: AuthorClaim = {
      orcid: normalizeOrcid(orcid),
      wallet,
      signedAt: new Date(Number(signedAt) * 1000).toISOString(),
      signature
    };
    cache().set(normalizeOrcid(orcid), claim);
    return claim;
  } catch (err) {
    console.warn("[name-registry] read failed:", err);
    return null;
  }
}

/**
 * Write a binding on-chain via operator AA (gasless for the user).
 * Falls back to direct EOA call if AA is disabled.
 */
export async function bindOnChain(claim: AuthorClaim): Promise<Hex | null> {
  const addr = getNameRegistryAddress();
  if (!addr) return null;

  const h = orcidHash(claim.orcid);
  const data = encodeFunctionData({
    abi: nameRegistryAbi,
    functionName: "bind",
    args: [h, claim.wallet, claim.signature]
  });

  if (isAAEnabled()) {
    try {
      const { txHash } = await sendBatchUserOp([
        { target: addr, value: 0n, data }
      ]);
      return txHash;
    } catch (err) {
      console.warn("[name-registry] AA bind failed, trying EOA:", err);
    }
  }

  // EOA fallback
  const pk = process.env.PRIVATE_KEY;
  if (!pk?.startsWith("0x")) return null;
  try {
    const provider = new ethers.JsonRpcProvider(
      process.env.KITE_RPC_URL ?? "https://rpc-testnet.gokite.ai/",
      { chainId: 2368, name: "kite-testnet" }
    );
    const wallet = new ethers.Wallet(pk, provider);
    const tx = await wallet.sendTransaction({ to: addr, data });
    await tx.wait();
    return tx.hash as Hex;
  } catch (err) {
    console.warn("[name-registry] EOA bind failed:", err);
    return null;
  }
}

export function recordClaim(claim: AuthorClaim) {
  cache().set(normalizeOrcid(claim.orcid), claim);
}

export function lookupClaim(orcid: string): AuthorClaim | undefined {
  return cache().get(normalizeOrcid(orcid));
}

export function listClaims(): AuthorClaim[] {
  return Array.from(cache().values()).sort((a, b) =>
    a.signedAt > b.signedAt ? -1 : 1
  );
}

/**
 * Warm the claim cache by reading all bindings for the given ORCIDs
 * from chain in parallel. Call once at the start of a query so subsequent
 * synchronous lookupClaim()s are hot.
 */
export async function warmClaimCache(orcids: string[]): Promise<void> {
  const addr = getNameRegistryAddress();
  if (!addr) return;
  const unique = Array.from(new Set(orcids.map(normalizeOrcid))).filter(
    (o) => !cache().has(o)
  );
  if (unique.length === 0) return;
  await Promise.all(unique.map((o) => readBindingFromChain(o).catch(() => null)));
}

export function resolveWalletForOrcid(
  orcid: string | undefined,
  fallback: Address
): Address {
  if (!orcid) return fallback;
  const claim = lookupClaim(orcid);
  return claim ? claim.wallet : fallback;
}
