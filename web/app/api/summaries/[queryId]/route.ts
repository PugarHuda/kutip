import { NextRequest, NextResponse } from "next/server";
import {
  loadSummary,
  recordAccess,
  getAccessMetrics
} from "@/lib/summary-store";
import { buildPaymentRequired, decodePaymentHeader, settleWithFacilitator } from "@/lib/x402";
import { fetchAttestationByQueryId } from "@/lib/goldsky";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  // Cache-miss fallback: if the query exists on-chain (subgraph), serve a
  // metadata-only 402 challenge. Full summary text lives in the warm
  // Lambda cache or (in production) IPFS. Demo still proves the protocol.
  let onchainMeta: {
    queryId: string;
    citationCount: number;
    firstAttested: string;
    totalPaid: string;
  } | null = null;
  if (!stored) {
    try {
      const att = await fetchAttestationByQueryId(queryId);
      if (att) {
        onchainMeta = {
          queryId: att.id,
          citationCount: att.citationCount,
          firstAttested: new Date(Number(att.timestamp) * 1000).toISOString(),
          totalPaid: att.totalPaid
        };
      }
    } catch {
      /* subgraph unavailable — fall through to 404 */
    }
    if (!onchainMeta) {
      return NextResponse.json(
        {
          error: "Unknown queryId",
          hint: "No matching attestation on Kite. Check queryId or run a new query."
        },
        { status: 404 }
      );
    }
  }

  const paymentHeader = req.headers.get("x-payment");
  const decoded = decodePaymentHeader(paymentHeader);

  const description = stored
    ? `Kutip summary · ${stored.query.slice(0, 60)}`
    : `Kutip summary · queryId ${queryId.slice(0, 14)}…`;

  if (!decoded) {
    const challenge = buildPaymentRequired({
      priceUSDC: Number(RESALE_PRICE_USDC_MICRO),
      resource: req.url,
      payTo:
        process.env.NEXT_PUBLIC_AGENT_OPERATOR_ADDRESS ??
        "0x0000000000000000000000000000000000000000",
      description,
      merchantName: "Kutip Research Agent"
    });
    return NextResponse.json(
      {
        ...challenge.body,
        metadata: stored
          ? {
              queryId: stored.queryId,
              citationCount: stored.citations.length,
              firstAttested: stored.savedAt,
              warmCache: true
            }
          : { ...onchainMeta!, warmCache: false }
      },
      { status: 402 }
    );
  }

  // Payment header provided — proceed to settle.
  // If cache is cold, we can charge but only deliver metadata.
  if (!stored) {
    if (process.env.KUTIP_DEMO_MODE === "1") {
      recordAccess(queryId, BigInt(RESALE_PRICE_USDC_MICRO));
      return NextResponse.json({
        queryId: onchainMeta!.queryId,
        metadataOnly: true,
        onchainMeta,
        paywall: {
          priceMicroUSDC: RESALE_PRICE_USDC_MICRO,
          settled: true,
          mode: "demo-cold-cache",
          note: "Summary text lives in warm Lambda cache. Full content would be IPFS-pinned in production."
        }
      });
    }
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
