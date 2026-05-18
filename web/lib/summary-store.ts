/**
 * Summary store — Vercel Blob backed, in-memory fast path.
 *
 * After a research query completes successfully, its full summary text,
 * citations, digest, and metadata are persisted as a JSON blob keyed by
 * queryId. The `/api/summaries/[queryId]` route serves them behind an
 * x402 paywall so OTHER agents can pay to cite Kutip's work — Kutip
 * becomes both consumer AND source in the agentic economy.
 *
 * Persistence: each summary is one object in Vercel Blob under
 * `summaries/<queryId>.json`. A per-instance in-memory Map sits in front
 * as a warm-read cache. When BLOB_READ_WRITE_TOKEN is unset (local dev,
 * or before the Blob store is provisioned) every Blob call is skipped
 * and the store degrades to in-memory only — never throws.
 *
 * Paywall metrics stay in-memory: they're demo-only access counters,
 * not worth a round-trip to persist.
 */

import { keccak256, toBytes } from "viem";
import { put, list } from "@vercel/blob";
import type { ResearchResult } from "./types";

interface StoredSummary {
  queryId: string;
  query: string;
  summary: string;
  // keccak256 of the UTF-8 synthesis text. Tamper-evidence: anyone who
  // receives the summary can recompute this and confirm it's byte-for-byte
  // what Kutip produced for the attested query. Surfaced on /verify and
  // returned by the /api/summaries paywall response.
  summaryHash: string;
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

const BLOB_PREFIX = "summaries/";
function blobEnabled(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}
function blobPath(queryId: string): string {
  return `${BLOB_PREFIX}${queryId.toLowerCase()}.json`;
}
function byNewest(a: StoredSummary, b: StoredSummary): number {
  return b.savedAt.localeCompare(a.savedAt);
}

export function summaryDigest(summary: string): string {
  return keccak256(toBytes(summary));
}

export async function saveSummary(result: ResearchResult): Promise<void> {
  const record: StoredSummary = {
    queryId: result.queryId,
    query: result.query,
    summary: result.summary,
    summaryHash: summaryDigest(result.summary),
    citations: result.citations,
    paperDetails: result.paperDetails,
    totalPaidUSDC: result.totalPaidUSDC,
    attestationTx: result.attestationTx,
    attestationMode: result.attestationMode,
    savedAt: new Date().toISOString()
  };
  // In-memory first so the writing instance can read its own work back
  // immediately, even before Blob's list index is consistent.
  summaries().set(result.queryId.toLowerCase(), record);

  if (!blobEnabled()) return;
  try {
    await put(blobPath(result.queryId), JSON.stringify(record), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true
    });
  } catch (err) {
    // Persistence is best-effort — the query already succeeded and the
    // attestation is on-chain. A failed blob write just means this
    // summary won't survive a cold start; it must not fail the request.
    console.error("[summary-store] blob put failed:", err);
  }
}

export async function loadSummary(
  queryId: string
): Promise<StoredSummary | undefined> {
  const key = queryId.toLowerCase();
  const hit = summaries().get(key);
  if (hit) return hit;
  if (!blobEnabled()) return undefined;
  try {
    const { blobs } = await list({ prefix: blobPath(key), limit: 1 });
    if (blobs.length === 0) return undefined;
    const res = await fetch(blobs[0].url, { cache: "no-store" });
    if (!res.ok) return undefined;
    const record = (await res.json()) as StoredSummary;
    summaries().set(key, record); // warm this instance's cache
    return record;
  } catch (err) {
    console.error("[summary-store] blob load failed:", err);
    return undefined;
  }
}

/** All persisted summaries, newest first — backs the /dashboard/history page. */
export async function listSummaries(): Promise<StoredSummary[]> {
  if (!blobEnabled()) {
    return Array.from(summaries().values()).sort(byNewest);
  }
  try {
    const { blobs } = await list({ prefix: BLOB_PREFIX });
    const fetched = await Promise.all(
      blobs.map(async (b) => {
        try {
          const res = await fetch(b.url, { cache: "no-store" });
          return res.ok ? ((await res.json()) as StoredSummary) : null;
        } catch {
          return null;
        }
      })
    );
    const merged = new Map<string, StoredSummary>();
    for (const r of fetched) {
      if (r) merged.set(r.queryId.toLowerCase(), r);
    }
    // Fold in anything written this instance but not yet visible in
    // Blob's eventually-consistent list.
    for (const [k, v] of summaries()) {
      if (!merged.has(k)) merged.set(k, v);
    }
    return Array.from(merged.values()).sort(byNewest);
  } catch (err) {
    console.error("[summary-store] blob list failed:", err);
    return Array.from(summaries().values()).sort(byNewest);
  }
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

export type { StoredSummary };
