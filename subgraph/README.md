# Kutip Subgraph

Indexes `AttributionLedger` events on Kite testnet so the web app reads
historical data in milliseconds instead of scanning 20M blocks on every
request.

## Entities

| Entity | What it tracks |
|---|---|
| `Query` | One row per `QueryAttested`. Payer, total paid, citation count, tx. |
| `Citation` | One row per `CitationPaid`. Weight bps, amount, author link. |
| `Author` | Aggregate per wallet: `totalEarnings`, `citationCount`, first/last seen. |
| `DayStat` | Global daily aggregate (UTC days). |
| `AuthorDayStat` | Per-author daily aggregate — powers real 7-day sparklines. |

## First-time deploy

The Goldsky CLI + `graph-cli` both live on npm, so you don't need the
upstream bash installer on Windows.

```bash
# 1. Install toolchain (one-time)
cd subgraph
pnpm install

# 2. Authenticate to Goldsky (opens a browser OAuth page)
pnpm run login

# 3. Build
pnpm run codegen   # generates TS types from ABI + schema.graphql
pnpm run build     # compiles mapping.ts to WASM via AssemblyScript

# 4. Deploy as kutip/0.1.0 (prompts confirm on first deploy)
pnpm run deploy

# 5. Goldsky prints the live GraphQL endpoint — paste it into Kutip/.env:
# NEXT_PUBLIC_SUBGRAPH_URL=https://api.goldsky.com/api/public/.../subgraphs/kutip/0.1.0/gn

# 6. Push the new env var up to Vercel + redeploy
cd ..
pnpm run env:sync
cd web && bash scripts/push-vercel-env.sh && vercel deploy --prod --yes
```

## Re-deploy after iterating on schema/mapping

Bumps the version tag to force a fresh index from the contract's deploy
block. Use `kutip/0.1.1`, `kutip/0.2.0`, etc.

```bash
pnpm run codegen && pnpm run build
pnpm exec goldsky subgraph deploy kutip/0.1.1
```

## Smoke-test queries

Paste into the Goldsky GraphQL playground (URL is in your deploy output):

```graphql
# Leaderboard (top 10)
{
  authors(first: 10, orderBy: totalEarnings, orderDirection: desc) {
    id
    totalEarnings
    citationCount
    firstSeenAt
  }
}

# 7-day sparkline for one author (Dr. Chen)
{
  authorDayStats(
    where: { author: "0x1111111111111111111111111111111111111111" }
    orderBy: date orderDirection: desc first: 7
  ) {
    date
    citations
    earnings
  }
}

# Recent attestations (replaces /verify index RPC scan)
{
  queries(first: 20, orderBy: timestamp, orderDirection: desc) {
    id
    payer
    totalPaid
    citationCount
    timestamp
    tx
    citations { author { id } amount weightBps }
  }
}
```

## Re-deploy after contract redeploy

If `AttributionLedger` is redeployed (new address), update `subgraph.yaml`:

```yaml
source:
  address: "0x<new address>"
  startBlock: <new deploy block>
```

Then bump the version and `pnpm run deploy` again.
