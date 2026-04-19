import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  http,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { attributionLedgerAbi, erc20TransferAbi } from "./abi";
import { KITE_TESTNET_USDC, kiteTestnet } from "./kite";
import {
  getAAAddress,
  getSummarizerAAAddress,
  isAAEnabled,
  sendBatchUserOp
} from "./agent-passport";

const RPC_URL = process.env.KITE_RPC_URL ?? kiteTestnet.rpcUrls.default.http[0];

// Block where AttributionLedger was deployed. Narrows getContractEvents scans
// from ~20M blocks to a manageable range — prevents RPC timeouts.
const LEDGER_DEPLOY_BLOCK =
  process.env.ATTRIBUTION_LEDGER_DEPLOY_BLOCK
    ? BigInt(process.env.ATTRIBUTION_LEDGER_DEPLOY_BLOCK)
    : 20944832n;

export function getLedgerAddress(): Address | null {
  const raw = process.env.NEXT_PUBLIC_ATTRIBUTION_LEDGER?.trim();
  if (!raw || !raw.startsWith("0x") || raw.length !== 42) return null;
  return raw as Address;
}

export function hasServiceAccount(): boolean {
  const pk = process.env.SERVICE_PRIVATE_KEY ?? process.env.PRIVATE_KEY;
  return typeof pk === "string" && pk.startsWith("0x") && pk.length === 66;
}

let _publicClient: PublicClient | null = null;
export function getPublicClient(): PublicClient {
  if (_publicClient) return _publicClient;
  _publicClient = createPublicClient({
    chain: kiteTestnet,
    transport: http(RPC_URL)
  });
  return _publicClient;
}

function getWalletClient(): { wallet: WalletClient; account: Address } | null {
  const pk = process.env.SERVICE_PRIVATE_KEY ?? process.env.PRIVATE_KEY;
  if (!pk || !pk.startsWith("0x") || pk.length !== 66) return null;
  const account = privateKeyToAccount(pk as Hex);
  const wallet = createWalletClient({
    account,
    chain: kiteTestnet,
    transport: http(RPC_URL)
  });
  return { wallet, account: account.address };
}

export interface QueryRecord {
  queryId: Hex;
  payer: Address;
  totalPaid: bigint;
  authorsShare: bigint;
  timestamp: bigint;
  citationCount: number;
}

export async function getQueryRecord(queryId: Hex): Promise<QueryRecord | null> {
  const ledger = getLedgerAddress();
  if (!ledger) return null;

  try {
    const res = (await getPublicClient().readContract({
      address: ledger,
      abi: attributionLedgerAbi,
      functionName: "queries",
      args: [queryId]
    })) as readonly [Hex, Address, bigint, bigint, bigint, number];

    if (res[4] === 0n) return null;

    return {
      queryId: res[0],
      payer: res[1],
      totalPaid: res[2],
      authorsShare: res[3],
      timestamp: res[4],
      citationCount: Number(res[5])
    };
  } catch {
    return null;
  }
}

export interface AuthorStats {
  wallet: Address;
  earnings: bigint;
  citations: bigint;
}

export async function getAuthorStats(wallets: Address[]): Promise<AuthorStats[]> {
  const ledger = getLedgerAddress();
  if (!ledger || wallets.length === 0) {
    return wallets.map((w) => ({ wallet: w, earnings: 0n, citations: 0n }));
  }

  const client = getPublicClient();
  try {
    const results = await Promise.all(
      wallets.flatMap((w) => [
        client.readContract({
          address: ledger,
          abi: attributionLedgerAbi,
          functionName: "authorEarnings",
          args: [w]
        }),
        client.readContract({
          address: ledger,
          abi: attributionLedgerAbi,
          functionName: "authorCitations",
          args: [w]
        })
      ])
    );

    return wallets.map((w, i) => ({
      wallet: w,
      earnings: results[i * 2] as bigint,
      citations: results[i * 2 + 1] as bigint
    }));
  } catch {
    return wallets.map((w) => ({ wallet: w, earnings: 0n, citations: 0n }));
  }
}

export interface CitationEvent {
  author: Address;
  weightBps: number;
  amount: bigint;
  txHash: Hex;
  blockNumber: bigint;
}

