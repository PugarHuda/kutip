import { NextResponse } from "next/server";
import { listSummaries, listMetrics } from "@/lib/summary-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Directory of paywalled summaries — lists every query Kutip has
 * persisted + per-query resale metrics. Useful for the "marketplace"
 * page and to prove the reverse-x402 loop is active.
 */
export async function GET() {
  const summaries = await listSummaries();
  const metrics = listMetrics();
  const totalAccesses = metrics.reduce((s, m) => s + m.accessCount, 0);
  const totalRevenue = metrics.reduce((s, m) => s + m.revenueEarned, 0n);

  return NextResponse.json({
    count: summaries.length,
    totalAccesses,
    totalRevenueUSDC: Number(totalRevenue) / 1e18,
    queryIds: summaries.map((s) => s.queryId),
    metrics: metrics.map((m) => ({
      queryId: m.queryId,
      accessCount: m.accessCount,
      revenueEarnedUSDC: Number(m.revenueEarned) / 1e18,
      lastAccessAt: m.lastAccessAt
    }))
  });
}
