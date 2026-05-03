import { signCookie, buildCookiePayload } from "@/lib/orcid-oauth";
import { buildClaimMessage as build } from "@/lib/claim-registry";
import type { Address } from "viem";

export function buildClaimMessage(orcid: string, wallet: string): string {
  return build(orcid, wallet as Address);
}

export async function signCookieFor(orcid: string): Promise<string> {
  return signCookie(buildCookiePayload(orcid));
}
