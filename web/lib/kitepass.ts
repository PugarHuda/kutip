/**
 * Kite Passport (KitePass) on-chain integration.
 *
 * KitePass = ClientAgentVault, a UUPS-upgradeable proxy that enforces
 * spending rules on-chain for an agent's AA wallet. Pattern:
 *   1. User deploys a KitePass proxy via UserOp (one-time per user)
 *   2. User configures spending rules (timeWindow, budget, providers)
 *   3. Agent's spending is bounded by those rules going forward
 *
 * Implementation derived from gokite-aa-sdk@1.0.15 example.js (the SDK's
 * own reference flow). We re-implement here so we control the contract
 * address constants, error shape, and don't break if the example file
 * shifts.
 *
 * Env required:
 *   - PRIVATE_KEY: signs UserOps on behalf of the user (server-relayed
 *     for now — production would call wagmi.signMessage from the browser)
 *   - KUTIP_USE_AA: must be "1" so the AA layer is engaged
 */

import { ethers, Interface, AbiCoder } from "ethers";
import type { Address, Hex } from "viem";
import { GokiteAASDK } from "gokite-aa-sdk";

const SETTLEMENT_TOKEN: Address = "0x0fF5393387ad2f9f691FD6Fd28e07E3969e27e63";
const CLIENT_AGENT_VAULT_IMPL: Address =
  "0xB5AAFCC6DD4DFc2B80fb8BCcf406E1a2Fd559e23";
const KITE_RPC = "https://rpc-testnet.gokite.ai/";
const BUNDLER_URL = "https://bundler-service.staging.gokite.ai/rpc/";

// Standard OZ TransparentUpgradeableProxy bytecode (compiled w/ default
// constructor signature: (logic, admin, data)). This is the bytecode that
// gokite-aa-sdk's example uses; published in their `getTransparentProxyBytecode`
// helper. We embed inline to avoid pulling the example.js side door.
//
// If Kite ever upgrades the proxy template, the bytecode here may need to
// match. For now, copy from gokite-aa-sdk@1.0.15 example.js.
//
// NOTE: this string is a placeholder pointer — at runtime we resolve the
// actual bytecode from the SDK's exported helper to avoid drift.
async function loadProxyBytecode(): Promise<string> {
  // Lazy-load the SDK example helper rather than vendor 30 KB of bytecode
  // here. If Kite publishes an SDK update, we automatically inherit it.
  const mod = (await import("gokite-aa-sdk/dist/aa/example.js")) as {
    getTransparentProxyBytecode: () => string;
  };
  return mod.getTransparentProxyBytecode();
}

export interface SpendingRule {
  /** seconds; 0 = per-transaction limit, >0 = per-window total */
  timeWindow: bigint;
  /** budget in wei (18 decimals) — max spend within timeWindow */
  budget: bigint;
  /** unix timestamp anchoring the window */
  initialWindowStartTime: bigint;
  /** keccak256(providerId) array; empty = applies to all providers */
  targetProviders: Hex[];
}

export interface DeployKitePassResult {
  success: boolean;
  proxyAddress?: Address;
  txHash?: Hex;
  error?: string;
}

export type SignFunction = (userOpHash: string) => Promise<string>;

function sdk(): GokiteAASDK {
  return new GokiteAASDK("kite_testnet", KITE_RPC, BUNDLER_URL);
}

function aaOf(eoa: Address): Address {
  return sdk().getAccountAddress(eoa) as Address;
}

/**
 * Deploys a fresh KitePass (ClientAgentVault) for the user. Vault is
 * owned by the user's AA wallet, allowing only the configured token
 * (Test USD on testnet).
 *
 * Costs ~1 UserOp gas (sponsored by paymaster).
 */
export async function deployKitePass(
  eoa: Address,
  signFn: SignFunction
): Promise<DeployKitePassResult> {
  try {
    const aa = aaOf(eoa);

    const initializeCallData = new Interface([
      "function initialize(address allowedToken, address owner)"
    ]).encodeFunctionData("initialize", [SETTLEMENT_TOKEN, aa]);

    const proxyConstructorData = AbiCoder.defaultAbiCoder().encode(
      ["address", "address", "bytes"],
      [CLIENT_AGENT_VAULT_IMPL, aa, initializeCallData]
    );

    const proxyBytecode = await loadProxyBytecode();
    const fullInitCode = proxyBytecode + proxyConstructorData.slice(2);

    const callData = new Interface([
      "function performCreate(uint256 value, bytes calldata initCode) returns (address)"
    ]).encodeFunctionData("performCreate", [0n, fullInitCode]);

    const result = await sdk().sendUserOperationAndWait(
      eoa,
      { target: aa, value: 0n, callData },
      signFn
    );

    if (result.status.status !== "success") {
      return {
        success: false,
        error: result.status.reason ?? "userOp failed"
      };
    }

    const proxyAddress = await parseContractCreatedEvent(
      result.status.transactionHash as Hex
    );

    return {
      success: true,
      proxyAddress: proxyAddress ?? undefined,
      txHash: result.status.transactionHash as Hex
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "unknown"
    };
  }
}

