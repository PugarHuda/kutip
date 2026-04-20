import { NextResponse } from "next/server";
import type { Address } from "viem";
import { erc20TransferAbi } from "@/lib/abi";
import { getPublicClient } from "@/lib/ledger";
import { getAAAddress, getSummarizerAAAddress, isAAEnabled } from "@/lib/agent-passport";
import { getEscrowAddress } from "@/lib/escrow";
import { KITE_TESTNET_USDC } from "@/lib/kite";

export const runtime = "nodejs";
export const maxDuration = 15;

/**
 * Live Test USD balances for every wallet in the agent fleet.
 * Drives the sidebar status indicator on /research so users can
 * see funding before firing a query.
 */
export async function GET() {
  const client = getPublicClient();

  const eoa = process.env.NEXT_PUBLIC_AGENT_OPERATOR_ADDRESS as Address | undefined;
  const aa = isAAEnabled() ? getAAAddress() : null;
  const summarizer = isAAEnabled() ? getSummarizerAAAddress() : null;
  const escrow = getEscrowAddress();

  async function bal(addr: Address | null | undefined): Promise<string | null> {
    if (!addr) return null;
    try {
      const v = (await client.readContract({
        address: KITE_TESTNET_USDC,
        abi: erc20TransferAbi,
        functionName: "balanceOf",
        args: [addr]
      })) as bigint;
      return v.toString();
    } catch {
      return null;
    }
  }

  const [eoaBal, aaBal, subBal, escrowBal] = await Promise.all([
    bal(eoa ?? null),
    bal(aa),
    bal(summarizer),
    bal(escrow)
  ]);

  return NextResponse.json({
    eoa: eoa
      ? { address: eoa, balance: eoaBal, label: "EOA (operator)" }
      : null,
    researcher: aa
      ? { address: aa, balance: aaBal, label: "Researcher AA" }
      : null,
    summarizer: summarizer
      ? { address: summarizer, balance: subBal, label: "Summarizer AA" }
      : null,
    escrow: escrow
      ? { address: escrow, balance: escrowBal, label: "Escrow" }
      : null
  });
}
