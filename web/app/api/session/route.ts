import { NextRequest, NextResponse } from "next/server";
import type { Address } from "viem";
import {
  getSession,
  latestSessionFor,
  revokeSession,
  toDto,
  verifyAndStore,
  type SpendingIntent
} from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function parseIntent(raw: Record<string, unknown>): SpendingIntent {
  const required = [
    "user",
    "agent",
    "maxPerQueryUSDC",
    "dailyCapUSDC",
    "validUntil",
    "nonce",
    "purpose"
  ];
  for (const k of required) {
    if (!(k in raw)) throw new Error(`Missing field: ${k}`);
  }
  return {
    user: raw.user as Address,
    agent: raw.agent as Address,
    maxPerQueryUSDC: BigInt(raw.maxPerQueryUSDC as string | number),
    dailyCapUSDC: BigInt(raw.dailyCapUSDC as string | number),
    validUntil: BigInt(raw.validUntil as string | number),
    nonce: BigInt(raw.nonce as string | number),
    purpose: String(raw.purpose)
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      intent?: Record<string, unknown>;
      signature?: string;
    };
    if (!body.intent || !body.signature?.startsWith("0x")) {
      return NextResponse.json(
        { error: "Body must include { intent, signature }" },
        { status: 400 }
      );
    }
    const intent = parseIntent(body.intent);
    const delegation = await verifyAndStore(intent, body.signature as `0x${string}`);
    return NextResponse.json({ session: toDto(delegation) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown error" },
      { status: 400 }
    );
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const user = searchParams.get("user");

  if (id) {
    const d = getSession(id);
    if (!d) return NextResponse.json({ session: null });
    return NextResponse.json({ session: toDto(d) });
  }

  if (user) {
    const d = latestSessionFor(user as Address);
    if (!d) return NextResponse.json({ session: null });
    return NextResponse.json({ session: toDto(d) });
  }

  return NextResponse.json(
    { error: "Provide either ?id=<sessionId> or ?user=<address>" },
    { status: 400 }
  );
}

export async function DELETE(req: NextRequest) {
  try {
    const body = (await req.json()) as { id?: string; caller?: string };
    if (!body.id || !body.caller?.startsWith("0x")) {
      return NextResponse.json(
        { error: "Body must include { id, caller }" },
        { status: 400 }
      );
    }
    const delegation = revokeSession(body.id, body.caller as Address);
    return NextResponse.json({ session: toDto(delegation) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown error" },
      { status: 400 }
    );
  }
}