/**
 * Append spending rules to an existing KitePass. Fetches current rules,
 * concatenates new ones (KitePass's setSpendingRules clears + replaces,
 * so we must merge client-side).
 */
export async function configureSpendingRules(
  eoa: Address,
  kitepassAddress: Address,
  rulesToAdd: SpendingRule[],
  signFn: SignFunction
): Promise<{ success: boolean; txHash?: Hex; error?: string }> {
  try {
    // Fetch existing then strip usage fields (setSpendingRules only takes
    // the rule shape, not the runtime tracking data).
    const existing = await viewSpendingRules(kitepassAddress);
    const existingPlain: SpendingRule[] = existing.map((r) => ({
      timeWindow: r.timeWindow,
      budget: r.budget,
      initialWindowStartTime: r.initialWindowStartTime,
      targetProviders: r.targetProviders
    }));
    const merged = [...existingPlain, ...rulesToAdd];

    const callData = new Interface([
      "function setSpendingRules(tuple(uint256 timeWindow, uint160 budget, uint96 initialWindowStartTime, bytes32[] targetProviders)[] rules)"
    ]).encodeFunctionData("setSpendingRules", [merged]);

    const result = await sdk().sendUserOperationAndWait(
      eoa,
      { target: kitepassAddress, value: 0n, callData },
      signFn
    );

    if (result.status.status !== "success") {
      return { success: false, error: result.status.reason ?? "userOp failed" };
    }
    return { success: true, txHash: result.status.transactionHash as Hex };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "unknown"
    };
  }
}

export interface SpendingRuleWithUsage extends SpendingRule {
  amountUsed: bigint;
  currentTimeWindowStartTime: bigint;
}

/**
 * Read current spending rules + usage data from a KitePass proxy.
 * Returns empty array if the proxy doesn't exist yet or has never been
 * configured. The contract returns a tuple of (rule, usage) per entry —
 * we flatten into one struct for downstream consumers.
 */
export async function viewSpendingRules(
  kitepassAddress: Address
): Promise<SpendingRuleWithUsage[]> {
  const provider = new ethers.JsonRpcProvider(KITE_RPC, {
    chainId: 2368,
    name: "kite-testnet"
  });
  const contract = new ethers.Contract(
    kitepassAddress,
    [
      "function getSpendingRules() view returns (tuple(tuple(uint256 timeWindow, uint160 budget, uint96 initialWindowStartTime, bytes32[] targetProviders) rule, tuple(uint128 amountUsed, uint128 currentTimeWindowStartTime) usage)[])"
    ],
    provider
  );

  try {
    const raw = (await contract.getSpendingRules()) as Array<{
      rule: [bigint, bigint, bigint, string[]];
      usage: [bigint, bigint];
    }>;
    return raw.map((entry) => {
      const r = entry.rule;
      const u = entry.usage;
      return {
        timeWindow: BigInt(r[0]),
        budget: BigInt(r[1]),
        initialWindowStartTime: BigInt(r[2]),
        targetProviders: r[3] as Hex[],
        amountUsed: BigInt(u[0]),
        currentTimeWindowStartTime: BigInt(u[1])
      };
    });
  } catch {
    return [];
  }
}

async function parseContractCreatedEvent(txHash: Hex): Promise<Address | null> {
  const provider = new ethers.JsonRpcProvider(KITE_RPC, {
    chainId: 2368,
    name: "kite-testnet"
  });
  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt) return null;

  // Looking for ContractCreated(address) event (topic0 = keccak256 of sig)
  const sig = ethers.id("ContractCreated(address)");
  for (const log of receipt.logs) {
    if (log.topics[0] === sig && log.topics[1]) {
      return ("0x" + log.topics[1].slice(-40)) as Address;
    }
  }
  // Fallback: scan logs for the address that received deployment bytecode
  // (contractAddress field is for direct CREATE — won't be set here since
  // proxy is deployed via internal call). Best-effort.
  return null;
}

/**
 * Helper to compose a "daily budget + per-tx cap" rule pair for the
 * Kutip use case. timeWindow=86400 enforces daily budget; timeWindow=0
 * adds per-tx ceiling.
 */
export function buildKutipRules(opts: {
  dailyBudgetUSDC: bigint;
  perTxCapUSDC: bigint;
  startOfDay?: bigint;
}): SpendingRule[] {
  const today = new Date();
  const startOfDay =
    opts.startOfDay ??
    BigInt(
      Math.floor(
        new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() /
          1000
      )
    );

  return [
    {
      timeWindow: 86_400n,
      budget: opts.dailyBudgetUSDC,
      initialWindowStartTime: startOfDay,
      targetProviders: []
    },
    {
      timeWindow: 0n,
      budget: opts.perTxCapUSDC,
      initialWindowStartTime: 0n,
      targetProviders: []
    }
  ];
}

export const KITEPASS_ADDRESSES = {
  SETTLEMENT_TOKEN,
  CLIENT_AGENT_VAULT_IMPL
} as const;
