/**
 * Goldsky subgraph GraphQL client.
 *
 * The subgraph indexes AttributionLedger events on Kite testnet and exposes
 * Query, Citation, Author, DayStat, AuthorDayStat entities. Deploying it
 * turns the leaderboard + /verify index from O(n) RPC scans (~1-3s) into
 * O(log n) GraphQL reads (~50-200ms) and unlocks real 7-day history
 * sparklines.
 *
 * Wiring: set `NEXT_PUBLIC_SUBGRAPH_URL` to the Goldsky GraphQL endpoint
 * after deploy. When unset, every caller below returns null so the page
 * falls back to the RPC path. Never throws — page must keep working.
 */

export function getSubgraphUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_SUBGRAPH_URL?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.toString();
  } catch {
    return null;
  }
}

export function isSubgraphEnabled(): boolean {
  return getSubgraphUrl() !== null;
}

async function query<T>(body: { query: string; variables?: Record<string, unknown> }): Promise<T | null> {
  const url = getSubgraphUrl();
  if (!url) return null;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      next: { revalidate: 15 },
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: T; errors?: unknown };
    if (json.errors) {
      console.warn("[goldsky] GraphQL errors:", json.errors);
      return null;
    }
    return json.data ?? null;
  } catch (err) {
    console.warn("[goldsky] query failed:", err);
    return null;
  }
}

export interface GoldskyAuthor {
  id: string;
  totalEarnings: string;
  citationCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface GoldskyAttestation {
  id: string;
  payer: string;
  totalPaid: string;
  authorsShare: string;
  citationCount: number;
  block: string;
  timestamp: string;
  tx: string;
}

export interface GoldskyDayStat {
  id: string;
  date: string;
  queriesAttested: number;
  citationsPaid: number;
  totalPaid: string;
}

export interface GoldskyAuthorDayStat {
  id: string;
  date: string;
  citations: number;
  earnings: string;
}

export async function fetchLeaderboardFromGoldsky(
  limit = 25
): Promise<GoldskyAuthor[] | null> {
  const data = await query<{ authors: GoldskyAuthor[] }>({
    query: `
      query Leaderboard($limit: Int!) {
        authors(first: $limit, orderBy: totalEarnings, orderDirection: desc) {
          id
          totalEarnings
          citationCount
          firstSeenAt
          lastSeenAt
        }
      }
    `,
    variables: { limit }
  });
  return data?.authors ?? null;
}

export async function fetchRecentAttestationsFromGoldsky(
  limit = 20
): Promise<GoldskyAttestation[] | null> {
  const data = await query<{ attestations: GoldskyAttestation[] }>({
    query: `
      query Recent($limit: Int!) {
        attestations(first: $limit, orderBy: timestamp, orderDirection: desc) {
          id
          payer
          totalPaid
          authorsShare
          citationCount
          block
          timestamp
          tx
        }
      }
    `,
    variables: { limit }
  });
  return data?.attestations ?? null;
}

/** Aggregates earnings + citations per author from authorDayStats within a day range. */
export async function fetchLeaderboardWindowedFromGoldsky(
  days: number
): Promise<GoldskyAuthor[] | null> {
  const cutoff = Math.floor(Date.now() / 1000 / 86400) - days;
  const data = await query<{
    authorDayStats: {
      author: { id: string };
      date: number;
      earnings: string;
      citations: string;
    }[];
  }>({
    query: `
      query Windowed($cutoff: Int!) {
        authorDayStats(
          where: { date_gte: $cutoff }
          first: 1000
          orderBy: date
          orderDirection: desc
        ) {
          author { id }
          date
          earnings
          citations
        }
      }
    `,
    variables: { cutoff }
  });
  if (!data) return null;

  const agg = new Map<string, { earnings: bigint; citations: number; last: number }>();
  for (const d of data.authorDayStats) {
    const prev = agg.get(d.author.id) ?? { earnings: 0n, citations: 0, last: 0 };
    agg.set(d.author.id, {
      earnings: prev.earnings + BigInt(d.earnings),
      citations: prev.citations + Number(d.citations),
      last: Math.max(prev.last, d.date * 86400)
    });
  }
  return Array.from(agg.entries()).map(([id, v]) => ({
    id,
    totalEarnings: v.earnings.toString(),
    citationCount: v.citations,
    firstSeenAt: "0",
    lastSeenAt: String(v.last)
  }));
}

export async function fetchAuthorHistoryFromGoldsky(
  authorId: string,
  days = 7
): Promise<GoldskyAuthorDayStat[] | null> {
  const data = await query<{ authorDayStats: GoldskyAuthorDayStat[] }>({
    query: `
      query AuthorHistory($author: Bytes!, $days: Int!) {
        authorDayStats(
          where: { author: $author }
          orderBy: date
          orderDirection: desc
          first: $days
        ) {
          id
          date
          citations
          earnings
        }
      }
    `,
    variables: { author: authorId.toLowerCase(), days }
  });
  return data?.authorDayStats ?? null;
}

export async function fetchGlobalDailyStatsFromGoldsky(
  days = 30
): Promise<GoldskyDayStat[] | null> {
  const data = await query<{ dayStats: GoldskyDayStat[] }>({
    query: `
      query DailyStats($days: Int!) {
        dayStats(orderBy: date, orderDirection: desc, first: $days) {
          id
          date
          queriesAttested
          citationsPaid
          totalPaid
        }
      }
    `,
    variables: { days }
  });
  return data?.dayStats ?? null;
}
