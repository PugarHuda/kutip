#!/usr/bin/env node
// Seed UnclaimedYieldEscrow with deposits reflecting our 3 known on-chain
// attestations, so /escrow shows data immediately without waiting for a
// fresh query-flow integration.
//
// Operator (EOA) pays from its own USDT — represents the "reserved
// principal" on behalf of unclaimed authors. When they claim, escrow
// releases this reserved pool back.
//
// Run once after deploy: node scripts/seed-escrow.mjs

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

const PK = process.env.PRIVATE_KEY;
const ESCROW = process.env.NEXT_PUBLIC_ESCROW_ADDRESS;
const TOKEN = "0x0fF5393387ad2f9f691FD6Fd28e07E3969e27e63";
const RPC = process.env.KITE_RPC_URL ?? "https://rpc-testnet.gokite.ai/";

if (!ESCROW) throw new Error("NEXT_PUBLIC_ESCROW_ADDRESS not set");
if (!PK) throw new Error("PRIVATE_KEY not set");

const provider = new ethers.JsonRpcProvider(RPC, { chainId: 2368, name: "kite" });
const wallet = new ethers.Wallet(PK, provider);

const erc20 = new ethers.Contract(
  TOKEN,
  [
    "function approve(address spender, uint256 amount) returns (bool)",
    "function balanceOf(address) view returns (uint256)"
  ],
  wallet
);
const escrow = new ethers.Contract(
  ESCROW,
  [
    "function depositFor(bytes32 orcidHash, uint256 amount)",
    "function totalPrincipalOutstanding() view returns (uint256)"
  ],
  wallet
);

// Mock authors in our catalog — seed the top 3 most-cited with deposits
// matching their accrued earnings from 3 historical attestations.
const seeds = [
  { orcid: "0000-0001-1234-0001", name: "Dr. Sarah Chen", amount: ethers.parseUnits("0.18", 18) },
  { orcid: "0000-0001-1234-0002", name: "Dr. Marcus Hoffmann", amount: ethers.parseUnits("0.18", 18) },
  { orcid: "0000-0001-1234-0003", name: "Dr. Ingibjörg Sigurdsson", amount: ethers.parseUnits("0.18", 18) }
];

const total = seeds.reduce((s, r) => s + r.amount, 0n);

console.log(`[seed] operator=${wallet.address}`);
console.log(`[seed] escrow=${ESCROW}`);

const bal = await erc20.balanceOf(wallet.address);
console.log(`[seed] operator Test USD balance: ${ethers.formatUnits(bal, 18)}`);
if (bal < total) {
  console.error(
    `[seed] insufficient balance — need ${ethers.formatUnits(total, 18)}, have ${ethers.formatUnits(bal, 18)}`
  );
  process.exit(1);
}

console.log(`[seed] approving escrow for ${ethers.formatUnits(total, 18)} Test USD…`);
const approveTx = await erc20.approve(ESCROW, total);
await approveTx.wait();
console.log(`[seed] approve tx: ${approveTx.hash}`);

for (const s of seeds) {
  const hash = ethers.id(s.orcid.toUpperCase()); // keccak256 UTF-8 of ORCID
  console.log(`[seed] depositFor(${s.name})  hash=${hash.slice(0, 14)}…  amount=${ethers.formatUnits(s.amount, 18)}`);
  const tx = await escrow.depositFor(hash, s.amount);
  const r = await tx.wait();
  console.log(`[seed]   tx=${tx.hash} block=${r.blockNumber}`);
}

const outstanding = await escrow.totalPrincipalOutstanding();
console.log(`\n[seed] done · totalPrincipalOutstanding=${ethers.formatUnits(outstanding, 18)} Test USD`);
