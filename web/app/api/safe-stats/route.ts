import { NextResponse } from "next/server";
import type { Address } from "viem";
import { erc20TransferAbi } from "@/lib/abi";
import { getPublicClient } from "@/lib/ledger";
import { KITE_TESTNET_USDC } from "@/lib/kite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const safeAbi = [
  {
    type: "function",
    name: "getOwners",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address[]" }]
  },
  {
    type: "function",
    name: "getThreshold",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "nonce",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "VERSION",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }]
  }
] as const;

export async function GET() {
  const safe = process.env.NEXT_PUBLIC_OPERATOR_SAFE as Address | undefined;
  if (!safe) return NextResponse.json({ enabled: false });

  const client = getPublicClient();

  try {
    const [owners, threshold, nonce, version, kite, usdc] = await Promise.all([
      client.readContract({
        address: safe,
        abi: safeAbi,
        functionName: "getOwners"
      }),
      client.readContract({
        address: safe,
        abi: safeAbi,
        functionName: "getThreshold"
      }),
      client.readContract({ address: safe, abi: safeAbi, functionName: "nonce" }),
      client
        .readContract({ address: safe, abi: safeAbi, functionName: "VERSION" })
        .catch(() => "unknown"),
      client.getBalance({ address: safe }),
      client.readContract({
        address: KITE_TESTNET_USDC,
        abi: erc20TransferAbi,
        functionName: "balanceOf",
        args: [safe]
      })
    ]);

    return NextResponse.json({
      enabled: true,
      address: safe,
      owners,
      threshold: Number(threshold),
      ownerCount: (owners as readonly string[]).length,
      nonce: Number(nonce),
      version,
      kiteBalance: kite.toString(),
      usdcBalance: (usdc as bigint).toString()
    });
  } catch (err) {
    return NextResponse.json(
      {
        enabled: true,
        address: safe,
        error: err instanceof Error ? err.message : "read failed"
      },
      { status: 502 }
    );
  }
}
