#!/usr/bin/env node
// Transfer Test USD from EOA → AA agent wallet on Kite testnet.
// Run from web/ directory: `node scripts/fund-aa.mjs [TO] [AMOUNT]`

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ethers } from "ethers";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envRaw = readFileSync(resolve(__dirname, "../../.env"), "utf-8");
for (const line of envRaw.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  if (!process.env[key]) process.env[key] = trimmed.slice(eq + 1).trim();
}

const PK = process.env.PRIVATE_KEY;
const TO = process.argv[2] ?? "0x4da7f4cFd443084027a39cc0f7c41466d9511776";
const AMOUNT = process.argv[3] ?? "1.5";
const TOKEN = "0x0fF5393387ad2f9f691FD6Fd28e07E3969e27e63";
const RPC = process.env.KITE_RPC_URL ?? "https://rpc-testnet.gokite.ai/";

if (!PK?.startsWith("0x") || PK.length !== 66) {
  console.error("PRIVATE_KEY missing/malformed in .env");
  process.exit(1);
}

const provider = new ethers.JsonRpcProvider(RPC, { chainId: 2368, name: "kite-testnet" });
const wallet = new ethers.Wallet(PK, provider);

const erc20 = new ethers.Contract(
  TOKEN,
  ["function transfer(address to, uint256 amount) returns (bool)"],
  wallet
);

const raw = ethers.parseUnits(AMOUNT, 18);
console.log(`[fund-aa] from=${wallet.address}`);
console.log(`[fund-aa] to=${TO}`);
console.log(`[fund-aa] amount=${AMOUNT} Test USD (${raw} raw)`);

const tx = await erc20.transfer(TO, raw);
console.log(`[fund-aa] tx sent: ${tx.hash}`);
const r = await tx.wait();
console.log(`[fund-aa] ok · block=${r.blockNumber} gas=${r.gasUsed}`);
console.log(`[fund-aa] https://testnet.kitescan.ai/tx/${tx.hash}`);
