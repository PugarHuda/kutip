import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { isOrcidOauthEnabled, orcidAuthorizeUrl } from "@/lib/orcid-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isOrcidOauthEnabled()) {
    return NextResponse.json(
      { error: "ORCID OAuth not configured — set ORCID_CLIENT_ID and ORCID_CLIENT_SECRET" },
      { status: 503 }
    );
  }

  const expectedOrcid = req.nextUrl.searchParams.get("orcid") ?? "";
  const returnTo = req.nextUrl.searchParams.get("returnTo") ?? "/claim";
  const state = crypto.randomBytes(16).toString("hex");

  const res = NextResponse.redirect(orcidAuthorizeUrl(state));
  res.cookies.set("kutip_orcid_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600
  });
  res.cookies.set(
    "kutip_orcid_return",
    JSON.stringify({ returnTo, expected: expectedOrcid }),
    {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 600
    }
  );
  return res;
}
