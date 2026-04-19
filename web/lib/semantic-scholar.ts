/**
 * Semantic Scholar adapter — pulls real academic papers into the agent flow.
 *
 * API: https://api.semanticscholar.org/graph/v1/paper/search
 *   - Free, no API key for up to 100 req/5min
 *   - Returns real papers: arXiv, Nature, Science, venue-rich
 *
 * Author wallets: each real author gets a deterministic synthetic wallet
 * (keccak256 of their name) until they claim via ORCID → wallet binding.
 * When a real author claims, operator admin upgrades the registry and
 * future queries resolve to their real wallet.
 */

import { keccak256, toBytes, type Address } from "viem";
import type { Author, Paper } from "./papers";

interface SSAuthor {
  name: string;
  authorId?: string | null;
}

interface SSPaper {
  paperId: string;
  externalIds?: { DOI?: string; ArXiv?: string };
  title: string | null;
  abstract: string | null;
  year: number | null;
  venue: string | null;
  authors?: SSAuthor[];
}

interface SSSearchResponse {
  total: number;
  offset: number;
  data: SSPaper[];
}

const SS_URL = "https://api.semanticscholar.org/graph/v1/paper/search";
const FIELDS = "paperId,externalIds,title,abstract,year,venue,authors";

export function isSemanticScholarEnabled(): boolean {
  return process.env.KUTIP_USE_SEMANTIC_SCHOLAR === "1";
}

export async function searchSemanticScholar(
  query: string,
  limit = 8
): Promise<{ papers: Paper[]; authors: Author[] }> {
  const url = new URL(SS_URL);
  url.searchParams.set("query", query);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("fields", FIELDS);

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    next: { revalidate: 300 }
  });

  if (!res.ok) {
    throw new Error(`Semantic Scholar ${res.status}: ${await res.text().catch(() => "")}`);
  }

  const data = (await res.json()) as SSSearchResponse;
  const authorMap = new Map<string, Author>();
  const papers: Paper[] = [];

  for (const p of data.data) {
    if (!p.title || !p.abstract || !p.authors?.length) continue;

    const paperAuthorIds: string[] = [];
    for (const a of p.authors.slice(0, 3)) {
      const id = synthAuthorId(a.name);
      if (!authorMap.has(id)) {
        authorMap.set(id, {
          id,
          name: a.name,
          affiliation: "Real author · ORCID unclaimed",
          wallet: synthWallet(a.name),
          orcid: a.authorId ?? ""
        });
      }
      paperAuthorIds.push(id);
    }

    const paperId = `ss:${p.paperId.slice(0, 10)}`;
    papers.push({
      id: paperId,
      doi: p.externalIds?.DOI ?? p.externalIds?.ArXiv ?? p.paperId,
      title: p.title,
      abstract: p.abstract,
      year: p.year ?? 2024,
      journal: p.venue ?? "arXiv preprint",
      keywords: [],
      priceUSDC: 400000,
      authors: paperAuthorIds
    });
  }

  return {
    papers,
    authors: Array.from(authorMap.values())
  };
}

function synthAuthorId(name: string): string {
  return `ss-author:${name.toLowerCase().replace(/\s+/g, "-").slice(0, 40)}`;
}

function synthWallet(name: string): Address {
  const hash = keccak256(toBytes(`kutip-author:${name.toLowerCase()}`));
  return `0x${hash.slice(26)}` as Address;
}
