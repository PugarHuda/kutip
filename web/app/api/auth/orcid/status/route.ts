import { NextRequest, NextResponse } from "next/server";
import {
  ORCID_COOKIE_NAME,
  isDemoVerifyAllowed,
  isOrcidOauthEnabled,
  verifyCookie
} from "@/lib/orcid-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const demoVerifyAvailable = isDemoVerifyAllowed();
  if (!isOrcidOauthEnabled()) {
    return NextResponse.json({ enabled: false, demoVerifyAvailable });
  }
  const cookie = verifyCookie(req.cookies.get(ORCID_COOKIE_NAME)?.value);
  return NextResponse.json({
    enabled: true,
    demoVerifyAvailable,
    verifiedOrcid: cookie?.orcid ?? null,
    verifiedViaDemo: cookie?.demo ?? false,
    exp: cookie?.exp ?? null
  });
}
