import { NextRequest, NextResponse } from "next/server";
import {
  ORCID_COOKIE_NAME,
  buildCookiePayload,
  isDemoVerifyAllowed,
  signCookie
} from "@/lib/orcid-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORCID_PATTERN = /^\d{4}-\d{4}-\d{4}-\d{3}[\dxX]$/;

export async function GET(req: NextRequest) {
  if (!isDemoVerifyAllowed()) {
    return NextResponse.redirect(
      new URL("/claim?err=demo_disabled", req.url)
    );
  }

  const orcid = req.nextUrl.searchParams.get("orcid")?.trim();
  const returnTo = req.nextUrl.searchParams.get("returnTo") ?? "/claim";

  if (!orcid || !ORCID_PATTERN.test(orcid)) {
    return NextResponse.redirect(
      new URL("/claim?err=demo_bad_orcid", req.url)
    );
  }

  const payload = { ...buildCookiePayload(orcid), demo: true };
  const signed = signCookie(payload);

  const target = new URL(returnTo, req.url);
  target.searchParams.set("verified", orcid);
  target.searchParams.set("demo", "1");

  const res = NextResponse.redirect(target);
  res.cookies.set(ORCID_COOKIE_NAME, signed, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 30
  });
  return res;
}
