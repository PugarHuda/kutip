import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyMessage, type Address, type Hex } from "viem";
import { buildClaimMessage, listClaims, recordClaim } from "@/lib/claim-registry";
import { listAuthors } from "@/lib/papers";
import { lookupOrcid } from "@/lib/orcid";
import {
  ORCID_COOKIE_NAME,
  isOrcidOauthEnabled,
  verifyCookie
} from "@/lib/orcid-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalize(orcid: string): string {
  return orcid.replace(/\s+/g, "").toUpperCase();
}

const ClaimSchema = z.object({
  orcid: z.string().min(5).max(30),
  wallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  signature: z.string().regex(/^0x[a-fA-F0-9]{130}$/)
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = ClaimSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid payload", detail: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { orcid, wallet, signature } = parsed.data;
  const addr = wallet as Address;
  const normalizedOrcid = normalize(orcid);

  // OAuth gate: if ORCID OAuth is enabled, require a verified cookie
  // whose orcid matches the claimed orcid. This proves the user logged
  // into the actual ORCID account, not just knows the number.
  if (isOrcidOauthEnabled()) {
    const cookie = verifyCookie(req.cookies.get(ORCID_COOKIE_NAME)?.value);
    if (!cookie) {
      return NextResponse.json(
        {
          error: "ORCID ownership not verified",
          hint: "Sign in with ORCID first — click 'Verify via ORCID' on /claim"
        },
        { status: 401 }
      );
    }
    if (normalize(cookie.orcid) !== normalizedOrcid) {
      return NextResponse.json(
        {
          error: "Claimed ORCID does not match the ORCID you signed in with",
          hint: `You signed in as ${cookie.orcid} but tried to claim ${normalizedOrcid}`
        },
        { status: 403 }
      );
    }
  }

  // Dual-track validation: real orcid.org OR local demo catalog.
  const [api, catalog] = await Promise.all([
    lookupOrcid(orcid),
    Promise.resolve(listAuthors().find((a) => a.orcid === orcid))
  ]);

  const resolvedName = api.real ? api.name : catalog?.name;
  const source: "orcid.org" | "catalog" | null = api.real
    ? "orcid.org"
    : catalog
    ? "catalog"
    : null;

  if (!source || !resolvedName) {
    return NextResponse.json(
      {
        error: "ORCID not verifiable",
        hint:
          "ORCID must exist on orcid.org OR match a researcher in the demo catalog. Try 0000-0002-1825-0097 (Josiah Carberry · public test) or a catalog ID like 0000-0001-1234-0001."
      },
      { status: 404 }
    );
  }

  const message = buildClaimMessage(orcid, addr);
  const valid = await verifyMessage({
    address: addr,
    message,
    signature: signature as Hex
  });

  if (!valid) {
    return NextResponse.json({ error: "signature does not match wallet" }, { status: 401 });
  }

  recordClaim({
    orcid,
    wallet: addr,
    signature: signature as Hex,
    signedAt: new Date().toISOString()
  });

  return NextResponse.json({
    ok: true,
    bound: {
      name: resolvedName,
      orcid,
      wallet: addr,
      source,
      biography: api.real ? api.biography : undefined,
      worksCount: api.real ? api.worksCount : undefined
    }
  });
}

export async function GET() {
  return NextResponse.json({ claims: listClaims() });
}
