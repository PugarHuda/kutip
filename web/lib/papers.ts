import papers from "@/data/papers.json";
import authors from "@/data/authors.json";
import { lookupClaim } from "./claim-registry";

export interface Paper {
  id: string;
  doi: string;
  title: string;
  authors: string[];
  year: number;
  journal: string;
  abstract: string;
  keywords: string[];
  priceUSDC: number;
}

export interface Author {
  id: string;
  name: string;
  affiliation: string;
  wallet: string;
  orcid: string;
}

const paperMap = new Map<string, Paper>(papers.map((p) => [p.id, p as Paper]));
const authorMap = new Map<string, Author>(authors.map((a) => [a.id, a as Author]));

/**
 * Runtime registry for papers/authors discovered at query time (e.g., from
 * Semantic Scholar). Persists within a warm server process — Vercel cold
 * starts reset. That's fine: attestation receipts keep their authors inline
 * via `ResearchResult.paperDetails`, so past queries stay viewable.
 */
const runtimePaperMap = new Map<string, Paper>();
const runtimeAuthorMap = new Map<string, Author>();

export function registerRuntimePapers(ps: Paper[], as: Author[]) {
  for (const p of ps) runtimePaperMap.set(p.id, p);
  for (const a of as) runtimeAuthorMap.set(a.id, a);
}

export function getPaper(id: string): Paper | undefined {
  return paperMap.get(id) ?? runtimePaperMap.get(id);
}

export function getAuthor(id: string): Author | undefined {
  const base = authorMap.get(id) ?? runtimeAuthorMap.get(id);
  if (!base) return undefined;
  if (!base.orcid) return base;
  const claim = lookupClaim(base.orcid);
  if (!claim) return base;
  return { ...base, wallet: claim.wallet, affiliation: `${base.affiliation} · claimed ✓` };
}

export function listPapers(): Paper[] {
  return papers as Paper[];
}

export function listAuthors(): Author[] {
  return authors as Author[];
}

export function searchPapers(query: string, limit = 5): Paper[] {
  const q = query.toLowerCase();
  const tokens = q.split(/\s+/).filter((t) => t.length > 2);

  const scored = (papers as Paper[])
    .map((p) => {
      const haystack = `${p.title} ${p.abstract} ${p.keywords.join(" ")}`.toLowerCase();
      const score = tokens.reduce((acc, t) => acc + (haystack.includes(t) ? 1 : 0), 0);
      return { paper: p, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map((x) => x.paper);
}
