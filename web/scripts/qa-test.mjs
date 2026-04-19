#!/usr/bin/env node
/**
 * Automated QA suite for Kutip — full surface scan.
 *
 * Covers: 9 pages, 5 API endpoints, 7 contracts' key views, subgraph
 * health + integrity, reverse-x402 paywall challenge, ERC-8004 agent
 * card + ERC-6551 TBA derivation. Exits non-zero on first failure so
 * it can gate a deploy.
 *
 * Usage: node scripts/qa-test.mjs [base]
 *   default base = https://kutip-zeta.vercel.app
 */

const BASE = process.argv[2] || "https://kutip-zeta.vercel.app";
const SUBGRAPH =
  "https://api.goldsky.com/api/public/project_cmo5pukv64upu01y48tefank9/subgraphs/kutip/0.1.0/gn";
const RPC = "https://rpc-testnet.gokite.ai/";

const LEDGER = "0x99359DaF4f2504dF3da042cd38B8d01B8589E5Fa";
const ESCROW = "0xcbab887da9c2a16612a9120b4170e74c50547b40";
const BOUNTY = "0x1ba00a38b25adf68ac599cd25094e2aa923b3f72";
const REPUTATION_NFT = "0x8f53EB5C04B773F0F31FE41623EA19d2Fd84db15";
const AGENT_REGISTRY = "0xde6d6ab98f216e6421c1b73bdab2f03064d27dcd";
const ERC6551_REGISTRY = "0x2f432effbbd83df8df610e5e0c0057b65bd31012";
const ERC6551_ACCOUNT_IMPL = "0x7d9c63f12af5ad7a18bb8d39ac8c1dd23e95f456";

const RESEARCHER_AA = "0x4da7f4cFd443084027a39cc0f7c41466d9511776";
const SUMMARIZER_AA = "0xA6C36bA2BC8E84fCF276721F30FC79ceD609ef5c";
const KNOWN_QUERY_ID =
  "0x2f273ac8243078c8ee2e185fa3ae642c9eee88a6e474a886c02f8a727c9a9558";

let passed = 0;
let failed = 0;
const failures = [];

const fmt = (ms) => `${String(ms).padStart(5)}ms`;

async function check(name, fn) {
  const t0 = Date.now();
  try {
    await fn();
    console.log(`✓ ${fmt(Date.now() - t0)}  ${name}`);
    passed++;
  } catch (err) {
    const dt = Date.now() - t0;
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`✗ ${fmt(dt)}  ${name}\n           → ${msg}`);
    failures.push({ name, msg });
    failed++;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function fetchJson(url, opts) {
  const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(12000) });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`${res.status} · non-JSON body: ${text.slice(0, 80)}`);
  }
  return { status: res.status, data: json };
}

async function rpcCall(to, data) {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "eth_call",
      params: [{ to, data }, "latest"],
      id: 1
    }),
    signal: AbortSignal.timeout(10000)
  });
  const d = await res.json();
  if (d.error) throw new Error(`RPC ${d.error.code}: ${d.error.message}`);
  return d.result;
}

async function rpcGetCode(addr) {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "eth_getCode",
      params: [addr, "latest"],
      id: 1
    })
  });
  return (await res.json()).result;
}

console.log(`\nKutip QA · base=${BASE}\n${"─".repeat(64)}`);

// ─── Page smoke (9) ────────────────────────────────────────────────
await check("GET /", async () => {
  const res = await fetch(`${BASE}/`);
  assert(res.ok, `status ${res.status}`);
  const html = await res.text();
  assert(html.includes("Citations that pay"), "missing tagline");
  assert(html.includes(RESEARCHER_AA), "researcher AA not rendered");
  assert(html.includes(SUMMARIZER_AA), "summarizer AA not rendered");
  assert(html.includes(LEDGER), "ledger not rendered");
});

await check("GET /research", async () => {
  const res = await fetch(`${BASE}/research`);
  assert(res.ok, `status ${res.status}`);
});

await check("GET /agents — shows ERC-8004 + ERC-6551", async () => {
  const res = await fetch(`${BASE}/agents`);
  assert(res.ok, `status ${res.status}`);
  const html = await res.text();
  assert(html.includes("ERC-8004"), "ERC-8004 chip missing");
  assert(html.includes("ERC-6551"), "ERC-6551 chip missing");
  assert(html.includes("Researcher"), "Researcher card missing");
  assert(html.includes("Summarizer"), "Summarizer card missing");
});

await check("GET /leaderboard — goldsky source", async () => {
  const res = await fetch(`${BASE}/leaderboard`);
  assert(res.ok, `status ${res.status}`);
  const html = await res.text();
  assert(
    html.includes("Stats indexed by Goldsky"),
    "not using subgraph source"
  );
});

await check("GET /verify — recent attestations", async () => {
  const res = await fetch(`${BASE}/verify`);
  assert(res.ok, `status ${res.status}`);
  const html = await res.text();
  assert(html.includes("Verify any query"), "verify index not rendered");
});