export async function getCitationsForQuery(queryId: Hex): Promise<CitationEvent[]> {
  const ledger = getLedgerAddress();
  if (!ledger) return [];

  try {
    const logs = await getPublicClient().getContractEvents({
      address: ledger,
      abi: attributionLedgerAbi,
      eventName: "CitationPaid",
      args: { queryId },
      fromBlock: LEDGER_DEPLOY_BLOCK,
      toBlock: "latest"
    });

    return logs.map((log) => ({
      author: log.args.author as Address,
      weightBps: Number(log.args.weightBps),
      amount: log.args.amount as bigint,
      txHash: log.transactionHash as Hex,
      blockNumber: log.blockNumber as bigint
    }));
  } catch (err) {
    console.error("[ledger] getCitationsForQuery failed:", err);
    return [];
  }
}

export interface AttestationParams {
  queryId: Hex;
  totalPaid: bigint;
  citations: { author: Address; weightBps: number }[];
}

export interface AttestationResult {
  mode: "aa" | "eoa";
  txHash: Hex;
  transferTxHash?: Hex;
  userOpHash?: Hex;
  aaAddress?: Address;
  payer: Address;
  subAgent?: {
    address: Address;
    fee: bigint;
  };
}

// 5% of the query budget goes to the Summarizer sub-agent.
// Capped at 0.05 USDT so a large query doesn't burn the AA pocket.
const SUB_AGENT_FEE_BPS = 500n;
const SUB_AGENT_FEE_CAP = 50000000000000000n; // 0.05 * 10^18
function computeSubAgentFee(totalPaid: bigint): bigint {
  const pct = (totalPaid * SUB_AGENT_FEE_BPS) / 10000n;
  return pct > SUB_AGENT_FEE_CAP ? SUB_AGENT_FEE_CAP : pct;
}

export async function submitAttestation(
  params: AttestationParams
): Promise<AttestationResult | null> {
  const ledger = getLedgerAddress();
  if (!ledger) return null;

  if (isAAEnabled()) {
    return submitViaAA(ledger, params);
  }

  const wc = getWalletClient();
  if (!wc) return null;
  return submitViaEOA(wc, ledger, params);
}

async function submitViaAA(
  ledger: Address,
  params: AttestationParams
): Promise<AttestationResult> {
  const aaAddress = getAAAddress();
  if (!aaAddress) throw new Error("AA address unavailable despite isAAEnabled()");

  const summarizer = getSummarizerAAAddress();
  const subAgentFee = summarizer ? computeSubAgentFee(params.totalPaid) : 0n;

  const calls: { target: Address; value: bigint; data: Hex }[] = [];

  if (summarizer && subAgentFee > 0n) {
    const subFeeData = encodeFunctionData({
      abi: erc20TransferAbi,
      functionName: "transfer",
      args: [summarizer, subAgentFee]
    });
    calls.push({ target: KITE_TESTNET_USDC, value: 0n, data: subFeeData });
  }

  const transferData = encodeFunctionData({
    abi: erc20TransferAbi,
    functionName: "transfer",
    args: [ledger, params.totalPaid]
  });

  const attestData = encodeFunctionData({
    abi: attributionLedgerAbi,
    functionName: "attestAndSplit",
    args: [params.queryId, params.totalPaid, params.citations]
  });

  calls.push({ target: KITE_TESTNET_USDC, value: 0n, data: transferData });
  calls.push({ target: ledger, value: 0n, data: attestData });

  const { userOpHash, txHash } = await sendBatchUserOp(calls);

  return {
    mode: "aa",
    txHash,
    userOpHash,
    aaAddress,
    payer: aaAddress,
    subAgent:
      summarizer && subAgentFee > 0n
        ? { address: summarizer, fee: subAgentFee }
        : undefined
  };
}

async function submitViaEOA(
  wc: { wallet: WalletClient; account: Address },
  ledger: Address,
  params: AttestationParams
): Promise<AttestationResult> {
  const client = getPublicClient();

  const transferTxHash = await wc.wallet.writeContract({
    account: wc.account,
    chain: kiteTestnet,
    address: KITE_TESTNET_USDC,
    abi: erc20TransferAbi,
    functionName: "transfer",
    args: [ledger, params.totalPaid]
  });
  await client.waitForTransactionReceipt({ hash: transferTxHash });

  const txHash = await wc.wallet.writeContract({
    account: wc.account,
    chain: kiteTestnet,
    address: ledger,
    abi: attributionLedgerAbi,
    functionName: "attestAndSplit",
    args: [params.queryId, params.totalPaid, params.citations]
  });
  await client.waitForTransactionReceipt({ hash: txHash });

  return {
    mode: "eoa",
    txHash,
    transferTxHash,
    payer: wc.account
  };
}
