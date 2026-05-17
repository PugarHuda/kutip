/**
 * Kutip agent identity layer.
 *
 * Kite's trust chain is User (EOA) → Agent (AA wallet) → Session (ephemeral).
 * Full Kite Agent Passport is currently invitation-gated on testnet; until the
 * invite lands we demonstrate the agent-identity layer via gokite-aa-sdk,
 * which implements EIP-4337 Account Abstraction against Kite's staging bundler.
 *
 * Narrative for judges:
 *   - Service EOA (user's wallet) is the master identity.
 *   - Derived AA account is the AGENT's own on-chain identity — it holds
 *     USDC, signs transactions, and is what appears on KiteScan as the payer.
 *   - When the Passport invitation arrives, layer signup/session on top.
 *     No business-logic change required.
 *
 * Failure modes (graceful):
 *   - Bundler unreachable → throw, caller falls back to plain EOA path.
 *   - KUTIP_USE_AA != "1" → skip, caller uses plain EOA path.
 */

import { GokiteAASDK } from "gokite-aa-sdk";
import { ethers } from "ethers";
import type { Address, Hex } from "viem";
import { KITE_TESTNET_USDC } from "./kite";

const BUNDLER_URL = "https://bundler-service.staging.gokite.ai/rpc/";
const KITE_ENTRY_POINT = "0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108";
// Paymaster + settlement token pulled from gokite-aa-sdk/config.js (kite_testnet).
// With these passed, the AA pays gas in Test USD — no KITE needed in the agent wallet.
const KITE_TESTNET_PAYMASTER = "0x9Adcbf85D5c724611a490Ba9eDc4d38d6F39e92d" as const;

export interface AAContext {
  sdk: GokiteAASDK;
  signerAddress: Address;
  aaAddress: Address;
  sign: (userOpHash: string) => Promise<string>;
}

export function isAAEnabled(): boolean {
  return (
    process.env.KUTIP_USE_AA === "1" &&
    typeof process.env.PRIVATE_KEY === "string" &&
    process.env.PRIVATE_KEY.startsWith("0x") &&
    process.env.PRIVATE_KEY.length === 66
  );
}

let _ctx: AAContext | null = null;

export function getAAContext(): AAContext | null {
  if (!isAAEnabled()) return null;
  if (_ctx) return _ctx;

  const pk = process.env.PRIVATE_KEY as Hex;
  const signer = new ethers.Wallet(pk);
  const signerAddress = ethers.getAddress(signer.address) as Address;

  const sdk = new GokiteAASDK(
    "kite_testnet",
    process.env.KITE_RPC_URL ?? "https://rpc-testnet.gokite.ai/",
    BUNDLER_URL
  );

  const aaAddress = sdk.getAccountAddress(signerAddress) as Address;

  const sign = async (userOpHash: string) =>
    signer.signMessage(ethers.getBytes(userOpHash));

  _ctx = { sdk, signerAddress, aaAddress, sign };
  return _ctx;
}

/** Returns AA account address without instantiating the full SDK for every call. */
export function getAAAddress(): Address | null {
  return getAAContext()?.aaAddress ?? null;
}

/**
 * Derive a second AA account from the same EOA using a different salt.
 * The Summarizer is its own on-chain identity — it receives the
 * sub-agent fee from the Researcher before each attestation settles.
 * This demonstrates agent-to-agent composition on Kite chain.
 */
export function getSummarizerAAAddress(): Address | null {
  const ctx = getAAContext();
  if (!ctx) return null;
  return ctx.sdk.getAccountAddress(ctx.signerAddress, 1n) as Address;
}

export interface BatchedCall {
  target: Address;
  value: bigint;
  data: Hex;
}

export interface AASubmitResult {
  userOpHash: Hex;
  txHash: Hex;
  aaAddress: Address;
}

/**
 * Submit a batched UserOperation via the AA account.
 * The UserOp calls target[0](value[0], data[0]) then target[1](value[1], data[1]) ...
 * atomically from the agent's AA wallet.
 */
