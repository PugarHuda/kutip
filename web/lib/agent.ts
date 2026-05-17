import { keccak256, toBytes, toHex, type Address, type Hex } from "viem";
import {
  getAuthor,
  listAuthors,
  registerRuntimePapers,
  searchPapers,
  type Author,
  type Paper
} from "./papers";
import {
  isSemanticScholarEnabled,
  searchSemanticScholar
} from "./semantic-scholar";
import { isOpenAlexEnabled, searchOpenAlex } from "./openalex";
import {
  getLedgerAddress,
  getPublicClient,
  hasServiceAccount,
  submitAttestation,
  type AttestationParams,
  type EscrowDeposit
} from "./ledger";
import { erc20TransferAbi } from "./abi";
import { getAAAddress, isAAEnabled } from "./agent-passport";
import { lookupClaim, warmClaimCache } from "./claim-registry";
import { getEscrowAddress } from "./escrow";
import { KITE_TESTNET_USDC, papersForBudget, parseUSDC, formatUSDC } from "./kite";
import { saveSummary } from "./summary-store";
import { isMirrorEnabled, mirrorToFuji } from "./cross-chain";
import { settleX402 } from "./x402-client";
import type { AgentEvent, Citation, ResearchResult, YearRange } from "./types";

/** Absolute base URL for the agent's own /api/x402 self-call. The
 *  production alias is never deployment-protected, so it's reliable
 *  from inside a Vercel function. */
