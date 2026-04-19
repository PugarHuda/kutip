#!/usr/bin/env node
// Create a bounty on the BountyMarket for a topic.
// Usage: node scripts/create-bounty.mjs "topic string" [amount] [ttl_days]

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ethers } from "ethers";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envRaw = readFileSync(resolve(__dirname, "../../.env"), "utf-8");
for (const line of envRaw.split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq === -1) continue;
  const k = t.slice(0, eq).trim();
  if (!process.env[k]) process.env[k] = t.slice(eq + 1).trim();
}

const TOPIC = process.argv[2];
const AMOUNT_TOKENS = process.argv[3] ?? "0.5";
const TTL_DAYS = Number(process.argv[4] ?? 7);

if (!TOPIC) {
  console.error("Usage: node scripts/create-bounty.mjs \"topic\" [amount] [ttl_days]");
  process.exit(1);
}

const PK = process.env.PRIVATE_KEY;
const MARKET = process.env.NEXT_PUBLIC_BOUNTY_MARKET_ADDRESS;
const TOKEN = "0x0fF5393387ad2f9f691FD6Fd28e07E3969e27e63";
const RPC = process.env.KITE_RPC_URL ?? "https://rpc-testnet.gokite.ai/";

if (!MARKET) throw new Error("NEXT_PUBLIC_BOUNTY_MARKET_ADDRESS not set");

const provider = new ethers.JsonRpcProvider(RPC, { chainId: 2368, name: "kite" });
const wallet = new ethers.Wallet(PK, provider);

const erc20 = new ethers.Contract(
  TOKEN,
  ["function approve(address,uint256) returns (bool)"],
  wallet
);
const market = new ethers.Contract(
  MARKET,
  ["function create(bytes32 topicHash, uint256 amount, uint64 ttlSeconds) returns (uint256)"],
  wallet
);

const topicHash = ethers.keccak256(ethers.toUtf8Bytes(TOPIC.trim().toLowerCase()));
const amount = ethers.parseUnits(AMOUNT_TOKENS, 18);
const ttl = TTL_DAYS * 24 * 60 * 60;

console.log(`[bounty] sponsor=${wallet.address}`);
console.log(`[bounty] topic="${TOPIC}"  hash=${topicHash.slice(0, 14)}…`);
console.log(`[bounty] amount=${AMOUNT_TOKENS} Test USD  ttl=${TTL_DAYS}d`);

const approveTx = await erc20.approve(MARKET, amount);
await approveTx.wait();
console.log(`[bounty] approve tx: ${approveTx.hash}`);

const createTx = await market.create(topicHash, amount, ttl);
const r = await createTx.wait();
console.log(`[bounty] create tx: ${createTx.hash} block=${r.blockNumber}`);
console.log(`[bounty] view: https://testnet.kitescan.ai/tx/${createTx.hash}`);
