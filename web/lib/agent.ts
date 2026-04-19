import { keccak256, toBytes, toHex, type Address, type Hex } from "viem";
import {
  getAuthor,
  registerRuntimePapers,
  searchPapers,
  type Author,
  type Paper
} from "./papers";
import {
  isSemanticScholarEnabled,
  searchSemanticScholar
} from "./semantic-scholar";
import {
  getLedgerAddress,
  hasServiceAccount,
  submitAttestation,
  type AttestationParams,
  type EscrowDeposit
} from "./ledger";
import { lookupClaim } from "./claim-registry";
import { getEscrowAddress } from "./escrow";
import { parseUSDC } from "./kite";
import { saveSummary } from "./summary-store";
import type { AgentEvent, Citation, ResearchResult } from "./types";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = process.env.OPENROUTER_MODEL ?? "openai/gpt-oss-120b:free";
const FALLBACK_MODEL = process.env.OPENROUTER_FALLBACK_MODEL ?? "z-ai/glm-4.5-air:free";

type Emit = (event: AgentEvent) => void;

export async function runResearchAgent(opts: {
  query: string;
  budgetUSDC: number;
  emit: Emit;
}): Promise<ResearchResult> {
  const { query, budgetUSDC, emit } = opts;

  const searchLabel = isSemanticScholarEnabled()
    ? "Searching Semantic Scholar corpus"
    : "Searching paper catalog";

  emit({
    type: "step",
    step: { step: 1, label: searchLabel, status: "running" }
  });

  const candidates = await discoverPapers(query);

  if (candidates.length === 0) {
    throw new Error("No relevant papers found for this query");
  }

  const mockCount = candidates.filter((p) => !p.id.startsWith("ss:")).length;
  const realCount = candidates.filter((p) => p.id.startsWith("ss:")).length;
  const detail =
    realCount > 0
      ? `${candidates.length} papers (${realCount} real, ${mockCount} mock)`
      : `Found ${candidates.length} candidates`;

  emit({
    type: "step",
    step: { step: 1, label: searchLabel, status: "done", detail }
  });

  emit({
    type: "step",
    step: { step: 2, label: "Purchasing papers via x402", status: "running" }
  });

  const purchased = await purchasePapers(candidates, budgetUSDC);

  emit({
    type: "step",
    step: {
      step: 2,
      label: "Purchasing papers via x402",
      status: "done",
      detail: `Paid for ${purchased.length} papers`
    }
  });

  const stepThreeLabel = `Reading with ${modelFriendlyName(MODEL)}`;
  emit({
    type: "step",
    step: { step: 3, label: stepThreeLabel, status: "running" }
  });

  const { summary, citationWeights } = await summarizeWithLLM(query, purchased);

  emit({
    type: "step",
    step: { step: 3, label: stepThreeLabel, status: "done" }
  });

  emit({
    type: "step",
    step: { step: 4, label: "Building attribution ledger", status: "running" }
  });

  const citations = buildCitations(purchased, citationWeights);
  const totalPaidRaw = parseUSDC(budgetUSDC);
  const { citations: flatForContract, escrowDeposits } =
    flattenCitationsForContract(purchased, citationWeights, totalPaidRaw);
  const queryId = keccak256(toHex(`${query}:${Date.now()}`));

  const claimedCount = flatForContract.length - escrowDeposits.length;
  const escrowDetail =
    escrowDeposits.length > 0
      ? `${claimedCount} claimed · ${escrowDeposits.length} → escrow`
      : `${flatForContract.length} authors · all claimed`;

  emit({
    type: "step",
    step: {
      step: 4,
      label: "Building attribution ledger",
      status: "done",
      detail: `${citations.length} citations · ${escrowDetail} · weights normalized`
    }
  });

  const attestation = await attestOnChain({
    queryId,
    totalPaid: totalPaidRaw,
    citations: flatForContract,
    escrowDeposits,
    emit
  });

  const paperDetails = purchased.map((p) => {
    const weight = citationWeights.get(p.id) ?? 0;
    const authors = p.authors.map((aid) => {
      const a = getAuthor(aid);
      return {
        name: a?.name ?? aid,
        wallet: a?.wallet ?? "0x0",
        share: weight / p.authors.length
      };
    });
    return {
      id: p.id,
      title: p.title,
      authors,
      journalYear: `${p.journal} ${p.year}`
    };
  });

  const result: ResearchResult = {
    queryId,
    query,
    summary,
    citations,
    totalPaidUSDC: Number(totalPaidRaw),
    attestationTx: attestation?.txHash,
    attestationMode: attestation?.mode,
    attestationPayer: attestation?.payer,
    subAgentAddress: attestation?.subAgentAddress,
    subAgentFeeUSDC: attestation?.subAgentFeeUSDC,
    paperDetails
  };

  // Cache for reverse-x402 resale. Other agents can now pay Kutip to cite
  // this summary via /api/summaries/[queryId]. Closes the recursive loop:
  // Kutip pays humans → Kutip earns from agents → Kutip pays humans …
  saveSummary(result);

  return result;
}

