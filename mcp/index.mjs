#!/usr/bin/env node
/**
 * Kutip MCP server — exposes the research agent as a tool any MCP client
 * (Claude Desktop, Cursor, Cline, etc.) can invoke directly.
 *
 * Tools advertised:
 *   - kutip.research(query, budgetUSDC) → summary + citations + tx hashes
 *   - kutip.summary(queryId) → retrieve a past summary by id (reverse x402)
 *   - kutip.authors() → list claimed authors with their wallet + ORCID
 *
 * Install in Claude Desktop config
 * (~/Library/Application Support/Claude/claude_desktop_config.json on mac,
 * %APPDATA%/Claude on Windows):
 *
 *   "mcpServers": {
 *     "kutip": {
 *       "command": "node",
 *       "args": ["<absolute-path-to>/mcp/index.mjs"],
 *       "env": { "KUTIP_BASE_URL": "https://kutip-zeta.vercel.app" }
 *     }
 *   }
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";

const BASE = process.env.KUTIP_BASE_URL ?? "https://kutip-zeta.vercel.app";

const server = new Server(
  { name: "kutip", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

const tools = [
  {
    name: "kutip.research",
    description:
      "Run a research query through Kutip's autonomous agent. Pays cited authors in USDC on Kite testnet. Returns summary + citations + on-chain attestation tx hash.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", minLength: 5, maxLength: 500 },
        budgetUSDC: {
          type: "number",
          minimum: 0.1,
          maximum: 20,
          default: 0.1
        }
      },
      required: ["query"]
    }
  },
  {
    name: "kutip.summary",
    description:
      "Retrieve a past Kutip summary by queryId. Triggers reverse x402 paywall — caller agent pays Kutip to access. Returns 402 challenge first, then content on settled payment.",
    inputSchema: {
      type: "object",
      properties: {
        queryId: {
          type: "string",
          pattern: "^0x[a-fA-F0-9]{64}$"
        }
      },
      required: ["queryId"]
    }
  },
  {
    name: "kutip.authors",
    description:
      "List authors who have claimed their ORCID bindings with their wallet and earnings.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", default: 50 },
        onlyClaimed: { type: "boolean", default: false }
      }
    }
  }
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  if (name === "kutip.research") return runResearch(args);
  if (name === "kutip.summary") return getSummary(args);
  if (name === "kutip.authors") return listAuthors(args);
  throw new Error(`Unknown tool: ${name}`);
});

async function runResearch({ query, budgetUSDC = 0.1 }) {
  const res = await fetch(`${BASE}/api/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, budgetUSDC })
  });
  if (!res.body) throw new Error("No response body from Kutip");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result = null;
  let lastError = null;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const msgs = buffer.split("\n\n");
    buffer = msgs.pop() ?? "";
    for (const m of msgs) {
      if (!m.startsWith("data: ")) continue;
      const ev = JSON.parse(m.slice(6));
      if (ev.type === "result") result = ev.result;
      if (ev.type === "error") lastError = ev.message;
    }
  }
  if (lastError) {
    return {
      content: [{ type: "text", text: `Kutip error: ${lastError}` }],
      isError: true
    };
  }
  if (!result) {
    return {
      content: [{ type: "text", text: "Kutip returned no result" }],
      isError: true
    };
  }
  const cites = result.paperDetails
    .map((p, i) => `[${i + 1}] ${p.title} — ${p.journalYear}`)
    .join("\n");
  const lines = [
    result.summary,
    "",
    "Citations:",
    cites,
    "",
    `Attestation: https://testnet.kitescan.ai/tx/${result.attestationTx}`
  ];
  if (result.mirrorExplorer) lines.push(`Mirror on Avalanche Fuji: ${result.mirrorExplorer}`);
  if (result.sessionId) {
    lines.push(
      `Session: ${result.sessionId} · delegator ${result.sessionDelegator}`
    );
  }
  lines.push(
    `Total paid to authors: ${(result.totalPaidUSDC * 0.4 / 1e18).toFixed(4)} USDC`
  );
  return { content: [{ type: "text", text: lines.join("\n") }] };
}

async function getSummary({ queryId }) {
  const res = await fetch(`${BASE}/api/summaries/${queryId}`);
  const body = await res.json();
  if (res.status === 402) {
    return {
      content: [
        {
          type: "text",
          text: [
            `Kutip paywall challenge (reverse x402):`,
            ``,
            `queryId: ${queryId}`,
            `price: ${body.accepts?.[0]?.maxAmountRequired ?? "unknown"} (smallest units)`,
            `payTo: ${body.accepts?.[0]?.payTo ?? "unknown"}`,
            `network: ${body.accepts?.[0]?.network ?? "unknown"}`,
            ``,
            `Settle via Pieverse facilitator, then retry with X-PAYMENT header.`
          ].join("\n")
        }
      ]
    };
  }
  if (res.status === 404) {
    return {
      content: [{ type: "text", text: `Unknown queryId: ${body.hint ?? ""}` }],
      isError: true
    };
  }
  return {
    content: [{ type: "text", text: JSON.stringify(body, null, 2) }]
  };
}

async function listAuthors({ limit = 50, onlyClaimed = false }) {
  const res = await fetch(`${BASE}/api/claim`);
  const body = await res.json();
  let claims = body.claims ?? [];
  if (onlyClaimed) claims = claims.filter((c) => c.wallet);
  claims = claims.slice(0, limit);
  const txt = claims.length
    ? claims
        .map(
          (c, i) =>
            `${i + 1}. ORCID ${c.orcid} → ${c.wallet} (signed ${c.signedAt})`
        )
        .join("\n")
    : "No claimed authors yet.";
  return {
    content: [
      {
        type: "text",
        text: `Kutip author claims:\n\n${txt}\n\nFull registry: ${BASE}/leaderboard`
      }
    ]
  };
}

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[kutip-mcp] listening on stdio · base=" + BASE);
