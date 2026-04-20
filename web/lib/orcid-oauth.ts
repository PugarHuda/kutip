/**
 * ORCID OAuth2 integration — proves the user owns the ORCID account,
 * not just knows its public number.
 *
 * Flow:
 *   1. /api/auth/orcid/authorize redirects to orcid.org/oauth/authorize
 *   2. User logs in to ORCID (optionally creates account)
 *   3. ORCID redirects back to /api/auth/orcid/callback with ?code
 *   4. Server exchanges code for token — response contains user's real ORCID iD
 *   5. Server sets a signed httpOnly cookie marking this ORCID as verified
 *   6. When submitting /api/claim, server checks cookie and enforces match
 *
 * The /authenticate scope is the minimum — just confirms identity.
 * No bio/works read, no write access. Maximum privacy, minimum friction.
 */

import crypto from "node:crypto";

export const ORCID_COOKIE_NAME = "kutip_orcid_verified";
const COOKIE_TTL_SECONDS = 60 * 30; // 30 minutes — long enough to sign + submit

function base() {
  return process.env.ORCID_OAUTH_BASE ?? "https://orcid.org";
}

export function orcidAuthorizeUrl(state: string): string {
  const clientId = process.env.ORCID_CLIENT_ID;
  const redirectUri = redirectUrl();
  if (!clientId) throw new Error("ORCID_CLIENT_ID not configured");

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    scope: "/authenticate",
    redirect_uri: redirectUri,
    state
  });
  return `${base()}/oauth/authorize?${params.toString()}`;
}

export function redirectUrl(): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return `${site.replace(/\/$/, "")}/api/auth/orcid/callback`;
}

export function isOrcidOauthEnabled(): boolean {
  return Boolean(process.env.ORCID_CLIENT_ID && process.env.ORCID_CLIENT_SECRET);
}

export interface OrcidTokenResponse {
  access_token: string;
  token_type: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  name?: string;
  orcid: string;
}

export async function exchangeCodeForOrcid(code: string): Promise<OrcidTokenResponse> {
  const body = new URLSearchParams({
    client_id: process.env.ORCID_CLIENT_ID ?? "",
    client_secret: process.env.ORCID_CLIENT_SECRET ?? "",
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUrl()
  });

  const res = await fetch(`${base()}/oauth/token`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ORCID token exchange failed: ${res.status} ${text.slice(0, 200)}`);
  }
  return (await res.json()) as OrcidTokenResponse;
}

// --- cookie signing -------------------------------------------------

function secret(): string {
  const s = process.env.ORCID_COOKIE_SECRET;
  if (!s || s.length < 16) {
    throw new Error("ORCID_COOKIE_SECRET must be set (min 16 chars)");
  }
  return s;
}

export interface OrcidCookiePayload {
  orcid: string;
  exp: number;
}

export function signCookie(payload: OrcidCookiePayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyCookie(value: string | undefined): OrcidCookiePayload | null {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expected = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as OrcidCookiePayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function buildCookiePayload(orcid: string): OrcidCookiePayload {
  return {
    orcid,
    exp: Math.floor(Date.now() / 1000) + COOKIE_TTL_SECONDS
  };
}