async function attestOnChain(opts: {
  queryId: Hex;
  totalPaid: bigint;
  citations: AttestationParams["citations"];
  escrowDeposits: EscrowDeposit[];
  emit: Emit;
}): Promise<{
  txHash: Hex;
  mode: "aa" | "eoa";
  payer: string;
  subAgentAddress?: string;
  subAgentFeeUSDC?: string;
} | null> {
  const ledger = getLedgerAddress();
  const hasAccount = hasServiceAccount();

  if (!ledger || !hasAccount) {
    opts.emit({
      type: "step",
      step: {
        step: 5,
        label: "Settling on Kite chain",
        status: "done",
        detail: ledger
          ? "Demo mode · SERVICE_PRIVATE_KEY not set, skipping submission"
          : "Demo mode · contract not deployed, skipping submission"
      }
    });
    return null;
  }

  const aaMode = process.env.KUTIP_USE_AA === "1";
  const runningLabel = aaMode
    ? "Settling via agent smart account (AA)"
    : "Settling on Kite chain (EOA)";

  opts.emit({
    type: "step",
    step: { step: 5, label: runningLabel, status: "running" }
  });

  try {
    const result = await submitAttestation({
      queryId: opts.queryId,
      totalPaid: opts.totalPaid,
      citations: opts.citations,
      escrowDeposits: opts.escrowDeposits
    });
    if (!result) throw new Error("submitAttestation returned null");

    const doneLabel =
      result.mode === "aa"
        ? "Settled via agent smart account (AA)"
        : "Settled on Kite chain (EOA)";

    const payerLabel =
      result.mode === "aa"
        ? `agent ${result.payer.slice(0, 8)}…${result.payer.slice(-4)}`
        : `eoa ${result.payer.slice(0, 8)}…${result.payer.slice(-4)}`;

    const subAgentNote = result.subAgent
      ? ` · sub-agent fee ${(Number(result.subAgent.fee) / 1e18).toFixed(4)} USDC`
      : "";

    opts.emit({
      type: "step",
      step: {
        step: 5,
        label: doneLabel,
        status: "done",
        detail: `${payerLabel} · tx ${result.txHash.slice(0, 10)}…${subAgentNote}`
      }
    });

    return {
      txHash: result.txHash,
      mode: result.mode,
      payer: result.payer,
      subAgentAddress: result.subAgent?.address,
      subAgentFeeUSDC: result.subAgent
        ? (Number(result.subAgent.fee) / 1e18).toFixed(4)
        : undefined
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    opts.emit({
      type: "step",
      step: {
        step: 5,
        label: runningLabel,
        status: "error",
        detail: msg
      }
    });
    throw new Error(`Attestation failed: ${msg}`);
  }
}

async function discoverPapers(query: string): Promise<Paper[]> {
  const mockCandidates = searchPapers(query, 8);
  if (!isSemanticScholarEnabled()) return mockCandidates;

  try {
    const { papers, authors } = await searchSemanticScholar(query, 6);
    registerRuntimePapers(papers, authors);
    const merged = [...papers, ...mockCandidates];
    const seen = new Set<string>();
    return merged.filter((p) => {
      const key = p.title.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 8);
  } catch (err) {
    console.warn("[kutip] Semantic Scholar failed, falling back to mock catalog:", err);
    return mockCandidates;
  }
}

async function purchasePapers(candidates: Paper[], budgetUSDC: number): Promise<Paper[]> {
  let remaining = budgetUSDC * 1_000_000;
  const purchased: Paper[] = [];

  for (const paper of candidates) {
    if (remaining >= paper.priceUSDC) {
      purchased.push(paper);
      remaining -= paper.priceUSDC;
    }
    if (purchased.length >= 5) break;
  }

  await new Promise((r) => setTimeout(r, 400));
  return purchased;
}

async function summarizeWithLLM(
  query: string,
  papers: Paper[]
): Promise<{ summary: string; citationWeights: Map<string, number> }> {
  if (!process.env.OPENROUTER_API_KEY) {
    return fallbackSummary(query, papers);
  }

  const corpus = papers
    .map(
      (p, i) =>
        `[${i + 1}] id=${p.id} title=${p.title} (${p.journal} ${p.year})\nabstract: ${p.abstract}`
    )
    .join("\n\n");

  const prompt = `You are a research assistant. A user asked: "${query}"

Below are ${papers.length} paper abstracts you've already purchased. Synthesize a concise summary (3 paragraphs max) answering the user's question, citing papers inline as [1], [2], etc. Then output a JSON block with citation weights (integer basis points summing to exactly 10000) showing how much each paper contributed to your answer. Use the paper id (e.g. "p001") as the key.

${corpus}

Reply in EXACTLY this format with both tags present:
<summary>
Your 3-paragraph synthesis with [1], [2] style citations.
</summary>
<weights>
{"p001": 3000, "p002": 2500, ...}
</weights>`;

  let text: string;
  try {
    text = await callOpenRouter(prompt, MODEL);
  } catch (primaryErr) {
    if (!FALLBACK_MODEL || FALLBACK_MODEL === MODEL) throw primaryErr;
    console.warn(`[kutip] primary model ${MODEL} failed, trying fallback`, primaryErr);
    text = await callOpenRouter(prompt, FALLBACK_MODEL);
  }

  const summaryMatch = text.match(/<summary>([\s\S]*?)<\/summary>/);
  const weightsMatch = text.match(/<weights>([\s\S]*?)<\/weights>/);

  const summary = (summaryMatch?.[1] ?? text).trim();
  const citationWeights = new Map<string, number>();

  if (weightsMatch) {
    const jsonCandidate = weightsMatch[1].trim().replace(/^```json\s*|\s*```$/g, "");
    try {
      const parsed = JSON.parse(jsonCandidate) as Record<string, number>;
      for (const [id, w] of Object.entries(parsed)) {
        citationWeights.set(id, w);
      }
    } catch {
      evenWeights(papers, citationWeights);
    }
  } else {
    evenWeights(papers, citationWeights);
  }

  return { summary, citationWeights: normalize(citationWeights, papers) };
}

async function callOpenRouter(prompt: string, model: string): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY!;
  const body: Record<string, unknown> = {
    model,
    messages: [{ role: "user", content: prompt }],
    max_tokens: 2000,
    temperature: 0.3
  };

  if (supportsReasoningToggle(model)) {
    body.reasoning = { enabled: false };
  }

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
      "X-Title": "Kutip"
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenRouter ${res.status} [${model}]: ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices?: {
      message?: { content?: string | null; reasoning?: string | null };
      finish_reason?: string;
    }[];
  };

  const choice = data.choices?.[0];
  const content = choice?.message?.content ?? "";
  if (content) return content;
  const reasoning = choice?.message?.reasoning ?? "";
  if (reasoning) return reasoning;
  throw new Error(
    `OpenRouter [${model}] returned empty content (finish_reason=${choice?.finish_reason ?? "unknown"})`
  );
}

