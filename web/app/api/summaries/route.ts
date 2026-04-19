import { NextResponse } from "next/server";
import { listCachedQueryIds, listMetrics } from "@/lib/summary-store";

export const runtime = "nodejs";

/**
 * Directory of paywalled summaries — lists every query Kutip has cached
 * in this instance + per-query resale metrics. Useful for the
 * "marketplace" page and to prove the reverse-x402 loop is active.
 */
export async function GET() {
  const ids = listCachedQueryIds();
  const metrics = listMetrics();
  const totalAccesses = metrics.reduce((s, m) => s + m.accessCount, 0);
  const totalRevenue = metrics.reduce((s, m) => s + m.revenueEarned, 0n);

  return NextResponse.json({
    count: ids.length,
    totalAccesses,
    totalRevenueUSDC: Number(totalRevenue) / 1e18,
    queryIds: ids,
    metrics: metrics.map((m) => ({
      queryId: m.queryId,
      accessCount: m.accessCount,
      revenueEarnedUSDC: Number(m.revenueEarned) / 1e18,
      lastAccessAt: m.lastAccessAt
    }))
  });
}
