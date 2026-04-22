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

| Tool | What it does |
|---|---|
| `kutip.research(query, budgetUSDC)` | Run a research query. Authors paid, citations attested on-chain. |
| `kutip.summary(queryId)` | Retrieve a past summary via reverse-x402 paywall. |
| `kutip.authors(limit, onlyClaimed)` | List claimed authors + their wallets. |

## Install

```bash
cd mcp
npm install
```

## Wire into Claude Desktop

Edit your Claude Desktop config:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

Add:

```json
{
  "mcpServers": {
    "kutip": {
      "command": "node",
      "args": ["F:/Hackathons/Hackathon Kite AI V2/Kutip/mcp/index.mjs"],
      "env": {
        "KUTIP_BASE_URL": "https://kutip-zeta.vercel.app"
      }
    }
  }
}
```

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
> Paid to authors: 0.0125 USDC · Mirror on Fuji: snowtrace.io/tx/0xef…

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
