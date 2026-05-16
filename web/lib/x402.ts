import { createPublicClient, http, parseEventLogs, type Hex } from "viem";
import { PIEVERSE_FACILITATOR, KITE_TESTNET_USDC, kiteTestnet } from "./kite";

export interface X402Terms {
  scheme: "gokite-aa";
  network: "kite-testnet";
  maxAmountRequired: string;
  resource: string;
  description: string;
  payTo: string;
  asset: string;
  maxTimeoutSeconds: number;
  merchantName: string;
}

export function buildPaymentRequired(opts: {
  priceUSDC: number;
  resource: string;
  payTo: string;
  description: string;
  merchantName: string;
}) {
  const terms: X402Terms = {
    scheme: "gokite-aa",
    network: "kite-testnet",
    maxAmountRequired: String(opts.priceUSDC),
    resource: opts.resource,
    description: opts.description,
    payTo: opts.payTo,
    asset: KITE_TESTNET_USDC,
    maxTimeoutSeconds: 300,
    merchantName: opts.merchantName
  };

  return {
    status: 402,
    body: {
      error: "X-PAYMENT header is required",
      accepts: [terms],
      x402Version: 1
    }
  };
}

// Cap the header at a generous-but-bounded size so a crafted huge base64
// payload can't blow up the JSON parser. Real payment headers are <1KB.
const MAX_PAYMENT_HEADER_BYTES = 4096;

export function decodePaymentHeader(header: string | null): null | {
  signature: string;
  authorization: unknown;
} {
  if (!header) return null;
  if (header.length > MAX_PAYMENT_HEADER_BYTES) return null;
  try {
    const decoded = Buffer.from(header, "base64").toString("utf-8");
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export async function settleWithFacilitator(payload: {
  authorization: unknown;
  signature: string;
  network: string;
}): Promise<{ success: boolean; txHash?: string; error?: string }> {
  const res = await fetch(`${PIEVERSE_FACILITATOR}/v2/settle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    return { success: false, error: `Facilitator returned ${res.status}` };
  }

  const data = (await res.json()) as { txHash?: string };
  return { success: true, txHash: data.txHash };
}

export function isDemoMode(): boolean {
  return process.env.KUTIP_DEMO_MODE === "1";
}

const TRANSFER_EVENT_ABI = [
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "value", type: "uint256", indexed: false }
    ]
  }
] as const;

/**
 * Verify a real on-chain x402 payment. The tx must have succeeded and
 * carry a USDT `Transfer` to `payTo` of at least `minAmount` (18-dp wei).
 *
 * This is the facilitator-free settlement path: instead of trusting a
 * third-party `/v2/settle`, the merchant proves the payment itself by
 * reading the Kite chain. Deterministic and auditable.
 */
export async function verifyOnChainPayment(
  txHash: Hex,
  payTo: string,
  minAmount: bigint
): Promise<{ ok: boolean; paid: bigint }> {
  const client = createPublicClient({
    chain: kiteTestnet,
    transport: http()
  });
  const receipt = await client.getTransactionReceipt({ hash: txHash });
  if (receipt.status !== "success") return { ok: false, paid: 0n };

  const transfers = parseEventLogs({
    abi: TRANSFER_EVENT_ABI,
    eventName: "Transfer",
    logs: receipt.logs.filter(
      (l) => l.address.toLowerCase() === KITE_TESTNET_USDC.toLowerCase()
    )
  });

  let paid = 0n;
  for (const t of transfers) {
    if (t.args.to?.toLowerCase() === payTo.toLowerCase()) {
      paid += t.args.value ?? 0n;
    }
  }
  return { ok: paid >= minAmount, paid };
}
