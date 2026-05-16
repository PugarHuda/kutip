# Kutip MCP Server

Expose Kutip's research agent as a tool any MCP client can invoke —
Claude Desktop, Cursor, Cline, and any future MCP-compatible LLM app.

## What it does

Bridges the Model Context Protocol (stdio) to Kutip's HTTP API, so
when you ask Claude Desktop "Cari paper carbon capture terbaru" it can
call `kutip.research()` natively, and the full Kutip flow runs:
search → x402 per-paper → summarise → attest on Kite → mirror to Fuji
→ return citations + tx hashes straight into the chat.

## Tools

| Tool | Description |
|---|---|
| `kutip.research(query, budgetUSDC)` | Run a research query. Authors paid, citations attested on-chain. |
| `kutip.summary(queryId)` | Retrieve a past summary via reverse-x402 paywall. |
| `kutip.authors(limit, onlyClaimed)` | List claimed authors + their wallets. |

### `kutip.research`

Inputs: `{ query: string, budgetUSDC: number }` · default `budgetUSDC: 0.1`.

Returns text payload (formatted for chat) plus structured fields:

```json
{
  "queryId": "0x2e39f84f…ffb2d",
  "summary": "In 2024, the most prominent carbon capture methods…",
  "citations": [
    {
      "paperId": "p001",
      "title": "Direct air capture at scale: progress, challenges…",
      "authors": [
        { "name": "Dr. Sarah Chen",     "wallet": "0x9810…2513", "weight": 5000 },
        { "name": "Dr. Marcus Hoffmann", "wallet": "0x519F…3392", "weight": 5000 }
      ],
      "weight": 5000
    }
  ],
  "totalPaidUSDC": "0.10",
  "kiteTx": "https://testnet.kitescan.ai/tx/0xf871…35b6",
  "mirrorTx": "https://testnet.snowtrace.io/tx/0x0815…8a22",
  "kitePassRule": { "dailyUsed": "0.10", "dailyBudget": "10.00", "perTxCap": "2.00" }
}
```

### `kutip.summary`

Input: `{ queryId: string }`. Caches the answer behind a reverse-x402 paywall —
external agents that re-cite Kutip pay Kutip, which pays the original authors.
Returns the cached `summary` + `citations` if access is already settled, or
a `paymentRequired` payload otherwise.

### `kutip.authors`

Inputs: `{ limit?: number, onlyClaimed?: boolean }`. Returns leaderboard rows:

```json
[
  { "rank": 1, "wallet": "0xcBab…7B40", "name": "Dr. Sarah Chen",
    "earningsUSDC": "1.24", "citations": 57, "orcidBound": true }
]
```

## Install

```bash
cd mcp
npm install
```

## Wire into Claude Desktop

Edit your Claude Desktop config:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

Add (replace `<path-to-repo>` with the absolute path to your Kutip clone):

```json
{
  "mcpServers": {
    "kutip": {
      "command": "node",
      "args": ["<path-to-repo>/mcp/index.mjs"],
      "env": {
        "KUTIP_BASE_URL": "https://kutip-zeta.vercel.app",
        "KUTIP_API_KEY": "optional — required only if the upstream Kutip deployment gates /api/query"
      }
    }
  }
}
```

Point `KUTIP_BASE_URL` at your own deployment if you forked. The
`KUTIP_API_KEY` is only required when the target deployment has its
own `KUTIP_API_KEY` env set — otherwise leave it unset.

Restart Claude Desktop. The Kutip tools should appear when you type `/`
or ask something research-oriented. The agent decides when to call
`kutip.research` based on the tool description.

## Example chat

> **You:** research the latest progress on direct air capture cost reduction
>
> **Claude:** *calls `kutip.research({ query: "...", budgetUSDC: 0.1 })`*
>
> *After ~15s:*
>
> Based on Kutip's citation ledger, three recent papers converge on...
> [summary with [1] [2] [3] cite pills]
>
> Attestation: testnet.kitescan.ai/tx/0xabcd…
> Paid to authors: 0.0125 USDT · Mirror on Fuji: snowtrace.io/tx/0xef…

## Why this matters for the hackathon

Kite AI's ecosystem is heavily MCP-oriented. Having Kutip accessible via
MCP means:
- Agents beyond Kutip's own UI can invoke it
- Kutip fits Kite's "agentic commerce" thesis — agents discover and pay
  each other via standard protocols
- Judges can install + test the tool from Claude Desktop without leaving
  their IDE

## License

MIT
