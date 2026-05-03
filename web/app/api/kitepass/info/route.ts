import { NextResponse } from "next/server";
import type { Address } from "viem";
import { viewSpendingRules } from "@/lib/kitepass";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 15;

/**
 * Live KitePass vault state — rules + usage straight from chain.
 * Drives the AgentStateFooter sidebar widget and the receipt badge.
 */
export async function GET() {
  const address = (process.env.KUTIP_KITEPASS_ADDRESS ??
    process.env.NEXT_PUBLIC_KITEPASS_ADDRESS) as Address | undefined;

  if (!address) {
    return NextResponse.json(
      { configured: false, hint: "Set KUTIP_KITEPASS_ADDRESS in env" },
      { status: 200 }
    );
  }

  try {
    const rules = await viewSpendingRules(address);
    return NextResponse.json({
      configured: true,
      address,
      explorer: `https://testnet.kitescan.ai/address/${address}`,
      ruleCount: rules.length,
      rules: rules.map((r) => ({
        timeWindow: r.timeWindow.toString(),
        budget: r.budget.toString(),
        initialWindowStartTime: r.initialWindowStartTime.toString(),
        amountUsed: r.amountUsed.toString(),
        currentTimeWindowStartTime: r.currentTimeWindowStartTime.toString(),
        targetProviders: r.targetProviders,
        humanLabel:
          r.timeWindow === 0n
            ? "per-tx"
            : r.timeWindow === 86_400n
            ? "daily"
            : r.timeWindow === 604_800n
            ? "weekly"
            : `${r.timeWindow}s window`
      }))
    });
  } catch (err) {
    return NextResponse.json(
      {
        configured: true,
        address,
        error: err instanceof Error ? err.message : "read failed"
      },
      { status: 502 }
    );
  }
}