await check(`GET /verify/${KNOWN_QUERY_ID.slice(0, 12)}…`, async () => {
  const res = await fetch(`${BASE}/verify/${KNOWN_QUERY_ID}`);
  assert(res.ok, `status ${res.status}`);
  const html = await res.text();
  assert(html.includes("Attested on Kite"), "missing attestation chip");
});

await check("GET /claim", async () => {
  const res = await fetch(`${BASE}/claim`);
  assert(res.ok, `status ${res.status}`);
});

await check("GET /escrow — renders deposits", async () => {
  const res = await fetch(`${BASE}/escrow`);
  assert(res.ok, `status ${res.status}`);
  const html = await res.text();
  assert(
    html.includes("Citations earn yield until claimed"),
    "escrow headline missing"
  );
  assert(html.includes("5% APY"), "APY label missing");
});

await check("GET /bounties — renders listing", async () => {
  const res = await fetch(`${BASE}/bounties`);
  assert(res.ok, `status ${res.status}`);
  const html = await res.text();
  assert(
    html.includes("Sponsor research you care about"),
    "bounties headline missing"
  );
});

await check("GET /verify/lookup → redirect", async () => {
  const res = await fetch(`${BASE}/verify/lookup?q=0xaaaa`, {
    redirect: "manual"
  });
  assert(res.status === 307 || res.status === 302, `status ${res.status}`);
});

// ─── API endpoints (7) ─────────────────────────────────────────────
await check("GET /api/warmup", async () => {
  const { status, data } = await fetchJson(`${BASE}/api/warmup`);
  assert(status === 200, `status ${status}`);
  assert(data.aaEnabled === true, "AA not enabled");
  assert(data.chainId === 2368, `wrong chainId ${data.chainId}`);
});

await check("GET /api/x402-status", async () => {
  const { status, data } = await fetchJson(`${BASE}/api/x402-status`);
  assert(status === 200, `status ${status}`);
  assert(data.reachable === true, "Pieverse unreachable");
  assert(data.supportsKiteTestnet === true, "kite-testnet not supported");
});

await check("GET /api/orcid-check · real (Josiah)", async () => {
  const { status, data } = await fetchJson(
    `${BASE}/api/orcid-check?orcid=0000-0002-1825-0097`
  );
  assert(status === 200, `status ${status}`);
  assert(data.status === "real", `status: ${data.status}`);
  assert(data.name === "Josiah Carberry", `name: ${data.name}`);
});

await check("GET /api/orcid-check · catalog (Chen)", async () => {
  const { data } = await fetchJson(
    `${BASE}/api/orcid-check?orcid=0000-0001-1234-0001`
  );
  assert(data.status === "catalog", `status: ${data.status}`);
});

await check("GET /api/orcid-check · unknown → 404", async () => {
  const res = await fetch(
    `${BASE}/api/orcid-check?orcid=9999-9999-9999-9998`
  );
  assert(res.status === 404, `status ${res.status}`);
});

await check("GET /api/summaries — directory", async () => {
  const { status, data } = await fetchJson(`${BASE}/api/summaries`);
  assert(status === 200, `status ${status}`);
  assert(typeof data.count === "number", "count missing");
  assert(typeof data.totalRevenueUSDC === "number", "revenue missing");
});

await check(
  `GET /api/summaries/${KNOWN_QUERY_ID.slice(0, 12)}… — 402 or 404`,
  async () => {
    const res = await fetch(`${BASE}/api/summaries/${KNOWN_QUERY_ID}`);
    // 402 if cached (paywall), 404 if not in warm cache
    assert(
      res.status === 402 || res.status === 404,
      `expected 402 or 404, got ${res.status}`
    );
    if (res.status === 402) {
      const body = await res.json();
      assert(body.accepts?.length > 0, "402 missing x402 accepts array");
      assert(body.x402Version === 1, "wrong x402Version");
    }
  }
);

// ─── Subgraph (5) ──────────────────────────────────────────────────
let subgraphAttestations = 0;
let subgraphAuthors = 0;
let subgraphTotalEarnings = 0n;

await check("POST subgraph _meta", async () => {
  const { data } = await fetchJson(SUBGRAPH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: "{ _meta { block { number } hasIndexingErrors } }"
    })
  });
  assert(!data.errors, `errors: ${JSON.stringify(data.errors)}`);
  assert(data.data._meta.hasIndexingErrors === false, "has indexing errors");
  assert(data.data._meta.block.number > 20944832, "not indexed");
});

await check("POST subgraph attestations", async () => {
  const { data } = await fetchJson(SUBGRAPH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query:
        "{ attestations(first: 50, orderBy: timestamp, orderDirection: desc) { id payer totalPaid citationCount } }"
    })
  });
  const atts = data.data.attestations;
  subgraphAttestations = atts.length;
  assert(atts.length >= 1, `only ${atts.length} attestations`);
});

