import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyMessage, type Address, type Hex } from "viem";
import { buildClaimMessage, listClaims, recordClaim } from "@/lib/claim-registry";
import { listAuthors } from "@/lib/papers";

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
  const authors = listAuthors();
  const matching = authors.find((a) => a.orcid === orcid);

  if (!matching) {
    return NextResponse.json(
      {
        error: "ORCID not in catalog",
        hint: "Demo only recognises ORCIDs from data/authors.json — try 0000-0001-1234-0001 (Dr. Sarah Chen)"
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
    bound: { name: matching.name, orcid, wallet: addr }
  });
}

export async function GET() {
  return NextResponse.json({ claims: listClaims() });
}
