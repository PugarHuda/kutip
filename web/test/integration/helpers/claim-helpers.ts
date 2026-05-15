import { signCookie, buildCookiePayload } from "@/lib/orcid-oauth";
import { buildClaimMessage as build } from "@/lib/claim-registry";
import type { Address } from "viem";

// Pinned validUntil — distant enough into the future that integration
// tests never trip the server's expiry check (which allows up to 1 hour
// in the future from `now`). Tests pin to ~30min from now so they're
// stable across machines/timezones.
export function defaultValidUntil(): number {
  return Math.floor(Date.now() / 1000) + 1800;
}

export function buildClaimMessage(
  orcid: string,
  wallet: string,
  validUntil: number = defaultValidUntil()
): string {
  return build(orcid, wallet as Address, validUntil);
}

export async function signCookieFor(orcid: string): Promise<string> {
  return signCookie(buildCookiePayload(orcid));
}
