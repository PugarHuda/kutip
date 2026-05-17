import { NextResponse } from "next/server";
import type { Address } from "viem";
import { erc20TransferAbi } from "@/lib/abi";
import { getPublicClient } from "@/lib/ledger";
import {
  getAAAddress,
  getSummarizerAAAddress,
  isAAEnabled
} from "@/lib/agent-passport";
import { KITE_TESTNET_USDC } from "@/lib/kite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 15;

const PAYMASTER =
  "0x9Adcbf85D5c724611a490Ba9eDc4d38d6F39e92d" as Address;

export async function GET() {
  const client = getPublicClient();
  const aa = isAAEnabled() ? getAAAddress() : null;
  const sub = isAAEnabled() ? getSummarizerAAAddress() : null;
  const eoa = process.env.NEXT_PUBLIC_AGENT_OPERATOR_ADDRESS as Address | undefined;

  async function nativeBal(addr: Address | null | undefined): Promise<string | null> {
    if (!addr) return null;
    try {
      const v = await client.getBalance({ address: addr });
      return v.toString();
    } catch {
      return null;
    }
  }

  async function usdcBal(addr: Address | null | undefined): Promise<string | null> {
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

  async function allowance(
    owner: Address | null | undefined,
    spender: Address
  ): Promise<string | null> {
    if (!owner) return null;
    try {
      const v = (await client.readContract({
        address: KITE_TESTNET_USDC,
        abi: erc20TransferAbi,
        functionName: "allowance",
        args: [owner, spender]
      })) as bigint;
      return v.toString();
    } catch {
      return null;
    }
  }

  const [
    aaNative,
    aaUsdc,
    aaAllowance,
    subNative,
    subUsdc,
    paymasterNative,
    paymasterUsdc,
    eoaNative,
    eoaUsdc
  ] = await Promise.all([
    nativeBal(aa),
    usdcBal(aa),
    allowance(aa, PAYMASTER),
    nativeBal(sub),
    usdcBal(sub),
    nativeBal(PAYMASTER),
    usdcBal(PAYMASTER),
    nativeBal(eoa),
    usdcBal(eoa)
  ]);

  return NextResponse.json({
    paymaster: {
      address: PAYMASTER,
      kiteBalance: paymasterNative,
      usdcBalance: paymasterUsdc,
      role: "Sponsors gas for every Agent UserOp, collects USDC instead"
    },
    researcherAA: aa
      ? {
          address: aa,
          kiteBalance: aaNative,
          usdcBalance: aaUsdc,
          allowanceToPaymaster: aaAllowance,
          role: "Agent's own wallet · pays authors · never holds KITE"
        }
      : null,
    summarizerAA: sub
      ? {
          address: sub,
          kiteBalance: subNative,
          usdcBalance: subUsdc,
          role: "Sub-agent · receives 5% per query via batched UserOp"
        }
      : null,
    operatorEOA: eoa
      ? {
          address: eoa,
          kiteBalance: eoaNative,
          usdcBalance: eoaUsdc,
          role: "Fund AAs · never signs attestations (AA does)"
        }
      : null,
    stats: {
      userGasPaid: "0",
      userGasCurrency: "anything",
      note: "Users pay zero gas. Agent's USDC is auto-converted to KITE for bundler by paymaster in postOp."
    }
  });
}
