/**
 * In-memory summary store.
 *
 * After a research query completes successfully, its full summary text,
 * citations, and metadata get cached here keyed by queryId. The
 * `/api/summaries/[queryId]` route serves them behind an x402 paywall so
 * OTHER agents can pay to cite Kutip's work — Kutip becomes both consumer
 * AND source in the agentic economy.
 *
 * Production path: write summary blob to IPFS/Arweave + store hash in
 * QueryRecord on-chain. For the hackathon demo this in-memory map is
 * enough: warm Vercel instances share the cache, cold starts rebuild
 * as new queries run.
 */

import type { ResearchResult } from "./types";

interface StoredSummary {
  queryId: string;
  query: string;
  summary: string;
  citations: ResearchResult["citations"];
  paperDetails: ResearchResult["paperDetails"];
  totalPaidUSDC: number;
  attestationTx?: string;
  attestationMode?: "aa" | "eoa";
  savedAt: string;
}

interface PaywallMetrics {
  queryId: string;
  accessCount: number;
  revenueEarned: bigint; // in token's smallest unit (18-dec)
  lastAccessAt?: string;
}

const summariesKey = "__KUTIP_SUMMARIES__";
const metricsKey = "__KUTIP_SUMMARY_METRICS__";
type GlobalWithStores = typeof globalThis & {
  [summariesKey]?: Map<string, StoredSummary>;
  [metricsKey]?: Map<string, PaywallMetrics>;
};

function summaries(): Map<string, StoredSummary> {
  const g = globalThis as GlobalWithStores;
  if (!g[summariesKey]) g[summariesKey] = new Map<string, StoredSummary>();
  return g[summariesKey]!;
}

function metrics(): Map<string, PaywallMetrics> {
  const g = globalThis as GlobalWithStores;
  if (!g[metricsKey]) g[metricsKey] = new Map<string, PaywallMetrics>();
  return g[metricsKey]!;
}

export function saveSummary(result: ResearchResult): void {
  summaries().set(result.queryId.toLowerCase(), {
    queryId: result.queryId,
    query: result.query,
    summary: result.summary,
    citations: result.citations,
    paperDetails: result.paperDetails,
    totalPaidUSDC: result.totalPaidUSDC,
    attestationTx: result.attestationTx,
    attestationMode: result.attestationMode,
    savedAt: new Date().toISOString()
  });
}

export function loadSummary(queryId: string): StoredSummary | undefined {
  return summaries().get(queryId.toLowerCase());
}

export function recordAccess(queryId: string, paid: bigint): void {
  const key = queryId.toLowerCase();
  let m = metrics().get(key);
  if (!m) {
    m = { queryId, accessCount: 0, revenueEarned: 0n };
  }
  m.accessCount = m.accessCount + 1;
  m.revenueEarned = m.revenueEarned + paid;
  m.lastAccessAt = new Date().toISOString();
  metrics().set(key, m);
}

export function getAccessMetrics(queryId: string): PaywallMetrics | undefined {
  return metrics().get(queryId.toLowerCase());
}

export function listMetrics(): PaywallMetrics[] {
  return Array.from(metrics().values()).sort((a, b) =>
    Number(b.revenueEarned - a.revenueEarned)
  );
}

export function listCachedQueryIds(): string[] {
  return Array.from(summaries().keys());
}
