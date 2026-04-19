import { NextRequest, NextResponse } from "next/server";
import {
  loadSummary,
  recordAccess,
  getAccessMetrics
} from "@/lib/summary-store";
import { buildPaymentRequired, decodePaymentHeader, settleWithFacilitator } from "@/lib/x402";

export const runtime = "nodejs";

const RESALE_PRICE_USDC_MICRO = "100000000000000000"; // 0.1 Test USD (18-dec)

/**
 * Reverse x402 — Kutip becomes a paywalled source for OTHER agents.
 *
 * First hit without X-PAYMENT → 402 with gokite-aa terms.
 * Second hit with valid X-PAYMENT → Pieverse verifies + settles →
 * summary delivered + access counter updated.
 *
 * Narrative: an agent that earns from agents that cite it. Closes the
 * recursive loop so Kutip is both consumer (pays authors) and
 * producer (earns from downstream agents), proving the agentic
 * economy doesn't dead-end at humans.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: { queryId: string } }
) {
  const raw = ctx.params.queryId;
  const queryId = raw.toLowerCase();

  const stored = loadSummary(queryId);
  if (!stored) {
    return NextResponse.json(
      {
        error: "Summary not in cache",
        hint: "Cache resets on Vercel cold start. Run the query again to warm it, or in production store summaries on IPFS."
      },
      { status: 404 }
    );
  }

  const paymentHeader = req.headers.get("x-payment");
  const decoded = decodePaymentHeader(paymentHeader);

  if (!decoded) {
    const challenge = buildPaymentRequired({
      priceUSDC: Number(RESALE_PRICE_USDC_MICRO),
      resource: req.url,
      payTo:
        process.env.NEXT_PUBLIC_AGENT_OPERATOR_ADDRESS ??
        "0x0000000000000000000000000000000000000000",
      description: `Kutip summary · ${stored.query.slice(0, 60)}`,
      merchantName: "Kutip Research Agent"
    });
    return NextResponse.json(
      {
        ...challenge.body,
        metadata: {
          queryId: stored.queryId,
          citationCount: stored.citations.length,
          firstAttested: stored.savedAt
        }
      },
      { status: 402 }
    );
  }

  // Demo-mode short-circuit — settle via Pieverse would require gokite-aa
  // payload signing which Kite's token stack hasn't published yet.
  if (process.env.KUTIP_DEMO_MODE === "1") {
    recordAccess(queryId, BigInt(RESALE_PRICE_USDC_MICRO));
    const metrics = getAccessMetrics(queryId);
    return NextResponse.json({
      ...stored,
      paywall: {
        priceMicroUSDC: RESALE_PRICE_USDC_MICRO,
        settled: true,
        mode: "demo",
        accessCount: metrics?.accessCount,
        revenueEarnedUSDC: metrics
          ? Number(metrics.revenueEarned) / 1e18
          : 0
      }
    });
  }

  const settle = await settleWithFacilitator({
    authorization: decoded.authorization,
    signature: decoded.signature,
    network: "kite-testnet"
  });

  if (!settle.success) {
    return NextResponse.json(
      { error: settle.error ?? "Pieverse settlement failed" },
      { status: 402 }
    );
  }

  recordAccess(queryId, BigInt(RESALE_PRICE_USDC_MICRO));
  const metrics = getAccessMetrics(queryId);
  return NextResponse.json({
    ...stored,
    paywall: {
      priceMicroUSDC: RESALE_PRICE_USDC_MICRO,
      settled: true,
      mode: "pieverse",
      txHash: settle.txHash,
      accessCount: metrics?.accessCount,
      revenueEarnedUSDC: metrics
        ? Number(metrics.revenueEarned) / 1e18
        : 0
    }
  });
}
