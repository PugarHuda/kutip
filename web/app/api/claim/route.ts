import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyMessage, type Address, type Hex } from "viem";
import {
  bindOnChain,
  buildClaimMessage,
  isOnChainClaimEnabled,
  listClaims,
  readBindingFromChain,
  recordClaim
} from "@/lib/claim-registry";
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
  signature: z.string().regex(/^0x[a-fA-F0-9]{130}$/),
  // Required so the server can deterministically reconstruct the signed
  // message. Client emits Math.floor(Date.now()/1000)+600 by default.
  validUntil: z.number().int().positive()
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

  const { orcid, wallet, signature, validUntil } = parsed.data;
  const addr = wallet as Address;
  const normalizedOrcid = normalize(orcid);

  // Reject obviously stale or far-future signatures.
  const now = Math.floor(Date.now() / 1000);
  if (validUntil < now - 15) {
    return NextResponse.json(
      {
        error: "Claim signature expired",
        hint: "Re-sign the binding — signatures are valid for 10 minutes."
      },
      { status: 400 }
    );
  }
  if (validUntil > now + 3600) {
    // 1-hour ceiling — stops a long-window pre-signed bomb.
    return NextResponse.json(
      { error: "Claim signature validity window too long (max 1 hour)" },
      { status: 400 }
    );
  }

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

  const message = buildClaimMessage(orcid, addr, validUntil);
  const valid = await verifyMessage({
    address: addr,
    message,
    signature: signature as Hex
  });

  if (!valid) {
    return NextResponse.json({ error: "signature does not match wallet" }, { status: 401 });
  }

  // Pre-bind on-chain conflict check. NameRegistry is first-write-wins;
  // if the ORCID is already bound to a different wallet on-chain, refuse
  // immediately and do NOT poison the in-memory cache. This blocks the
  // attack where an attacker who can't write on-chain still poisons the
  // cache for the citation hot path.
  if (isOnChainClaimEnabled()) {
    const existing = await readBindingFromChain(orcid);
    if (existing && existing.wallet.toLowerCase() !== addr.toLowerCase()) {
      return NextResponse.json(
        {
          error: "ORCID already bound to a different wallet",
          hint: `Existing binding: ${existing.wallet}. If this is your wallet, sign with that one.`
        },
        { status: 409 }
      );
    }
  }

  const claim = {
    orcid,
    wallet: addr,
    signature: signature as Hex,
    signedAt: new Date().toISOString()
  };

  // Persist on-chain via operator AA. Cache only AFTER on-chain succeeds,
  // so a revert (e.g. AlreadyBound race) doesn't poison the citation
  // hot path with a binding the on-chain truth contradicts.
  let bindTx: string | undefined;
  if (isOnChainClaimEnabled()) {
    try {
      const h = await bindOnChain(claim);
      bindTx = h ?? undefined;
    } catch (err) {
      console.warn("[claim] on-chain persist failed, cached only:", err);
    }
  }
  recordClaim(claim);

  return NextResponse.json({
    ok: true,
    bound: {
      name: resolvedName,
      orcid,
      wallet: addr,
      source,
      biography: api.real ? api.biography : undefined,
      worksCount: api.real ? api.worksCount : undefined,
      bindTx,
      onChain: Boolean(bindTx)
    }
  });
}

export async function GET() {
  // Strip signatures from the public response — the ORCID+wallet binding
  // is meant to be public (it's literally on-chain), but the signature
  // bytes are not needed by any UI consumer and exposing them invites
  // cross-deployment replay (the EIP-191 message has no chainId).
  const claims = listClaims().map(({ signature: _omit, ...rest }) => rest);
  return NextResponse.json({ claims });
}
