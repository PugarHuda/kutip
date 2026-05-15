#!/usr/bin/env node
/**
 * Bootstrap real on-chain presence for every author in authors.json.
 *
 * What it does:
 *   1. Reads web/data/authors.json — the 109 real-address authors.
 *   2. Partitions them into batches whose weight sum equals 10000 bps
 *      (AttributionLedger requires exact match).
 *   3. For each batch:
 *        a. Mints test USDC to the ledger (or transfers if already held)
 *        b. Calls AttributionLedger.attestAndSplit(syntheticQueryId, ...)
 *      Each call emits CitationPaid events for every author in the batch.
 *   4. Logs the resulting tx hashes + KiteScan links.
 *
 * After this script, every author address has on-chain history:
 *   - Received small USDC transfer (visible on KiteScan)
 *   - Appears in CitationPaid events linked to a Kutip queryId
 *   - Populates AttributionLedger.authorEarnings + authorCitations
 *
 * Pre-reqs:
 *   - PRIVATE_KEY in .env (operator EOA — must equal AttributionLedger.operator)
 *   - KITE_RPC_URL in .env
 *   - ATTRIBUTION_LEDGER_ADDRESS in .env
 *   - KITE_TESTNET_USDC in .env
 *   - Operator EOA must have enough Kite testnet USDC for the per-batch
 *     payment (default 0.10 USDC per batch ~ 0.50 USDC total)
 *
 * Usage (from web/):
 *   node scripts/seed-on-chain-authors.mjs
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ethers } from "ethers";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../.env") });
dotenv.config({ path: resolve(__dirname, "../.env.local") });

const AUTHORS_PATH = resolve(__dirname, "../data/authors.json");
const PAPERS_PATH = resolve(__dirname, "../data/papers.json");

const RPC = process.env.KITE_RPC_URL ?? "https://rpc-testnet.gokite.ai/";
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const LEDGER = process.env.ATTRIBUTION_LEDGER_ADDRESS;
const USDC = process.env.KITE_TESTNET_USDC;
// 0.10 USDC per attestation. Pick low enough that 5+ batches stay affordable.
const PAYMENT_PER_BATCH = ethers.parseUnits("0.10", 18);
// Cap citations per batch so the tx stays under block gas limit.
// 30 is conservative; AttributionLedger loops over citations twice
// (weight check + transfer), so ~30 keeps us comfortably below 3M gas.
const BATCH_SIZE = 30;

const LEDGER_ABI = [
  "function attestAndSplit(bytes32 queryId, uint256 totalPaid, tuple(address author, uint16 weightBps)[] citations) external",
  "function operator() external view returns (address)"
];

async function main() {
  if (!PRIVATE_KEY?.startsWith("0x")) {
    throw new Error("PRIVATE_KEY must be set in .env");
  }
  if (!LEDGER) throw new Error("ATTRIBUTION_LEDGER_ADDRESS must be set in .env");
  if (!USDC) throw new Error("KITE_TESTNET_USDC must be set in .env");

  const provider = new ethers.JsonRpcProvider(RPC, {
    chainId: 2368,
    name: "kite-testnet"
  });
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const ledger = new ethers.Contract(LEDGER, LEDGER_ABI, wallet);

  console.log(`Operator EOA: ${wallet.address}`);
  console.log(`Ledger:       ${LEDGER}`);

  const onChainOperator = await ledger.operator();
  if (onChainOperator.toLowerCase() !== wallet.address.toLowerCase()) {
    throw new Error(
      `Mismatch: AttributionLedger.operator() = ${onChainOperator} but PRIVATE_KEY signs as ${wallet.address}.\n` +
        "attestAndSplit is gated to the operator address — bootstrapping cannot proceed."
    );
  }
  console.log(`✓ Signer is the on-chain operator\n`);

  const authors = JSON.parse(readFileSync(AUTHORS_PATH, "utf-8"));
  console.log(`Read ${authors.length} authors`);

  // USDC interface for funding the ledger before each batch settles.
  const usdc = new ethers.Contract(
    USDC,
    [
      "function balanceOf(address) external view returns (uint256)",
      "function transfer(address, uint256) external returns (bool)"
    ],
    wallet
  );
  const operatorBal = await usdc.balanceOf(wallet.address);
  const totalNeeded = PAYMENT_PER_BATCH * BigInt(Math.ceil(authors.length / BATCH_SIZE));
  console.log(
    `Operator USDC balance: ${ethers.formatUnits(operatorBal, 18)} · needed: ${ethers.formatUnits(totalNeeded, 18)}`
  );
  if (operatorBal < totalNeeded) {
    throw new Error(
      "Insufficient USDC balance — fund the operator EOA from https://faucet.gokite.ai then retry."
    );
  }

  // Partition authors into BATCH_SIZE batches, computing per-author weights
  // that sum to exactly 10000 (AttributionLedger reverts otherwise).
  const batches = [];
  for (let i = 0; i < authors.length; i += BATCH_SIZE) {
    batches.push(authors.slice(i, i + BATCH_SIZE));
  }
  console.log(`Will run ${batches.length} batches of up to ${BATCH_SIZE} authors each\n`);

  for (const [idx, batch] of batches.entries()) {
    const baseWeight = Math.floor(10000 / batch.length);
    const remainder = 10000 - baseWeight * batch.length;
    const citations = batch.map((a, i) => ({
      author: a.wallet,
      // First citation absorbs the remainder so the sum is exact 10000.
      weightBps: baseWeight + (i === 0 ? remainder : 0)
    }));

    const queryId = ethers.id(`kutip-onchain-seed-batch-${idx}-${Date.now()}`);

    process.stdout.write(`  batch ${idx + 1}/${batches.length} (${batch.length} authors) …`);

    // 1. Fund the ledger with this batch's payment.
    const fundTx = await usdc.transfer(LEDGER, PAYMENT_PER_BATCH);
    await fundTx.wait();

    // 2. Settle the attestation.
    const tx = await ledger.attestAndSplit(queryId, PAYMENT_PER_BATCH, citations);
    const receipt = await tx.wait();
    console.log(
      ` ✓ tx ${tx.hash.slice(0, 12)}… (gas ${receipt.gasUsed})`
    );
    console.log(
      `      https://testnet.kitescan.ai/tx/${tx.hash}`
    );
  }

  console.log(`\n✓ All ${authors.length} authors now have on-chain CitationPaid events.`);
  console.log(
    `  Browse: https://testnet.kitescan.ai/address/${LEDGER}#events`
  );
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
