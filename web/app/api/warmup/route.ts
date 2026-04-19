import { NextResponse } from "next/server";
import { getAAAddress, isAAEnabled } from "@/lib/agent-passport";
import { getLedgerAddress, getPublicClient } from "@/lib/ledger";

export const runtime = "nodejs";
export const maxDuration = 15;

/**
 * Cheap warmup endpoint — exercised by a Vercel cron every 30 minutes so the
 * agent-passport SDK + viem public client stay warm. Prevents the first real
 * research query from paying a ~15s cold-start tax on top of its normal cost.
 *
 * Skips: OpenRouter (rate-limited), contract writes (costs USDT), Semantic
 * Scholar (rate-limited). Only touches modules + one RPC read.
 */
export async function GET() {
  const aa = isAAEnabled() ? getAAAddress() : null;
  const ledger = getLedgerAddress();

  let chainId = 0;
  try {
    chainId = Number(await getPublicClient().getChainId());
  } catch {
    // RPC hiccup — still count as warmup-attempted
  }

  return NextResponse.json({
    ok: true,
    at: new Date().toISOString(),
    aaEnabled: aa !== null,
    aaAddress: aa,
    ledger,
    chainId
  });
}
