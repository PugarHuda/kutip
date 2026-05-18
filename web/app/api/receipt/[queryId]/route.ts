import { NextRequest, NextResponse } from "next/server";
import type { Hex } from "viem";
import {
  getCitationsForQuery,
  getLedgerAddress,
  getQueryRecord
} from "@/lib/ledger";
import { loadSummary } from "@/lib/summary-store";
import { formatUSDCPrecise } from "@/lib/kite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QUERY_ID_PATTERN = /^0x[a-fA-F0-9]{64}$/;

/**
 * Downloadable attestation receipt.
 *
 * Bundles the on-chain proof (payer, split, per-author payouts) with the
 * cached research output (query, synthesis, summary digest) into one
 * portable JSON artifact. Backs the "Download JSON" button on /verify —
 * a server route rather than a client blob so the receipt is rebuilt
 * from canonical sources every time and stays correct even cold.
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: { queryId: string } }
) {
  const raw = ctx.params.queryId;
  if (typeof raw !== "string" || !QUERY_ID_PATTERN.test(raw)) {
    return NextResponse.json(
      { error: "Invalid queryId — expected a 32-byte hex hash" },
      { status: 400 }
    );
  }
  const queryId = raw.toLowerCase() as Hex;

  const [record, citations] = await Promise.all([
    getQueryRecord(queryId),
    getCitationsForQuery(queryId)
  ]);

  if (!record) {
    return NextResponse.json(
      { error: "No attestation found on Kite for this queryId" },
      { status: 404 }
    );
  }

  const stored = await loadSummary(queryId);
  const receipt = {
    kind: "kutip-attestation-receipt",
    version: "1.0",
    generatedAt: new Date().toISOString(),
    queryId,
    chain: { name: "Kite testnet", chainId: 2368 },
    contract: getLedgerAddress(),
    attestation: {
      payer: record.payer,
      totalPaidUSDC: formatUSDCPrecise(record.totalPaid),
      authorsShareUSDC: formatUSDCPrecise(record.authorsShare),
      totalPaidRaw: record.totalPaid.toString(),
      authorsShareRaw: record.authorsShare.toString(),
      citationCount: record.citationCount,
      attestedAt: new Date(Number(record.timestamp) * 1000).toISOString()
    },
    payouts: citations.map((c) => ({
      author: c.author,
      weightBps: c.weightBps,
      amountUSDC: formatUSDCPrecise(c.amount),
      amountRaw: c.amount.toString(),
      txHash: c.txHash
    })),
    summary: stored
      ? {
          query: stored.query,
          synthesis: stored.summary,
          summaryHash: stored.summaryHash,
          summaryHashAlgo: "keccak256(utf8(synthesis))",
          savedAt: stored.savedAt
        }
      : {
          note: "Summary text not in warm cache — the on-chain attestation above is still a complete proof of payment."
        }
  };

  return new NextResponse(JSON.stringify(receipt, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="kutip-receipt-${queryId.slice(2, 10)}.json"`
    }
  });
}
