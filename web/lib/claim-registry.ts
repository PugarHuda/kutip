/**
 * Author claim registry — maps ORCID → claimed wallet address.
 *
 * Production path: on-chain NameRegistry contract (KYC'd ORCID resolvers
 * issue signed claims). For the hackathon demo we keep it in a per-process
 * global Map so judges can test the flow without setting up persistence.
 *
 * Warm Vercel instances share this map; cold starts reset it, which is fine —
 * attestations past their moment are still viewable from chain events.
 */

import type { Address } from "viem";

export interface AuthorClaim {
  orcid: string;
  wallet: Address;
  signedAt: string;
  signature: `0x${string}`;
}

const globalKey = "__KUTIP_CLAIMS__";
type GlobalWithClaims = typeof globalThis & {
  [globalKey]?: Map<string, AuthorClaim>;
};

function store(): Map<string, AuthorClaim> {
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

export function recordClaim(claim: AuthorClaim) {
  store().set(normalizeOrcid(claim.orcid), claim);
}

export function lookupClaim(orcid: string): AuthorClaim | undefined {
  return store().get(normalizeOrcid(orcid));
}

export function listClaims(): AuthorClaim[] {
  return Array.from(store().values()).sort((a, b) =>
    a.signedAt > b.signedAt ? -1 : 1
  );
}

/** Resolve an author's effective wallet — claim overrides the mock wallet. */
export function resolveWalletForOrcid(
  orcid: string | undefined,
  fallback: Address
): Address {
  if (!orcid) return fallback;
  const claim = lookupClaim(orcid);
  return claim ? claim.wallet : fallback;
}
