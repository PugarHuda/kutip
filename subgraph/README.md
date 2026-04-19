# Kutip Subgraph

Indexes `AttributionLedger` events on Kite testnet so the web app can read
historical data in milliseconds instead of scanning 20M blocks on every request.

## Entities

| Entity | What it tracks |
|---|---|
| `Query` | One row per `QueryAttested`. Payer, total paid, citation count, tx hash. |
| `Citation` | One row per `CitationPaid`. Weight bps, amount, author link. |
| `Author` | Aggregate per wallet. `totalEarnings`, `citationCount`, first/last seen. |
| `DayStat` | Global daily aggregate (UTC days): queries attested, citations paid, total paid. |
| `AuthorDayStat` | Per-author daily aggregate for 7-day sparklines on the leaderboard. |

## First-time deploy (user action)

```bash
# 1. Install Goldsky CLI
curl https://goldsky.com | sh

# 2. Authenticate (opens browser)
goldsky login

# 3. From subgraph/ directory
cd subgraph
pnpm install                          # gets graph-cli + graph-ts
pnpm run codegen                      # generates types from ABI + schema
pnpm run build                        # compiles wasm
pnpm run deploy                       # deploys as kutip/0.1.0

# 4. Paste the served GraphQL endpoint into web/.env as:
# NEXT_PUBLIC_SUBGRAPH_URL=https://api.goldsky.com/api/public/.../subgraphs/kutip/0.1.0/gn
```

## Quick deploy (skip codegen)

Goldsky can auto-derive from ABI for trivial indexers:

```bash
pnpm run deploy-quick
```

This uses `--from-abi` and creates a generic subgraph without our custom
`DayStat` / `AuthorDayStat` aggregates. Use the full `deploy` command
for the richer schema.

## Example queries

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

# 7-day sparkline for one author
{
  authorDayStats(
    where: { author: "0x1111111111111111111111111111111111111111" }
    orderBy: date
    orderDirection: desc
    first: 7
  ) {
    date
    citations
    earnings
  }
}

# Recent attestations (replaces /api/verify index RPC scan)
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

Then `pnpm run deploy` again — Goldsky will re-index from the new block.
