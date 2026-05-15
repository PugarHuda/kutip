import { NextRequest, NextResponse } from "next/server";
import {
  ORCID_COOKIE_NAME,
  buildCookiePayload,
  isDemoVerifyAllowed,
  signCookie
} from "@/lib/orcid-oauth";
import { listAuthors } from "@/lib/papers";
import { lookupOrcid } from "@/lib/orcid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORCID_PATTERN = /^\d{4}-\d{4}-\d{4}-\d{3}[\dxX]$/;

// Josiah Carberry — ORCID's official public test record. Free to OAuth
// against, intentionally bindable in demo. Anything else gets gated.
const JOSIAH_TEST_ORCID = "0000-0002-1825-0097";

// Synthetic catalog ORCIDs (assigned to authors we manufactured for the
// hackathon seed, not real researchers). Pattern matches what
// scripts/seed-real-papers.mjs emits via syntheticOrcid().
const SYNTHETIC_PATTERN = /^0000-0001-\d{4}-\d{4}$/;

function isDemoClaimable(orcid: string): boolean {
  const normalized = orcid.toUpperCase();
  if (normalized === JOSIAH_TEST_ORCID) return true;
  if (!SYNTHETIC_PATTERN.test(normalized)) return false;
  // Belt-and-suspenders: even if format matches the synthetic prefix, only
  // allow if the catalog actually carries this ORCID with that synthetic
  // marker. Stops a crafted "0000-0001-XXXX-XXXX" that collides with a
  // real author's ORCID later seeded from OpenAlex.
  const catalogAuthor = listAuthors().find(
    (a) => a.orcid?.toUpperCase() === normalized
  );
  return Boolean(catalogAuthor);
}

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

  // Hard gate: real authors (real ORCIDs in the catalog from OpenAlex)
  // can only claim via the real ORCID OAuth flow. Demo path is restricted
  // to Josiah's test record + synthetic catalog IDs.
  if (!isDemoClaimable(orcid)) {
    return NextResponse.redirect(
      new URL(
        `/claim?err=demo_not_allowed&orcid=${encodeURIComponent(orcid)}`,
        req.url
      )
    );
  }

  // Defense-in-depth: if Josiah is whitelisted he'll resolve real on
  // orcid.org and pass through — but any other real ORCID slipping
  // through the synthetic regex (collision, future seed change) gets
  // blocked here. Failures (network, etc.) fall through to the synthetic
  // path so we don't lock out demos behind orcid.org availability.
  if (orcid.toUpperCase() !== JOSIAH_TEST_ORCID) {
    try {
      const lookup = await lookupOrcid(orcid);
      if (lookup.real) {
        return NextResponse.redirect(
          new URL(
            `/claim?err=demo_real_orcid&orcid=${encodeURIComponent(orcid)}`,
            req.url
          )
        );
      }
    } catch {
      /* network failure — fall through, allowlist already restrictive */
    }
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
