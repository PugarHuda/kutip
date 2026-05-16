import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createPublicClient, http, parseEventLogs, type Hex } from "viem";
import { KITE_TESTNET_USDC, kiteTestnet } from "@/lib/kite";

export const runtime = "nodejs";

const TRANSFER_EVENT_ABI = [
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "value", type: "uint256", indexed: false }
    ]
  }
] as const;

/**
 * Verify a real on-chain x402 payment — no facilitator. The tx must have
 * succeeded and carry a USDT `Transfer` to `payTo` of at least
 * `minAmount` (18-dp wei). The merchant proves the payment itself by
 * reading the Kite chain, so settlement is deterministic and auditable.
 */
async function verifyOnChainPayment(
  txHash: Hex,
  payTo: string,
  minAmount: bigint
): Promise<{ ok: boolean; paid: bigint }> {
  const client = createPublicClient({ chain: kiteTestnet, transport: http() });
  const receipt = await client.getTransactionReceipt({ hash: txHash });
  if (receipt.status !== "success") return { ok: false, paid: 0n };

  const transfers = parseEventLogs({
    abi: TRANSFER_EVENT_ABI,
    eventName: "Transfer",
    logs: receipt.logs.filter(
      (l) => l.address.toLowerCase() === KITE_TESTNET_USDC.toLowerCase()
    )
  });

  let paid = 0n;
  for (const t of transfers) {
    if (t.args.to?.toLowerCase() === payTo.toLowerCase()) {
      paid += t.args.value ?? 0n;
    }
  }
  return { ok: paid >= minAmount, paid };
}

/**
 * Real x402 corpus-access endpoint.
 *
 * The research agent settles a micro-fee here before reading papers — a
 * genuine HTTP 402 → on-chain payment → retry-with-proof handshake. No
 * facilitator: the payment is a plain USDT transfer on Kite, and this
 * route verifies it by reading the chain itself.
 *
 * Try it by hand:
 *   1. POST {queryId} with no header        → 402 + challenge
 *   2. transfer `maxAmountRequired` USDT to `payTo` on Kite
 *   3. POST again with `X-PAYMENT: base64({"txHash":"0x…"})` → 200
 */

// 0.001 USDT (18-dp). A symbolic access fee — the point is a real,
// auditable on-chain settlement, not a large payment.
const PRICE = 1_000_000_000_000_000n;

// Summarizer sub-agent AA — a real, distinct address, so the transfer
// actually moves value (not a self-send).
const PAY_TO = "0xA6C36bA2BC8E84fCF276721F30FC79ceD609ef5c";

// Replay guard — each settlement tx is single-use. In-memory per lambda;
// fine at hackathon scale since every query produces a fresh tx.
const usedTx = new Set<string>();

const Body = z.object({ queryId: z.string().min(3).max(80) });

function challenge(resource: string, error?: string) {
  return {
    x402Version: 1,
    error: error ?? "X-PAYMENT header required",
    accepts: [
      {
        scheme: "exact-onchain",
        network: "kite-testnet",
        maxAmountRequired: PRICE.toString(),
        asset: KITE_TESTNET_USDC,
        payTo: PAY_TO,
        resource,
        description:
          "Kutip corpus access — transfer the amount on Kite, retry with X-PAYMENT: base64({txHash}).",
        maxTimeoutSeconds: 300
      }
    ]
  };
}

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "queryId required" }, { status: 400 });
  }
  const resource = `kutip:corpus:${parsed.data.queryId}`;
  const header = req.headers.get("x-payment");

  // No payment yet → issue the 402 challenge.
  if (!header) {
    return NextResponse.json(challenge(resource), { status: 402 });
  }

  // Decode the proof header → { txHash }.
  let txHash: Hex;
  try {
    const decoded = JSON.parse(
      Buffer.from(header, "base64").toString("utf-8")
    ) as { txHash?: unknown };
    if (typeof decoded.txHash !== "string" || !decoded.txHash.startsWith("0x")) {
      throw new Error("bad txHash");
    }
    txHash = decoded.txHash as Hex;
  } catch {
    return NextResponse.json(
      challenge(resource, "Malformed X-PAYMENT header"),
      { status: 402 }
    );
  }

  if (usedTx.has(txHash.toLowerCase())) {
    return NextResponse.json(
      challenge(resource, "Payment already used for another request"),
      { status: 402 }
    );
  }

  // Verify the payment on-chain — no facilitator, just the Kite RPC.
  let result: { ok: boolean; paid: bigint };
  try {
    result = await verifyOnChainPayment(txHash, PAY_TO, PRICE);
  } catch (err) {
    return NextResponse.json(
      challenge(resource, `Could not verify payment: ${String(err)}`),
      { status: 402 }
    );
  }

  if (!result.ok) {
    return NextResponse.json(
      challenge(
        resource,
        `Payment not found or insufficient (need ${PRICE}, saw ${result.paid})`
      ),
      { status: 402 }
    );
  }

  usedTx.add(txHash.toLowerCase());
  return NextResponse.json({
    settled: true,
    resource,
    txHash,
    paid: result.paid.toString(),
    explorer: `https://testnet.kitescan.ai/tx/${txHash}`
  });
}
