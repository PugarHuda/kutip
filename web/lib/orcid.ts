/**
 * ORCID public API adapter.
 *
 * Real researcher records live at https://pub.orcid.org/v3.0/{orcid}.
 * We hit it as part of the `/claim` flow to prove the ORCID actually
 * exists and fetch the display name that gets shown in the receipt.
 *
 * Strategy:
 *   1. Try ORCID public API. If 200, return researcher info + real=true.
 *   2. If 404, fall back to our local catalog (data/authors.json).
 *      This keeps demo claims working against the mock ORCIDs while
 *      still rewarding real-world claims with on-chain verification.
 *   3. If both fail, reject.
 *
 * Rate limiting: ORCID allows ~24 req/sec for unauthenticated public
 * API. We cache 24h per-process to stay well under.
 */

export interface OrcidLookupResult {
  orcid: string;
  exists: boolean;
  real: boolean;
  name?: string;
  biography?: string;
  worksCount?: number;
  error?: string;
}

interface CachedLookup {
  at: number;
  result: OrcidLookupResult;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const globalKey = "__KUTIP_ORCID_CACHE__";
type GlobalWithCache = typeof globalThis & {
  [globalKey]?: Map<string, CachedLookup>;
};

function cache(): Map<string, CachedLookup> {
  const g = globalThis as GlobalWithCache;
  if (!g[globalKey]) g[globalKey] = new Map<string, CachedLookup>();
  return g[globalKey]!;
}

export function normalizeOrcid(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}

const ORCID_PATTERN = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/;

export function isValidOrcidFormat(raw: string): boolean {
  return ORCID_PATTERN.test(normalizeOrcid(raw));
}

interface OrcidApiResponse {
  "orcid-identifier"?: { path?: string };
  person?: {
    name?: {
      "given-names"?: { value?: string };
      "family-name"?: { value?: string };
      "credit-name"?: { value?: string };
    };
    biography?: { content?: string };
  };
  "activities-summary"?: {
    works?: { group?: unknown[] };
  };
}

export async function lookupOrcid(raw: string): Promise<OrcidLookupResult> {
  const orcid = normalizeOrcid(raw);
  if (!isValidOrcidFormat(orcid)) {
    return { orcid, exists: false, real: false, error: "invalid format" };
  }

  const cached = cache().get(orcid);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.result;
  }

  try {
    const res = await fetch(`https://pub.orcid.org/v3.0/${orcid}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5000)
    });

    if (res.status === 404) {
      const result: OrcidLookupResult = {
        orcid,
        exists: false,
        real: false
      };
      cache().set(orcid, { at: Date.now(), result });
      return result;
    }

    if (!res.ok) {
      return { orcid, exists: false, real: false, error: `HTTP ${res.status}` };
    }

    const data = (await res.json()) as OrcidApiResponse;
    const name = data.person?.name;
    const credit = name?.["credit-name"]?.value;
    const given = name?.["given-names"]?.value;
    const family = name?.["family-name"]?.value;
    const display = credit ?? [given, family].filter(Boolean).join(" ").trim();

    const result: OrcidLookupResult = {
      orcid,
      exists: true,
      real: true,
      name: display || undefined,
      biography: data.person?.biography?.content ?? undefined,
      worksCount: data["activities-summary"]?.works?.group?.length ?? 0
    };
    cache().set(orcid, { at: Date.now(), result });
    return result;
  } catch (err) {
    return {
      orcid,
      exists: false,
      real: false,
      error: err instanceof Error ? err.message : "fetch failed"
    };
  }
}
