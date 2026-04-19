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

// Kite testnet settlement token is 18-decimal (symbol: USDT on-chain).
// We keep "USDC" in the UI copy because that's what Kite's x402 examples name it.
export const USDC_DECIMALS = 18 as const;
export const USDC_UNIT = 10n ** BigInt(USDC_DECIMALS);

export function explorerTx(hash: string): string {
  return `${kiteTestnet.blockExplorers.default.url}/tx/${hash}`;
}

export function explorerAddress(addr: string): string {
  return `${kiteTestnet.blockExplorers.default.url}/address/${addr}`;
}

export function parseUSDC(amount: number): bigint {
  return BigInt(Math.round(amount * 100)) * (USDC_UNIT / 100n);
}

export function formatUSDC(raw: bigint): string {
  const whole = raw / USDC_UNIT;
  const frac = raw % USDC_UNIT;
  const fracStr = frac.toString().padStart(USDC_DECIMALS, "0").slice(0, 2);
  return `${whole}.${fracStr}`;
}
