/**
 * OpenAlex adapter — live academic-paper discovery for the research agent.
 *
 * Why OpenAlex over Semantic Scholar for the live flow:
 *   - SS hard rate-limits unauthenticated traffic (429 after a burst).
 *   - OpenAlex's "polite pool" (a mailto in the request) is generous
 *     enough for interactive query traffic and needs no API key.
 *   - OpenAlex covers every discipline, so a user can ask about ANY
 *     topic — not just the seeded carbon-capture catalog — and get
 *     real papers back.
 *
 * Every fetch carries an AbortSignal timeout so a slow/stuck upstream
 * can never freeze the agent's step-1 animation: on timeout the call
 * throws, the agent catches it, and falls back to the local catalog.
 *
 * Runtime-discovered authors get a deterministic synthetic wallet
 * (keccak of their name) — a placeholder that holds their share until
 * they claim their ORCID, same model as the seeded catalog.
 */

import { keccak256, toBytes, type Address } from "viem";
import type { Author, Paper } from "./papers";

const OA_URL = "https://api.openalex.org/works";
const OA_SELECT =
  "id,doi,title,publication_year,authorships,abstract_inverted_index,primary_location";
const FETCH_TIMEOUT_MS = 8000;

export function isOpenAlexEnabled(): boolean {
  // On by default — no key required. Set KUTIP_DISABLE_OPENALEX=1 to
  // force the local-catalog-only path (useful for offline demos).
  return process.env.KUTIP_DISABLE_OPENALEX !== "1";
}

interface OAAuthorship {
  author?: { display_name?: string; orcid?: string | null };
  institutions?: { display_name?: string }[];
}
interface OAWork {
  id?: string;
  doi?: string | null;
  title?: string | null;
  publication_year?: number | null;
  authorships?: OAAuthorship[];
  abstract_inverted_index?: Record<string, number[]> | null;
  primary_location?: { source?: { display_name?: string } | null } | null;
}

/** OpenAlex stores abstracts as a {word: [positions]} map for indexing. */
function abstractFromInverted(
  inverted: Record<string, number[]> | null | undefined
): string | null {
  if (!inverted) return null;
  const positions: [number, string][] = [];
  for (const [word, posList] of Object.entries(inverted)) {
    for (const pos of posList) positions.push([pos, word]);
  }
  positions.sort((a, b) => a[0] - b[0]);
  const text = positions.map(([, w]) => w).join(" ");
  return text.length > 600 ? text.slice(0, 597) + "…" : text;
}

function synthAuthorId(name: string): string {
  return `oa-author:${name.toLowerCase().replace(/\s+/g, "-").slice(0, 40)}`;
}

function synthWallet(name: string): Address {
  const hash = keccak256(toBytes(`kutip-author:${name.toLowerCase()}`));
  return `0x${hash.slice(26)}` as Address;
}

export async function searchOpenAlex(
  query: string,
  limit = 8
): Promise<{ papers: Paper[]; authors: Author[] }> {
  const url =
    `${OA_URL}?search=${encodeURIComponent(query)}` +
    `&per-page=${limit}` +
    `&filter=type:article,has_abstract:true` +
    `&select=${OA_SELECT}` +
    `&mailto=agent@kutip.app`;

  const res = await fetch(url, {
    headers: { "User-Agent": "kutip-research-agent/0.1 (agent@kutip.app)" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    next: { revalidate: 300 }
  });

  if (!res.ok) {
    throw new Error(`OpenAlex ${res.status}: ${await res.text().catch(() => "")}`);
  }

  const data = (await res.json()) as { results?: OAWork[] };
  const authorMap = new Map<string, Author>();
  const papers: Paper[] = [];

  for (const w of data.results ?? []) {
    const abstract = abstractFromInverted(w.abstract_inverted_index);
    if (!w.title || !abstract || !w.authorships?.length) continue;

    const paperAuthorIds: string[] = [];
    for (const a of w.authorships.slice(0, 3)) {
      const name = a.author?.display_name?.trim();
      if (!name) continue;
      const id = synthAuthorId(name);
      if (!authorMap.has(id)) {
        authorMap.set(id, {
          id,
          name,
          affiliation:
            a.institutions?.[0]?.display_name ?? "Real author · ORCID unclaimed",
          wallet: synthWallet(name),
          orcid: a.author?.orcid?.replace("https://orcid.org/", "") ?? ""
        });
      }
      paperAuthorIds.push(id);
    }
    if (paperAuthorIds.length === 0) continue;

    const oaId = (w.id ?? "").replace("https://openalex.org/", "");
    papers.push({
      id: `oa:${oaId.slice(0, 12)}`,
      doi: w.doi?.replace("https://doi.org/", "") ?? oaId,
      title: w.title.trim(),
      abstract,
      year: w.publication_year ?? new Date().getFullYear(),
      journal: w.primary_location?.source?.display_name ?? "Preprint",
      keywords: [],
      // micro-USDC (6 dp). Matches the seeded catalog's 0.03-0.05 band
      // so a default 0.1-USDC budget can afford 2-3 papers. The old
      // 400000 (0.4 USDC) priced every runtime paper out of reach →
      // 0 purchased → 0 citations → attestation reverted on
      // EmptyCitations.
      priceUSDC: 40000,
      authors: paperAuthorIds
    });
  }

  return { papers, authors: Array.from(authorMap.values()) };
}
