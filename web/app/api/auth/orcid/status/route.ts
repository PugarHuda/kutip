import { NextRequest, NextResponse } from "next/server";
import {
  ORCID_COOKIE_NAME,
  isOrcidOauthEnabled,
  verifyCookie
} from "@/lib/orcid-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isOrcidOauthEnabled()) {
    return NextResponse.json({ enabled: false });
  }
  const cookie = verifyCookie(req.cookies.get(ORCID_COOKIE_NAME)?.value);
  return NextResponse.json({
    enabled: true,
    verifiedOrcid: cookie?.orcid ?? null,
    exp: cookie?.exp ?? null
  });
}