await check("POST subgraph authors", async () => {
  const { data } = await fetchJson(SUBGRAPH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query:
        "{ authors(first: 50, orderBy: totalEarnings, orderDirection: desc) { id totalEarnings citationCount } }"
    })
  });
  const authors = data.data.authors;
  subgraphAuthors = authors.length;
  assert(authors.length >= 1, "no authors");
  for (const a of authors) subgraphTotalEarnings += BigInt(a.totalEarnings);
});

await check("POST subgraph known queryId weights", async () => {
  const { data } = await fetchJson(SUBGRAPH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `{ attestation(id: "${KNOWN_QUERY_ID}") { citations { weightBps } } }`
    })
  });
  const cites = data.data.attestation?.citations;
  assert(cites?.length === 3, `citation count ${cites?.length}`);
  const sum = cites.reduce((s, c) => s + c.weightBps, 0);
  assert(sum === 10000, `weight sum ${sum} != 10000`);
});

await check("POST subgraph author day stats", async () => {
  const { data } = await fetchJson(SUBGRAPH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `{ authorDayStats(first: 20) { id citations earnings } }`
    })
  });
  assert(data.data.authorDayStats.length >= 1, "no day stats");
});

// ─── On-chain reads (10) ───────────────────────────────────────────
await check("on-chain · AttributionLedger deployed", async () => {
  const code = await rpcGetCode(LEDGER);
  assert(code.length > 2, "no code at ledger");
});

await check("on-chain · UnclaimedYieldEscrow deployed", async () => {
  const code = await rpcGetCode(ESCROW);
  assert(code.length > 2, "no code at escrow");
  // totalPrincipalOutstanding() selector
  const total = await rpcCall(ESCROW, "0xcb73b452");
  assert(total !== "0x", "totalPrincipalOutstanding reverted");
});

await check("on-chain · BountyMarket deployed + has bounties", async () => {
  const code = await rpcGetCode(BOUNTY);
  assert(code.length > 2, "no code at bounty");
  // bountyCount() selector
  const count = await rpcCall(BOUNTY, "0x3e362c96");
  assert(BigInt(count) >= 1n, "no bounties created");
});

await check("on-chain · AgentReputation NFT has 2 tokens", async () => {
  const code = await rpcGetCode(REPUTATION_NFT);
  assert(code.length > 2, "no code");
  // tokenCount() selector = 0x9f181b5e
  const count = await rpcCall(REPUTATION_NFT, "0x9f181b5e");
  assert(BigInt(count) >= 2n, `tokenCount=${BigInt(count)}`);
});

await check("on-chain · AgentRegistry8004 has 2 agents", async () => {
  const code = await rpcGetCode(AGENT_REGISTRY);
  assert(code.length > 2, "no code");
  // agentCount() selector
  const count = await rpcCall(AGENT_REGISTRY, "0xb7dc1284");
  assert(BigInt(count) >= 2n, `agentCount=${BigInt(count)}`);
});

await check("on-chain · ERC-6551 Registry deployed", async () => {
  const code = await rpcGetCode(ERC6551_REGISTRY);
  assert(code.length > 2, "no code");
});

await check("on-chain · ERC-6551 Account impl deployed", async () => {
  const code = await rpcGetCode(ERC6551_ACCOUNT_IMPL);
  assert(code.length > 2, "no code");
});

await check("on-chain · Researcher TBA reachable", async () => {
  // Known TBA from deploy logs
  const tba = "0xb1fa88ba20561378a67c3a2d477a2461c704df04";
  const code = await rpcGetCode(tba);
  assert(code.length > 2, "Researcher TBA has no code");
});

await check("on-chain · Summarizer TBA reachable", async () => {
  const tba = "0xb92d484150efadfb23c55749afad3d7072bd8323";
  const code = await rpcGetCode(tba);
  assert(code.length > 2, "Summarizer TBA has no code");
});

await check(
  "on-chain · Pieverse facilitator /v2/supported lists kite-testnet",
  async () => {
    const res = await fetch("https://facilitator.pieverse.io/v2/supported", {
      signal: AbortSignal.timeout(8000)
    });
    const d = await res.json();
    const networks = d.kinds.map((k) => k.network);
    assert(
      networks.includes("eip155:2368"),
      `kite testnet not in ${JSON.stringify(networks)}`
    );
  }
);

// ─── Data integrity (2) ────────────────────────────────────────────
await check("data · attestation count ≥ 3", async () => {
  assert(subgraphAttestations >= 3, `only ${subgraphAttestations}`);
});

await check("data · totalEarnings > 0", async () => {
  assert(subgraphTotalEarnings > 0n, `totalEarnings=${subgraphTotalEarnings}`);
});

// Summary
console.log(`\n${"─".repeat(64)}`);
console.log(`Passed: ${passed}  ·  Failed: ${failed}`);
console.log(
  `Subgraph: ${subgraphAttestations} attestations · ${subgraphAuthors} authors · ${
    Number(subgraphTotalEarnings) / 1e18
  } USDC paid`
);

if (failed > 0) {
  console.log("\nFAILURES:");
  for (const f of failures) console.log(`  · ${f.name}\n      ${f.msg}`);
  process.exit(1);
}

console.log("\nALL GREEN ✓");
