/**
 * Cross-chain citation mirror (Kite → Avalanche Fuji).
 *
 * After each Kite attestation settles, fire a mirrorAttest() call on
 * the Fuji CitationMirror contract so agents on the broader LayerZero
 * ecosystem can read Kutip citations without indexing Kite directly.
 *
 * Honest trust model: operator-relayed. Migration to LayerZero DVN is
 * a single function swap once Kite's LZ endpoint comes online — the
 * Fuji contract already matches the OApp _lzReceive shape.
 */

import { ethers } from "ethers";
import type { Hex } from "viem";

const MIRROR_ABI = [
  "function mirrorAttest(bytes32 queryId, uint32 sourceChainId, address payerOnSource, uint256 totalPaid, uint16 citationCount, uint64 sourceTimestamp) external",
  "function isMirrored(bytes32 queryId) external view returns (bool)",
  "event AttestationMirrored(bytes32 indexed queryId, uint32 indexed sourceChainId, address indexed payerOnSource, uint256 totalPaid, uint16 citationCount, uint64 sourceTimestamp)"
];

const SOURCE_CHAIN_ID = 2368;

export interface MirrorRequest {
  queryId: Hex;
  payerOnSource: string;
  totalPaid: bigint;
  citationCount: number;
  sourceTimestamp?: number;
}

export interface MirrorResult {
  txHash: string;
  chainId: number;
  explorer: string;
  mirrorAddress: string;
  blockNumber: number;
}

function cfg():
  | { address: string; rpc: string; chainId: number; pk: string }
  | null {
  const address = process.env.KUTIP_MIRROR_ADDRESS;
  const rpc = process.env.KUTIP_MIRROR_RPC_URL;
  const chainId = process.env.KUTIP_MIRROR_CHAIN_ID;
  const pk = process.env.PRIVATE_KEY;
  if (!address || !rpc || !chainId || !pk) return null;
  if (!pk.startsWith("0x")) return null;
  return { address, rpc, chainId: Number(chainId), pk };
}

export function isMirrorEnabled(): boolean {
  return cfg() !== null;
}

export async function mirrorToFuji(req: MirrorRequest): Promise<MirrorResult> {
  const c = cfg();
  if (!c) throw new Error("Mirror relay disabled — KUTIP_MIRROR_* env missing");

  const provider = new ethers.JsonRpcProvider(c.rpc, {
    chainId: c.chainId,
    name: "avalanche-fuji"
  });
  const wallet = new ethers.Wallet(c.pk, provider);
  const contract = new ethers.Contract(c.address, MIRROR_ABI, wallet);

  const sourceTs = BigInt(req.sourceTimestamp ?? Math.floor(Date.now() / 1000));
  const tx = await contract.mirrorAttest(
    req.queryId,
    SOURCE_CHAIN_ID,
    req.payerOnSource,
    req.totalPaid,
    BigInt(req.citationCount),
    sourceTs
  );
  const receipt = await tx.wait();

  return {
    txHash: tx.hash,
    chainId: c.chainId,
    explorer: `https://testnet.snowtrace.io/tx/${tx.hash}`,
    mirrorAddress: c.address,
    blockNumber: receipt.blockNumber
  };
}
