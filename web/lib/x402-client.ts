import {
  createPublicClient,
  createWalletClient,
  http,
  type Hex
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { kiteTestnet, KITE_TESTNET_USDC } from "./kite";

const ERC20_TRANSFER_ABI = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "value", type: "uint256" }
    ],
    outputs: [{ type: "bool" }]
  }
] as const;

export interface X402Settlement {
  txHash: string;
  paid: string;
  payTo: string;
  explorer: string;
}

/**
 * Real x402 buyer — runs the full handshake against an HTTP 402 resource:
 *
 *   1. POST the resource → receive `402` + the payment challenge.
 *   2. Settle the challenge with a genuine USDT transfer on Kite testnet
 *      (operator EOA is the payer).
 *   3. Retry with `X-PAYMENT: base64({txHash})` → receive `200`.
 *
 * No facilitator — the merchant verifies the transfer on-chain. Throws
 * on any failure so the caller can decide whether to fail-soft.
 */
export async function settleX402(
  resourceUrl: string,
  queryId: string
): Promise<X402Settlement> {
  const pk = process.env.SERVICE_PRIVATE_KEY ?? process.env.PRIVATE_KEY;
  if (!pk || !pk.startsWith("0x")) {
    throw new Error("x402: no signer key configured");
  }

  // 1. Unpaid request → expect the 402 challenge.
  const challengeRes = await fetch(resourceUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ queryId }),
    signal: AbortSignal.timeout(10_000)
  });
  if (challengeRes.status !== 402) {
    throw new Error(`x402: expected 402, got ${challengeRes.status}`);
  }
  const challenge = (await challengeRes.json()) as {
    accepts?: { payTo?: string; maxAmountRequired?: string }[];
  };
  const terms = challenge.accepts?.[0];
  if (!terms?.payTo || !terms.maxAmountRequired) {
    throw new Error("x402: malformed challenge");
  }

  // 2. Pay the challenge — a real USDT transfer on Kite.
  const account = privateKeyToAccount(pk as Hex);
  const wallet = createWalletClient({
    account,
    chain: kiteTestnet,
    transport: http()
  });
  const pub = createPublicClient({ chain: kiteTestnet, transport: http() });

  const txHash = await wallet.writeContract({
    address: KITE_TESTNET_USDC,
    abi: ERC20_TRANSFER_ABI,
    functionName: "transfer",
    args: [terms.payTo as Hex, BigInt(terms.maxAmountRequired)]
  });
  await pub.waitForTransactionReceipt({ hash: txHash, timeout: 60_000 });

  // 3. Retry with the on-chain proof.
  const proof = Buffer.from(JSON.stringify({ txHash })).toString("base64");
  const settleRes = await fetch(resourceUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-PAYMENT": proof },
    body: JSON.stringify({ queryId }),
    signal: AbortSignal.timeout(20_000)
  });
  if (!settleRes.ok) {
    const body = await settleRes.text().catch(() => "");
    throw new Error(`x402: settlement rejected (${settleRes.status}) ${body}`);
  }
  const settled = (await settleRes.json()) as {
    paid?: string;
    explorer?: string;
  };

  return {
    txHash,
    paid: settled.paid ?? terms.maxAmountRequired,
    payTo: terms.payTo,
    explorer: settled.explorer ?? `https://testnet.kitescan.ai/tx/${txHash}`
  };
}