function baseUrlForSelfCall(): string {
  if (process.env.VERCEL) return "https://kutip-zeta.vercel.app";
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

/** 5% sub-agent fee cap at 0.05 Test USD — mirrored in ledger.ts. */
const SUB_AGENT_FEE_BPS = 500n;
const SUB_AGENT_FEE_CAP = 50000000000000000n;

async function preflightBalance(totalPaid: bigint): Promise<void> {
  // Only check when we're going to actually spend — demo mode / no
  // contract / no AA means the attestation skips safely.
  const aa = isAAEnabled() ? getAAAddress() : null;
  const payer = aa ?? (process.env.NEXT_PUBLIC_AGENT_OPERATOR_ADDRESS as Address | undefined);
  if (!payer) return;

  const subAgentFee =
    (totalPaid * SUB_AGENT_FEE_BPS) / 10_000n > SUB_AGENT_FEE_CAP
      ? SUB_AGENT_FEE_CAP
      : (totalPaid * SUB_AGENT_FEE_BPS) / 10_000n;
  const required = totalPaid + subAgentFee;

  try {
    const balance = (await getPublicClient().readContract({
      address: KITE_TESTNET_USDC,
      abi: erc20TransferAbi,
      functionName: "balanceOf",
      args: [payer]
    })) as bigint;

    if (balance < required) {
      const shortfall = required - balance;
      throw new Error(
        `Insufficient Test USD on ${aa ? "Researcher AA" : "operator"} ` +
        `(${payer.slice(0, 8)}…${payer.slice(-4)}): ` +
        `have ${formatUSDC(balance)}, need ${formatUSDC(required)} ` +
        `(short ${formatUSDC(shortfall)}). ` +
        `Top up via MetaMask — Test USD at 0x0fF5…7e63.`
      );
    }
  } catch (err) {
    // Network / RPC issue — don't block, let attestation surface its own error
    if (err instanceof Error && err.message.startsWith("Insufficient Test USD")) {
      throw err;
    }
    console.warn("[preflight] balance check failed, proceeding:", err);
  }
}

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = process.env.OPENROUTER_MODEL ?? "openai/gpt-oss-120b:free";
const FALLBACK_MODEL = process.env.OPENROUTER_FALLBACK_MODEL ?? "z-ai/glm-4.5-air:free";

type Emit = (event: AgentEvent) => void;

export async function runResearchAgent(opts: {
  query: string;
  budgetUSDC: number;
  years?: YearRange;
  excludePaperIds?: string[];
  sessionInfo?: { sessionId: string; userLabel: string };
  emit: Emit;
}): Promise<ResearchResult> {
  const { query, budgetUSDC, years, excludePaperIds, sessionInfo, emit } = opts;

  const searchLabel =
    isOpenAlexEnabled() || isSemanticScholarEnabled()
      ? "Searching the academic corpus"
      : "Searching paper catalog";

  emit({
    type: "step",
    step: { step: 1, label: searchLabel, status: "running" }
  });

  // Normalize first — translates non-English / tool-flavoured queries
  // into English academic keywords so live discovery actually hits.
  const searchQuery = await normalizeSearchQuery(query);
  const candidates = await discoverPapers(searchQuery, {
    limit: papersForBudget(budgetUSDC),
    years,
    exclude: excludePaperIds
  });

  if (candidates.length === 0) {
    throw new Error(
      `No papers found for "${query}". Kutip searches the academic ` +
        `literature — try a more research-oriented topic, or rephrase ` +
        `in English (e.g. "workflow automation for content publishing").`
    );
  }

  // Live-discovered papers carry an "oa:" (OpenAlex) or "ss:" (Semantic
  // Scholar) id prefix; everything else is the seeded local catalog.
  const isLive = (p: Paper) =>
    p.id.startsWith("oa:") || p.id.startsWith("ss:");
  const realCount = candidates.filter(isLive).length;
  const mockCount = candidates.length - realCount;
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

  // Real x402 handshake — the agent settles corpus access on-chain
  // before reading: HTTP 402 → USDT transfer on Kite → retry with the
  // txHash as proof. Fail-soft: a transient RPC/HTTP blip degrades the
  // detail line but never kills the query (the authoritative payment is
  // the attestation in step 5).
  let x402Tx: string | undefined;
  let x402Detail = "";
  try {
    const settlement = await settleX402(
      `${baseUrlForSelfCall()}/api/x402`,
      `q-${Date.now()}`
    );
    x402Tx = settlement.txHash;
    x402Detail = ` · x402 settled ${settlement.txHash.slice(0, 10)}…`;
  } catch (err) {
    console.warn("[x402] live settlement skipped:", err);
    x402Detail = " · x402 settlement skipped (non-fatal)";
  }

  emit({
    type: "step",
    step: {
      step: 2,
      label: "Purchasing papers via x402",
      status: "done",
      detail: `Paid for ${purchased.length} papers${x402Detail}`
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

  // Warm claim cache from NameRegistry so flattenCitationsForContract
  // routes to real wallets instead of placeholders after a cold start.
  const orcids = listAuthors()
    .map((a) => a.orcid)
    .filter((o): o is string => Boolean(o));
  await warmClaimCache(orcids);

  // Pre-flight: if payer is broke, fail fast with an actionable message
  // instead of burning LLM quota + surfacing the cryptic 'execution reverted'.
  await preflightBalance(totalPaidRaw);

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

  // Cross-chain mirror to Avalanche Fuji — non-blocking. Kite attestation
  // is the source of truth; Fuji is a discoverability mirror for agents
  // on the broader LayerZero ecosystem. Relayer swap for LZ OApp is a
  // one-function change once Kite exposes its LZ endpoint.
  let mirrorTx: string | undefined;
  let mirrorChain: number | undefined;
  let mirrorExplorer: string | undefined;
  if (attestation?.txHash && isMirrorEnabled()) {
    try {
      const mr = await mirrorToFuji({
        queryId,
        payerOnSource: attestation.payer,
        totalPaid: totalPaidRaw,
        citationCount: flatForContract.length
      });
      mirrorTx = mr.txHash;
      mirrorChain = mr.chainId;
      mirrorExplorer = mr.explorer;
    } catch (err) {
      console.warn("[mirror] replicate to Fuji failed:", err);
    }
  }

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
      link: paperLink(p),
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
    sessionId: sessionInfo?.sessionId,
    sessionDelegator: sessionInfo?.userLabel,
    mirrorTx,
    mirrorChain,
    mirrorExplorer,
    x402Tx,
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
      ? ` · sub-agent fee ${(Number(result.subAgent.fee) / 1e18).toFixed(4)} USDT`
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

/**
 * Turn a raw user request into English academic search keywords.
 *
 * OpenAlex's corpus is overwhelmingly English — an Indonesian query
 * ("automasi publikasi konten") or a tool-flavoured one ("n8n workflow")
 * matches nothing verbatim. One cheap LLM call translates + extracts the
 * researchable core, so search hits real papers regardless of how the
 * user phrased it. Falls back to the raw query if the LLM is unavailable.
 */
async function normalizeSearchQuery(query: string): Promise<string> {
  try {
    const prompt =
      `Convert this research request into 3 to 8 English academic search ` +
      `keywords suitable for a scholarly database. Translate to English if ` +
      `needed. Output ONLY the keywords on one line — no quotes, no ` +
      `explanation, no label.\n\nRequest: ${query}`;
    const raw = await callOpenRouter(prompt, MODEL);
    const firstLine = raw.trim().split("\n").find((l) => l.trim()) ?? "";
    const cleaned = firstLine
      .replace(/^["'`]+|["'`]+$/g, "")
      .replace(/^(keywords?|search terms?)\s*[:\-]\s*/i, "")
      .trim()
      .slice(0, 160);
    return cleaned.length >= 3 ? cleaned : query;
  } catch (err) {
    console.warn("[kutip] query normalization failed, using raw query:", err);
    return query;
  }
}

/** Explore mode: papers already cited this session go to the back so
 *  fresh ones surface first — kept as fallback, never dropped, so a
 *  query can't starve for lack of papers. */
function prioritizeFresh(
  papers: Paper[],
  exclude: string[] | undefined,
  limit: number
): Paper[] {
  if (!exclude || exclude.length === 0) return papers.slice(0, limit);
  const seen = new Set(exclude);
  const fresh = papers.filter((p) => !seen.has(p.id));
  const repeats = papers.filter((p) => seen.has(p.id));
  return [...fresh, ...repeats].slice(0, limit);
}

async function discoverPapers(
  query: string,
  opts: { limit: number; years?: YearRange; exclude?: string[] }
): Promise<Paper[]> {
  const { limit, years, exclude } = opts;
  // `limit` tracks papersForBudget so a large-budget query gets enough
  // candidates to spend on. The mock catalog is a fallback — apply the
  // same year window to it so results stay consistent.
  let mockCandidates = searchPapers(query, limit);
  if (years?.from) {
    mockCandidates = mockCandidates.filter((p) => p.year >= years.from!);
  }
  if (years?.to) {
    mockCandidates = mockCandidates.filter((p) => p.year <= years.to!);
  }

  // Live discovery: OpenAlex first (no key, any discipline, polite-pool
  // rate limit comfortable for interactive traffic), Semantic Scholar
  // only if explicitly enabled. Both calls carry an AbortSignal timeout
  // so a slow upstream can't freeze step 1 — on any failure we fall
  // back to the local catalog and the flow continues.
  let live: { papers: Paper[]; authors: Author[] } | null = null;

  if (isOpenAlexEnabled()) {
    try {
      live = await searchOpenAlex(query, limit, years);
    } catch (err) {
      console.warn("[kutip] OpenAlex discovery failed:", err);
    }
  }
  if ((!live || live.papers.length === 0) && isSemanticScholarEnabled()) {
    try {
      live = await searchSemanticScholar(query, limit, years);
    } catch (err) {
      console.warn("[kutip] Semantic Scholar discovery failed:", err);
    }
  }

  if (!live || live.papers.length === 0) {
    return prioritizeFresh(mockCandidates, exclude, limit);
  }

  registerRuntimePapers(live.papers, live.authors);
  const merged = [...live.papers, ...mockCandidates];
  const seen = new Set<string>();
  const deduped = merged.filter((p) => {
    const key = p.title.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return prioritizeFresh(deduped, exclude, limit);
}

/**
 * Budget decides research depth: a bigger spend buys access to more
 * papers (up to the gas-safe ceiling in `papersForBudget`), so a larger
 * query is tangibly worth more — broader synthesis AND, via the authors
 * split, a bigger payout pool for the humans cited.
 */
async function purchasePapers(candidates: Paper[], budgetUSDC: number): Promise<Paper[]> {
  const purchased = candidates.slice(0, papersForBudget(budgetUSDC));
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
      const parsed = JSON.parse(jsonCandidate) as Record<string, unknown>;
      // Bounds-check every weight before trusting LLM output. Prevents
      // a prompt-injection attacker who controls a paper title from
      // sneaking in NaN/Infinity/MAX_SAFE_INTEGER values that would
      // corrupt the bps math downstream, or unknown paper ids that
      // route payouts to fabricated authors.
      const paperIds = new Set(papers.map((p) => p.id));
      const sanitized = new Map<string, number>();
      for (const [id, w] of Object.entries(parsed)) {
        if (!paperIds.has(id)) continue;
        if (typeof w !== "number" || !Number.isFinite(w)) continue;
        if (w < 0 || w > 10_000_000) continue;
        sanitized.set(id, w);
      }
      if (sanitized.size === 0) {
        evenWeights(papers, citationWeights);
      } else {
        for (const [id, w] of sanitized) citationWeights.set(id, w);
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

/**
 * Best-effort public URL for a paper — backs the clickable in-summary
 * citation pills. Order: real DOI → arXiv → OpenAlex landing page →
 * Google Scholar title search (always resolves, even for the seeded
 * catalog and Semantic Scholar papers without a DOI).
 */
function paperLink(p: Paper): string {
  const doi = (p.doi ?? "").trim();
  if (/^10\.\d{4,}\/\S+$/.test(doi)) return `https://doi.org/${doi}`;
  const arxiv = doi.replace(/^arxiv:/i, "");
  if (/^\d{4}\.\d{4,5}(v\d+)?$/.test(arxiv)) {
    return `https://arxiv.org/abs/${arxiv}`;
  }
  if (p.id.startsWith("oa:")) return `https://openalex.org/${p.id.slice(3)}`;
  return `https://scholar.google.com/scholar?q=${encodeURIComponent(p.title)}`;
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

export function evenWeights(papers: Paper[], map: Map<string, number>) {
  const per = Math.floor(10_000 / papers.length);
  papers.forEach((p, i) => {
    map.set(p.id, i === papers.length - 1 ? 10_000 - per * (papers.length - 1) : per);
  });
}

export function normalize(map: Map<string, number>, papers: Paper[]): Map<string, number> {
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

export function buildCitations(papers: Paper[], weights: Map<string, number>): Citation[] {
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
export function flattenCitationsForContract(
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
