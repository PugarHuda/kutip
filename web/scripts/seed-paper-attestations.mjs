#!/usr/bin/env node
/**
 * Per-paper attestations — make the leaderboard reflect the real
 * Kutip narrative.
 *
 * Earlier seed-on-chain-authors.mjs sprinkled tiny payments across 109
 * addresses just to put each one on-chain. That works but doesn't tell
 * the story: "X paper got cited, here's what its authors earned."
 *
 * This script does the latter: for every paper in papers.json, it
 * calls AttributionLedger.attestAndSplit with that paper's real
 * authors as the citations array — payment routes to them according
 * to authorship order (first author gets the rounding remainder).
 *
 * queryId is DETERMINISTIC: keccak256("paper:" + paper.id). Any
 * indexer can reverse-lookup which paper drove a citation event
 * by comparing queryIds to keccak256("paper:" + papers.json[i].id).
 *
 * Cost per run: BATCH_SIZE_USDC * papers.length USDC + ~600k gas/paper.
 * Defaults to 0.02 USDC × 32 papers = 0.64 USDC.
 *
 * Idempotent? No — re-running creates duplicate-queryId errors
 * (AttributionLedger reverts on already-attested queryIds). Re-run
 * after a leaderboard reset or contract redeploy.
 *
 * Usage (from web/):
 *   node scripts/seed-paper-attestations.mjs
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ethers } from "ethers";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../.env") });
dotenv.config({ path: resolve(__dirname, "../.env.local") });

const PAPERS_PATH = resolve(__dirname, "../data/papers.json");
const AUTHORS_PATH = resolve(__dirname, "../data/authors.json");

const RPC = process.env.KITE_RPC_URL ?? "https://rpc-testnet.gokite.ai/";
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const LEDGER = process.env.ATTRIBUTION_LEDGER_ADDRESS;
const USDC = process.env.KITE_TESTNET_USDC;

// Payment per paper attestation. 0.02 USDC × 32 papers ≈ 0.64 USDC
// total. Tune up for more visible leaderboard amounts at the cost of
// more operator-side USDC needed.
const PAYMENT_PER_PAPER = ethers.parseUnits("0.02", 18);

// Summarizer AA — the sub-agent that does the LLM reading. In the live
// Kutip flow the Researcher pays it 5% per query before settling the
// attestation. This script mirrors that: a 5%-of-payment transfer to
// the Summarizer so the agent-to-agent fee has on-chain proof too.
// Address is deterministic (operator EOA + AA salt 1n); env overrides.
const SUMMARIZER_AA =
  process.env.SUMMARIZER_AA_ADDRESS ??
  "0xA6C36bA2BC8E84fCF276721F30FC79ceD609ef5c";
const SUB_AGENT_BPS = 500n; // 5%
const SUB_AGENT_FEE = (PAYMENT_PER_PAPER * SUB_AGENT_BPS) / 10_000n;

const LEDGER_ABI = [
  "function attestAndSplit(bytes32 queryId, uint256 totalPaid, tuple(address author, uint16 weightBps)[] citations) external",
  "function operator() external view returns (address)",
  "function getQuery(bytes32 queryId) external view returns (tuple(bytes32 queryId, address payer, uint256 totalPaid, uint256 authorsShare, uint64 timestamp, uint16 citationCount))"
];

function queryIdForPaper(paperId) {
  return ethers.keccak256(ethers.toUtf8Bytes(`paper:${paperId}`));
}

function buildCitations(paper, authorsById) {
  const authors = paper.authors
    .map((id) => authorsById.get(id))
    .filter(Boolean);
  if (authors.length === 0) return null;
  const baseWeight = Math.floor(10000 / authors.length);
  const remainder = 10000 - baseWeight * authors.length;
  return authors.map((a, i) => ({
    author: a.wallet,
    // First author absorbs the rounding remainder — academic convention
    // (first author is "lead", gets slightly more in ambiguous splits).
    weightBps: baseWeight + (i === 0 ? remainder : 0)
  }));
}

async function main() {
  if (!PRIVATE_KEY?.startsWith("0x")) throw new Error("PRIVATE_KEY missing");
  if (!LEDGER) throw new Error("ATTRIBUTION_LEDGER_ADDRESS missing");
  if (!USDC) throw new Error("KITE_TESTNET_USDC missing");

  const provider = new ethers.JsonRpcProvider(RPC, {
    chainId: 2368,
    name: "kite-testnet"
  });
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const ledger = new ethers.Contract(LEDGER, LEDGER_ABI, wallet);
  const usdc = new ethers.Contract(
    USDC,
    [
      "function balanceOf(address) view returns (uint256)",
      "function transfer(address, uint256) returns (bool)"
    ],
    wallet
  );

  // Sanity: caller must be on-chain operator.
  const onChainOp = await ledger.operator();
  if (onChainOp.toLowerCase() !== wallet.address.toLowerCase()) {
    throw new Error(
      `Operator mismatch — ledger.operator()=${onChainOp}, signer=${wallet.address}`
    );
  }

  const papers = JSON.parse(readFileSync(PAPERS_PATH, "utf-8"));
  const authors = JSON.parse(readFileSync(AUTHORS_PATH, "utf-8"));
  const authorsById = new Map(authors.map((a) => [a.id, a]));

  console.log(`Operator:   ${wallet.address}`);
  console.log(`Summarizer: ${SUMMARIZER_AA}`);
  console.log(`Papers:     ${papers.length}`);
  console.log(
    `Per paper:  ${ethers.formatUnits(PAYMENT_PER_PAPER, 18)} USDC attestation + ` +
      `${ethers.formatUnits(SUB_AGENT_FEE, 18)} USDC sub-agent fee`
  );

  // Worst case: every paper is fresh → pay both attestation + fee. The
  // fee transfer runs even for already-attested papers (backfill), so
  // budget for fee × all papers regardless.
  const totalNeeded =
    PAYMENT_PER_PAPER * BigInt(papers.length) +
    SUB_AGENT_FEE * BigInt(papers.length);
  const opBal = await usdc.balanceOf(wallet.address);
  console.log(
    `Operator USDC balance: ${ethers.formatUnits(opBal, 18)} · needed ${ethers.formatUnits(totalNeeded, 18)}\n`
  );
  if (opBal < totalNeeded) {
    throw new Error(
      "Insufficient USDC. Fund the operator at https://faucet.gokite.ai then retry."
    );
  }

  let skipped = 0;
  let attested = 0;
  let feesPaid = 0;
  for (const [idx, paper] of papers.entries()) {
    const queryId = queryIdForPaper(paper.id);
    process.stdout.write(
      `  ${String(idx + 1).padStart(2, "0")}/${papers.length} ${paper.id} ${paper.title.slice(0, 46).padEnd(48)}`
    );

    // attestAndSplit reverts on a duplicate queryId, so skip the
    // attestation if this paper is already on-chain — but STILL pay the
    // sub-agent fee below (backfills papers attested before fee logic
    // existed). Note: the fee transfer is not idempotent — this is a
    // one-shot seed script, don't loop it.
    let alreadyAttested = false;
    try {
      const existing = await ledger.getQuery(queryId);
      alreadyAttested = Number(existing.timestamp) > 0;
    } catch {
      /* missing key → empty struct, treat as not attested */
    }

    const citations = buildCitations(paper, authorsById);
    if (!citations) {
      console.log("→ no authors, skipped");
      skipped++;
      continue;
    }

    try {
      if (alreadyAttested) {
        process.stdout.write("→ attested (skip)");
        skipped++;
      } else {
        const fundTx = await usdc.transfer(LEDGER, PAYMENT_PER_PAPER);
        await fundTx.wait();
        const tx = await ledger.attestAndSplit(
          queryId,
          PAYMENT_PER_PAPER,
          citations
        );
        const receipt = await tx.wait();
        process.stdout.write(`→ ✓ attest ${tx.hash.slice(0, 10)}… (gas ${receipt.gasUsed})`);
        attested++;
      }

      // Sub-agent fee — Researcher pays Summarizer 5%. Real agent-to-
      // agent transfer, gives the "AI got paid" leg of the flow an
      // on-chain receipt.
      const feeTx = await usdc.transfer(SUMMARIZER_AA, SUB_AGENT_FEE);
      await feeTx.wait();
      console.log(` · fee ${feeTx.hash.slice(0, 10)}…`);
      feesPaid++;
    } catch (err) {
      console.log(`→ ✗ ${err.shortMessage ?? err.message?.slice(0, 60)}`);
    }
  }

  console.log(
    `\nDone · ${attested} attested · ${skipped} skipped · ${feesPaid} sub-agent fees paid.`
  );
  console.log(
    `Ledger events:    https://testnet.kitescan.ai/address/${LEDGER}#events`
  );
  console.log(
    `Summarizer fees:  https://testnet.kitescan.ai/address/${SUMMARIZER_AA}`
  );
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
