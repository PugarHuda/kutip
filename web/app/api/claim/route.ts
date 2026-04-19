import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyMessage, type Address, type Hex } from "viem";
import { buildClaimMessage, listClaims, recordClaim } from "@/lib/claim-registry";
import { listAuthors } from "@/lib/papers";
import { lookupOrcid } from "@/lib/orcid";

export const runtime = "nodejs";

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
