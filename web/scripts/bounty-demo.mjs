#!/usr/bin/env node
/**
 * Bounty end-to-end demo:
 *   1. Sponsor EOA creates a 0.3 Test USD bounty for "carbon capture"
 *   2. Operator settles the bounty to 3 cited authors (from real catalog)
 *   3. Each author receives their share, emits BountySettled event
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ethers } from "ethers";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "../..");
const envRaw = readFileSync(resolve(root, ".env"), "utf-8");
for (const line of envRaw.split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("="); if (eq === -1) continue;
  if (!process.env[t.slice(0, eq).trim()]) {
    process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
}

const PK = process.env.PRIVATE_KEY;
const RPC = "https://rpc-testnet.gokite.ai/";
const BOUNTY = "0x1ba00a38b25adf68ac599cd25094e2aa923b3f72";
const USD = "0x0fF5393387ad2f9f691FD6Fd28e07E3969e27e63";

const BOUNTY_ABI = [
  "function create(bytes32 topicHash, uint256 amount, uint64 ttlSeconds) returns (uint256)",
  "function settle(uint256 bountyId, bytes32 queryId, address[] authors, uint16[] weightsBps)",
  "function bountyCount() view returns (uint256)",
  "function bounties(uint256) view returns (address sponsor, bytes32 topicHash, uint256 amount, uint64 createdAt, uint64 expiresAt, bool settled, bool refunded)",
  "event BountyCreated(uint256 indexed bountyId, address indexed sponsor, bytes32 indexed topicHash, uint256 amount, uint64 expiresAt)",
  "event BountySettled(uint256 indexed bountyId, bytes32 indexed queryId, address[] authors, uint256 totalPaid)"
];

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address) view returns (uint256)"
];

const provider = new ethers.JsonRpcProvider(RPC, { chainId: 2368, name: "kite-testnet" });
const wallet = new ethers.Wallet(PK, provider);
const bounty = new ethers.Contract(BOUNTY, BOUNTY_ABI, wallet);
const usd = new ethers.Contract(USD, ERC20_ABI, wallet);

// Real authors from data/authors.json (deterministic wallets from earlier work)
const AUTHORS_FILE = resolve(root, "web/data/authors.json");
const AUTHORS = JSON.parse(readFileSync(AUTHORS_FILE, "utf-8"));

console.log("=".repeat(64));
console.log("Bounty end-to-end demo");
console.log("=".repeat(64));
console.log(`sponsor/operator: ${wallet.address}`);
console.log(`bounty contract: ${BOUNTY}`);
console.log();

// --- Step 1: sponsor creates bounty ---
const topic = "carbon capture methods 2024";
const topicHash = ethers.keccak256(ethers.toUtf8Bytes(topic.toLowerCase()));
const amount = ethers.parseUnits("0.3", 18);
const ttl = 7n * 24n * 3600n; // 7 days

console.log(`[1] sponsor creates bounty`);
console.log(`    topic: "${topic}"`);
console.log(`    amount: 0.3 Test USD`);
console.log(`    ttl: 7 days`);

const eoaBal = await usd.balanceOf(wallet.address);
if (eoaBal < amount) {
  console.log(`❌ EOA has ${ethers.formatUnits(eoaBal, 18)}, needs 0.3. Top up first.`);
  process.exit(1);
}

const allowance = await usd.allowance(wallet.address, BOUNTY);
if (allowance < amount) {
  console.log(`    approving BountyMarket to pull USD…`);
  const aTx = await usd.approve(BOUNTY, ethers.MaxUint256);
  await aTx.wait();
  console.log(`    approval tx: ${aTx.hash}`);
}

const countBefore = await bounty.bountyCount();
const cTx = await bounty.create(topicHash, amount, ttl);
console.log(`    create tx: ${cTx.hash}`);
const cReceipt = await cTx.wait();
const bountyId = countBefore;
console.log(`    ✓ bountyId=${bountyId} · gas=${cReceipt.gasUsed}`);

// --- Step 2: operator settles bounty ---
console.log();
console.log(`[2] operator settles bounty to 3 cited authors`);

const picked = [AUTHORS[0], AUTHORS[4], AUTHORS[8]]; // Chen, Mehta, Fernandez
const weights = [5000, 3000, 2000]; // 50/30/20 split
const queryId = ethers.keccak256(ethers.toUtf8Bytes(`bounty-demo:${Date.now()}`));

for (let i = 0; i < picked.length; i++) {
  console.log(`    ${picked[i].name.padEnd(24)} → ${picked[i].wallet.slice(0, 10)}…${picked[i].wallet.slice(-6)} · ${weights[i]/100}%`);
}

const sTx = await bounty.settle(
  bountyId,
  queryId,
  picked.map(a => a.wallet),
  weights
);
console.log(`    settle tx: ${sTx.hash}`);
const sReceipt = await sTx.wait();
console.log(`    ✓ gas=${sReceipt.gasUsed} · block=${sReceipt.blockNumber}`);

// --- Step 3: verify balances ---
console.log();
console.log(`[3] post-settle verification`);
for (let i = 0; i < picked.length; i++) {
  const bal = await usd.balanceOf(picked[i].wallet);
  console.log(`    ${picked[i].name.padEnd(24)} · ${ethers.formatUnits(bal, 18)} USDC`);
}

console.log();
console.log("=".repeat(64));
console.log("✓ BountyCreated + BountySettled on Kite testnet");
console.log(`  KiteScan: https://testnet.kitescan.ai/tx/${sTx.hash}`);
console.log("  Narrative: sponsors can fund directed research, agent");
console.log("  matches + operator settles, authors paid per citation weight.");