export async function sendBatchUserOp(calls: BatchedCall[]): Promise<AASubmitResult> {
  const ctx = getAAContext();
  if (!ctx) throw new Error("AA context unavailable (KUTIP_USE_AA disabled or PK missing)");

  const batchRequest = {
    targets: calls.map((c) => c.target),
    values: calls.map((c) => c.value),
    callDatas: calls.map((c) => c.data)
  };

  const usePaymaster = process.env.KUTIP_AA_PAYMASTER !== "0";
  const paymasterAddress = usePaymaster ? KITE_TESTNET_PAYMASTER : undefined;

  const result = await ctx.sdk.sendUserOperationAndWait(
    ctx.signerAddress,
    batchRequest,
    ctx.sign,
    undefined,
    paymasterAddress
  );

  const { status, userOpHash } = result;
  const happyStatus = status.status === "success" || status.status === "included";
  if (!happyStatus) {
    const details = await fetchUserOpDetails(userOpHash);
    const reason =
      details?.reason ??
      (status as { reason?: string }).reason ??
      status.status;
    console.error("[aa] userOp reverted", {
      userOpHash,
      status: status.status,
      sdkStatus: status,
      details
    });
    throw new Error(
      `UserOp ${userOpHash}: ${reason}${details?.revertReasonDecoded ? ` (${details.revertReasonDecoded})` : ""}`
    );
  }

  const txHash = status.transactionHash;
  if (!txHash) {
    throw new Error(`UserOp ${userOpHash.slice(0, 12)}… returned no transactionHash`);
  }

  return {
    userOpHash: userOpHash as Hex,
    txHash: txHash as Hex,
    aaAddress: ctx.aaAddress
  };
}

const KNOWN_ERRORS: Record<string, string> = {
  "0xb5db60cb": "WeightMismatch — citation weights don't sum to 10000 bps",
  "0xb2dbca4d": "QueryAlreadyAttested — queryId already attested",
  "0x4b0423cf": "EmptyCitations — zero citations passed to attestAndSplit",
  "0xbcd55b0f": "InvalidSplit — constructor splits don't total 10000",
  "0xe450d38c": "ERC20InsufficientBalance — insufficient Test USD at sender",
  "0x5274afe7": "SafeERC20FailedOperation — token transfer reverted",
  "0x118cdaa7": "OwnableUnauthorizedAccount — caller is not owner"
};

async function fetchUserOpDetails(userOpHash: string): Promise<{
  reason?: string;
  revertData?: string;
  revertReasonDecoded?: string;
} | null> {
  try {
    const res = await fetch(BUNDLER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_getUserOperationReceipt",
        params: [userOpHash],
        id: 1
      })
    });
    const j = (await res.json()) as {
      result?: {
        reason?: string;
        success?: boolean;
        receipt?: { status?: string };
        revertData?: string;
      } | null;
    };
    if (!j.result) return null;
    const selector = j.result.revertData?.slice(0, 10);
    let decoded = selector ? KNOWN_ERRORS[selector] : undefined;
    // Error(string) standard revert — decode the reason
    if (!decoded && selector === "0x08c379a0" && j.result.revertData) {
      try {
        const hex = j.result.revertData.slice(138);
        const bytes = Buffer.from(hex, "hex");
        const nul = bytes.indexOf(0);
        const str = bytes.slice(0, nul === -1 ? bytes.length : nul).toString("utf8");
        if (str) decoded = `Error("${str}")`;
      } catch {
        /* ignore */
      }
    }
    return {
      reason: j.result.reason,
      revertData: j.result.revertData,
      revertReasonDecoded: decoded
    };
  } catch (err) {
    console.warn("[aa] could not fetch userOp details:", err);
    return null;
  }
}

export const AA_CONSTANTS = {
  bundlerUrl: BUNDLER_URL,
  entryPoint: KITE_ENTRY_POINT,
  paymaster: KITE_TESTNET_PAYMASTER,
  settlementToken: KITE_TESTNET_USDC
} as const;
