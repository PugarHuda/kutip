#!/usr/bin/env node
// Transfer Test USD from EOA → AA agent wallet on Kite testnet.
// Uses the private key from Kutip/.env. Stops the dev server is not required;
// this just hits the RPC directly.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, createWalletClient, http, parseUnits, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envRaw = readFileSync(resolve(__dirname, "../.env"), "utf-8");
for (const line of envRaw.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  if (process.env[key]) continue;
  process.env[key] = trimmed.slice(eq + 1).trim();
}

const PK = process.env.PRIVATE_KEY;
const TO = process.argv[2] ?? "0x4da7f4cFd443084027a39cc0f7c41466d9511776";
const AMOUNT_TOKENS = Number(process.argv[3] ?? "1.5");
const TOKEN = "0x0fF5393387ad2f9f691FD6Fd28e07E3969e27e63";

if (!PK || !PK.startsWith("0x") || PK.length !== 66) {
  console.error("PRIVATE_KEY missing or malformed in .env");
  process.exit(1);
}

const kiteTestnet = defineChain({
  id: 2368,
  name: "Kite Testnet",
  nativeCurrency: { name: "Kite", symbol: "KITE", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc-testnet.gokite.ai/"] } }
});

const account = privateKeyToAccount(PK);
const pub = createPublicClient({ chain: kiteTestnet, transport: http() });
const wallet = createWalletClient({ account, chain: kiteTestnet, transport: http() });

const erc20Abi = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [{ type: "address" }, { type: "uint256" }],
    outputs: [{ type: "bool" }]
  }
];

const amountRaw = parseUnits(String(AMOUNT_TOKENS), 18);

console.log(`[fund-aa] from=${account.address}`);
console.log(`[fund-aa] to=${TO}`);
console.log(`[fund-aa] amount=${AMOUNT_TOKENS} Test USD (${amountRaw} raw)`);

const hash = await wallet.writeContract({
  address: TOKEN,
  abi: erc20Abi,
  functionName: "transfer",
  args: [TO, amountRaw]
});

console.log(`[fund-aa] tx sent: ${hash}`);
console.log(`[fund-aa] waiting for receipt…`);

const receipt = await pub.waitForTransactionReceipt({ hash });
console.log(`[fund-aa] ok · block=${receipt.blockNumber} gas=${receipt.gasUsed}`);
console.log(`[fund-aa] view: https://testnet.kitescan.ai/tx/${hash}`);