function supportsReasoningToggle(model: string): boolean {
  return (
    model.startsWith("z-ai/glm-") ||
    model.startsWith("anthropic/claude-") ||
    model.includes("-sonnet") ||
    model.includes("-nemotron")
  );
}

function modelFriendlyName(modelId: string): string {
  const [vendor, name] = modelId.split("/");
  if (!name) return modelId;
  const clean = name.replace(/:free$/, "").replace(/-/g, " ");
  return `${vendor} ${clean}`;
}

function fallbackSummary(
  query: string,
  papers: Paper[]
): { summary: string; citationWeights: Map<string, number> } {
  const bullets = papers
    .map((p, i) => `- [${i + 1}] ${p.title} — ${p.abstract.slice(0, 120)}...`)
    .join("\n");
  const summary = `# Research summary for: "${query}"

This is a mock summary generated in demo mode (no OPENROUTER_API_KEY set).

Based on ${papers.length} papers purchased:
${bullets}

In production, the configured OpenRouter model would synthesize a coherent 3-paragraph answer here.`;

  const weights = new Map<string, number>();
  evenWeights(papers, weights);
  return { summary, citationWeights: weights };
}

function evenWeights(papers: Paper[], map: Map<string, number>) {
  const per = Math.floor(10_000 / papers.length);
  papers.forEach((p, i) => {
    map.set(p.id, i === papers.length - 1 ? 10_000 - per * (papers.length - 1) : per);
  });
}

