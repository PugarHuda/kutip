# Integrate with Kutip

Kutip is **infrastructure**, not just an app. The same research agent
that powers the website is reachable from your own code, an autonomous
agent, or any MCP client — and every call still pays the cited authors
on-chain.

Three ways in:

1. **REST API** — `POST /api/query`, a streaming endpoint.
2. **MCP server** — drop Kutip into Claude Desktop / Cursor / Cline.
3. **Self-host** — fork and point the clients at your own deployment.

Base URL of the public demo: `https://kutip-zeta.vercel.app`

---

## 1. REST API — `POST /api/query`

Runs the full agent (search → x402 → read → attribute → settle) and
**streams progress** back as Server-Sent Events.

### Request

```
POST /api/query
Content-Type: application/json
```

```jsonc
{
  "query": "direct air capture cost reduction",  // 5–500 chars
  "budgetUSDC": 0.5,                              // 0.1–20 (anonymous: ≤ 0.5)
  "yearFrom": 2020,                               // optional
  "yearTo": 2024,                                 // optional
  "session": { /* optional signed SpendingIntent — see Architecture */ }
}
```

Without a `session`, the budget is capped at **0.5 USDT** (anonymous
abuse fence). A signed session lifts the cap to the user's own limits.

### Response — Server-Sent Events

`Content-Type: text/event-stream`. Each line is `data: <json>`:

```jsonc
{ "type": "step",   "step": { "step": 1, "label": "Searching…", "status": "running" } }
{ "type": "step",   "step": { "step": 1, "label": "Searching…", "status": "done", "detail": "10 papers" } }
{ "type": "result", "result": { /* summary, paperDetails, attestationTx, … */ } }
{ "type": "error",  "message": "…" }
```

Consume it incrementally — the five `step` events are how the UI draws
the live progress bar. The final `result` carries the summary, the
per-author split, and the on-chain `attestationTx`.

### curl

```bash
curl -N -X POST https://kutip-zeta.vercel.app/api/query \
  -H 'Content-Type: application/json' \
  -d '{"query":"perovskite tandem solar cell efficiency","budgetUSDC":0.2,"yearFrom":2023}'
```

### Authentication

- **Browser callers** are gated by an `Origin` allowlist (CORS).
- **Server / agent / curl callers** (no `Origin`) are allowed by
  default. If the deployment sets a `KUTIP_API_KEY`, those callers must
  send a matching `X-Kutip-API-Key` header. The public demo runs
  without a key — set one on your own deployment to gate it.

## 2. MCP server

The `mcp/` package bridges Kutip to the **Model Context Protocol**, so
any MCP client (Claude Desktop, Cursor, Cline) can call the agent as a
native tool.

| Tool | Purpose |
|---|---|
| `kutip.research(query, budgetUSDC)` | Run a query — authors paid, citations attested on-chain |
| `kutip.summary(queryId)` | Retrieve a past summary via the reverse-x402 paywall |
| `kutip.authors(limit, onlyClaimed)` | List claimed authors + wallets |

Setup is one block in `claude_desktop_config.json` — full instructions
and the schema in **[`mcp/README.md`](../mcp/README.md)**.

## 3. Reverse-x402 — agents that cite Kutip pay Kutip

`GET /api/summaries/{queryId}` serves a cached summary behind a
**reverse-x402 paywall**. When another agent re-cites a Kutip answer it
pays Kutip, and Kutip forwards that to the original authors. This closes
the loop: Kutip pays humans → other agents pay Kutip → Kutip pays humans.

It is the same x402 spec used to *buy* papers, run in the other
direction — Kutip as a paid data source for the wider agent economy.

## 4. Self-host

```bash
git clone https://github.com/PugarHuda/kutip
cd kutip/web && npm install
cp ../.env.example .env   # fill in the keys
npm run dev
```

Contracts are already live on Kite testnet (see [Deployment](deployment.md));
to redeploy your own, run the Foundry script in `contracts/`. Point
`KUTIP_BASE_URL` (MCP) or your API calls at the new deployment.

---

## What every integration guarantees

However you call Kutip, the agent contract holds:

1. It never reads a paid paper without completing x402 payment first.
2. It attests citations **after** summarising, **before** returning.
3. The revenue split is one atomic on-chain transaction.
4. It **fails closed** — if the attestation reverts, you get an error,
   never an unpaid summary.

See the [Security model](security.md) for what is enforced on-chain.
