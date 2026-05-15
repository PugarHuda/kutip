import { NextRequest, NextResponse } from "next/server";
import {
  ORCID_COOKIE_NAME,
  buildCookiePayload,
  exchangeCodeForOrcid,
  isOrcidOauthEnabled,
  signCookie
} from "@/lib/orcid-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isOrcidOauthEnabled()) {
    return NextResponse.redirect(new URL("/claim?err=oauth_disabled", req.url));
  }

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const storedState = req.cookies.get("kutip_orcid_state")?.value;
  const storedReturn = req.cookies.get("kutip_orcid_return")?.value;

  if (!code || !state || !storedState || state !== storedState) {
    return NextResponse.redirect(new URL("/claim?err=oauth_state", req.url));
  }

  let returnTo = "/claim";
  let expectedOrcid: string | null = null;
  try {
    if (storedReturn) {
      const parsed = JSON.parse(storedReturn);
      returnTo = parsed.returnTo ?? "/claim";
      expectedOrcid = parsed.expected || null;
    }
  } catch {
    /* ignore */
  }

  try {
    const token = await exchangeCodeForOrcid(code);

    // Reject mismatch: if /claim sent the user into OAuth expecting to
    // bind ORCID X, but the user logged into ORCID Y on orcid.org, do
    // NOT issue a cookie for Y. Forces the user to either restart the
    // flow with their actual ORCID or log out and try again. Without
    // this, a user mid-claim could accidentally bind the wrong identity.
    if (
      expectedOrcid &&
      expectedOrcid.toUpperCase() !== token.orcid.toUpperCase()
    ) {
      const url = new URL(returnTo, req.url);
      url.searchParams.set("err", "oauth_orcid_mismatch");
      url.searchParams.set("expected", expectedOrcid);
      url.searchParams.set("got", token.orcid);
      const mismatchRes = NextResponse.redirect(url);
      mismatchRes.cookies.delete("kutip_orcid_state");
      mismatchRes.cookies.delete("kutip_orcid_return");
      return mismatchRes;
    }

    const payload = buildCookiePayload(token.orcid);
    const signed = signCookie(payload);

    const redirectTarget = new URL(returnTo, req.url);
    redirectTarget.searchParams.set("verified", token.orcid);

    const res = NextResponse.redirect(redirectTarget);
    res.cookies.set(ORCID_COOKIE_NAME, signed, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 30
    });
    res.cookies.delete("kutip_orcid_state");
    res.cookies.delete("kutip_orcid_return");
    return res;
  } catch (err) {
    console.error("[orcid-callback] exchange failed:", err);
    return NextResponse.redirect(new URL("/claim?err=oauth_exchange", req.url));
  }
}