function normalize(map: Map<string, number>, papers: Paper[]): Map<string, number> {
  const filtered = new Map<string, number>();
  for (const p of papers) {
    const w = map.get(p.id);
    if (w && w > 0) filtered.set(p.id, w);
  }
  if (filtered.size === 0) {
    evenWeights(papers, filtered);
    return filtered;
  }
  const sum = Array.from(filtered.values()).reduce((a, b) => a + b, 0);
  const rebalanced = new Map<string, number>();
  let running = 0;
  const entries = Array.from(filtered.entries());
  entries.forEach(([id, w], i) => {
    if (i === entries.length - 1) {
      rebalanced.set(id, 10_000 - running);
    } else {
      const scaled = Math.floor((w * 10_000) / sum);
      rebalanced.set(id, scaled);
      running += scaled;
    }
  });
  return rebalanced;
}

function buildCitations(papers: Paper[], weights: Map<string, number>): Citation[] {
  return papers
    .filter((p) => (weights.get(p.id) ?? 0) > 0)
    .map((p) => {
      const authorWallets = p.authors
        .map((aid) => getAuthor(aid)?.wallet)
        .filter((w): w is string => typeof w === "string");
      return {
        paperId: p.id,
        authorWallets,
        weightBps: weights.get(p.id) ?? 0
      };
    });
}

/** Flatten per-paper weights to per-author rows. When an author's ORCID
 * is not bound to a wallet yet AND `KUTIP_ROUTE_UNCLAIMED_TO_ESCROW=1`,
 * their row gets routed to the escrow address instead of the synthetic
 * mock wallet — and the orcidHash + computed amount is recorded so
 * `submitAttestation` can emit a `registerDeposit` call in the same
 * atomic UserOp.
 */
function flattenCitationsForContract(
  papers: Paper[],
  weights: Map<string, number>,
  totalPaid: bigint
): {
  citations: { author: Address; weightBps: number }[];
  escrowDeposits: EscrowDeposit[];
} {
  const routeToEscrow = process.env.KUTIP_ROUTE_UNCLAIMED_TO_ESCROW === "1";
  const escrow = routeToEscrow ? getEscrowAddress() : null;
  const authorsBps = Number(process.env.AUTHORS_BPS ?? 4000);

  const citations: { author: Address; weightBps: number }[] = [];
  const escrowDeposits: EscrowDeposit[] = [];

  for (const p of papers) {
    const paperWeight = weights.get(p.id) ?? 0;
    if (paperWeight === 0) continue;

    // Expand per-author with the per-paper weight divided evenly.
    const authorData: { author: Author; share: number }[] = [];
    const per = Math.floor(paperWeight / p.authors.length);
    for (let i = 0; i < p.authors.length; i++) {
      const a = getAuthor(p.authors[i]);
      if (!a || !a.wallet || !a.wallet.startsWith("0x")) continue;
      const share =
        i === p.authors.length - 1 ? paperWeight - per * (p.authors.length - 1) : per;
      if (share > 0) authorData.push({ author: a, share });
    }

    for (const { author, share } of authorData) {
      const claim = author.orcid ? lookupClaim(author.orcid) : undefined;
      const isClaimed = claim !== undefined;

      if (!isClaimed && escrow && author.orcid) {
        // Route to escrow, record orcidHash + amount for registerDeposit
        citations.push({ author: escrow, weightBps: share });
        const orcidHash = keccak256(
          toBytes(author.orcid.replace(/\s+/g, "").toUpperCase())
        );
        // amount = totalPaid * authorsBps/10000 * share/10000
        const amount = (totalPaid * BigInt(authorsBps) * BigInt(share)) / 10_000n / 10_000n;
        escrowDeposits.push({ orcidHash, amount });
      } else {
        // Claimed author OR routing disabled — pay directly
        const wallet = (claim?.wallet ?? author.wallet) as Address;
        citations.push({ author: wallet, weightBps: share });
      }
    }
  }

  const sum = citations.reduce((a, b) => a + b.weightBps, 0);
  if (sum !== 10_000 && citations.length > 0) {
    citations[citations.length - 1].weightBps += 10_000 - sum;
  }
  return { citations, escrowDeposits };
}
