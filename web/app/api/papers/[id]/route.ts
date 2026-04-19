import { NextRequest, NextResponse } from "next/server";
import { getPaper } from "@/lib/papers";
import { buildPaymentRequired, decodePaymentHeader, settleWithFacilitator } from "@/lib/x402";

export const runtime = "nodejs";

const DEMO_MERCHANT =
  process.env.NEXT_PUBLIC_AGENT_OPERATOR_ADDRESS ??
  "0x0000000000000000000000000000000000000000";

export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  const paper = getPaper(ctx.params.id);
  if (!paper) return NextResponse.json({ error: "Paper not found" }, { status: 404 });

  const paymentHeader = req.headers.get("x-payment");
  const decoded = decodePaymentHeader(paymentHeader);

  if (!decoded) {
    const challenge = buildPaymentRequired({
      priceUSDC: paper.priceUSDC,
      resource: req.url,
      payTo: DEMO_MERCHANT,
      description: `Access to ${paper.title}`,
      merchantName: "Kutip Paper Store"
    });
    return NextResponse.json(challenge.body, { status: 402 });
  }

  if (process.env.KUTIP_DEMO_MODE === "1") {
    return NextResponse.json({ paper, settled: true, demo: true });
  }

  const settle = await settleWithFacilitator({
    authorization: decoded.authorization,
    signature: decoded.signature,
    network: "kite-testnet"
  });

  if (!settle.success) {
    return NextResponse.json({ error: settle.error }, { status: 402 });
  }

  return NextResponse.json({ paper, settled: true, txHash: settle.txHash });
}
