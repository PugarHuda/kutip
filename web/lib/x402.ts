import { PIEVERSE_FACILITATOR, KITE_TESTNET_USDC } from "./kite";

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

export function decodePaymentHeader(header: string | null): null | {
  signature: string;
  authorization: unknown;
} {
  if (!header) return null;
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
