import { defineChain } from "viem";

export const kiteTestnet = defineChain({
  id: 2368,
  name: "Kite Testnet",
  nativeCurrency: { name: "Kite", symbol: "KITE", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc-testnet.gokite.ai/"] }
  },
  blockExplorers: {
    default: { name: "KiteScan", url: "https://testnet.kitescan.ai" }
  },
  testnet: true
});

export const KITE_TESTNET_USDC =
  "0x0fF5393387ad2f9f691FD6Fd28e07E3969e27e63" as const;

export const PIEVERSE_FACILITATOR = "https://facilitator.pieverse.io" as const;

export const SETTLE_ADDRESS =
  "0x12343e649e6b2b2b77649DFAb88f103c02F3C78b" as const;

// Kite testnet settlement token (0x0fF5…7e63), 18-decimal. The deployed
// test token is symbol'd "USDT" / name "Test USD" on-chain, but Kite's
// own docs and the hackathon spec both call the stablecoin "USDC" — so
// UI copy + docs say "USDC" for ecosystem consistency.
export const USDC_DECIMALS = 18 as const;
export const USDC_UNIT = 10n ** BigInt(USDC_DECIMALS);

export function explorerTx(hash: string): string {
  return `${kiteTestnet.blockExplorers.default.url}/tx/${hash}`;
}

export function explorerAddress(addr: string): string {
  return `${kiteTestnet.blockExplorers.default.url}/address/${addr}`;
}

/**
 * Revenue split baked into AttributionLedger at deploy (OPERATOR_BPS /
 * AUTHORS_BPS / ECOSYSTEM_BPS). Authors-majority by design — the cited
 * humans take the largest cut. Single source of truth for UI display;
 * the contract itself is the authority on-chain.
 */
export const SPLIT = { authors: 0.8, operator: 0.15, ecosystem: 0.05 } as const;

export function parseUSDC(amount: number): bigint {
  return BigInt(Math.round(amount * 100)) * (USDC_UNIT / 100n);
}

/**
 * How many papers a query budget funds — the lever that makes a bigger
 * spend tangibly worth more. More budget → broader literature review,
 * and (via the authors split) a larger payout to each cited author.
 *
 * Scales linearly (~10 papers per USDC) with no flat plateau, so a
 * custom budget keeps buying more journals. Floor of 3 keeps even a
 * 0.1-USDC query useful; ceiling of 40 is a gas-safety bound — one
 * `attestAndSplit` then settles ≤40 papers × ≤3 authors ≈ 120 transfers,
 * comfortably inside the block gas limit.
 *
 * Shared by the agent (actual purchase count) and the research UI
 * (the "≈ N papers" budget hint) so the estimate never drifts.
 */
export function papersForBudget(budgetUSDC: number): number {
  return Math.min(40, Math.max(3, Math.round(budgetUSDC * 10)));
}

export function formatUSDC(raw: bigint): string {
  const whole = raw / USDC_UNIT;
  const frac = raw % USDC_UNIT;
  const fracStr = frac.toString().padStart(USDC_DECIMALS, "0").slice(0, 2);
  return `${whole}.${fracStr}`;
}

/**
 * Like formatUSDC, but keeps up to 6 significant fractional digits so
 * sub-cent amounts stay legible. A 0.10-USDC query split across 9
 * authors pays ~0.0088 each — formatUSDC would round that to "0.00"
 * and look broken. Per-author payout rows use this; aggregate totals
 * keep the 2-decimal formatUSDC for a clean headline figure.
 */
export function formatUSDCPrecise(raw: bigint): string {
  const whole = raw / USDC_UNIT;
  const frac = raw % USDC_UNIT;
  let fracStr = frac.toString().padStart(USDC_DECIMALS, "0").slice(0, 6);
  fracStr = fracStr.replace(/0+$/, "");
  if (fracStr.length < 2) fracStr = fracStr.padEnd(2, "0");
  return `${whole}.${fracStr}`;
}
