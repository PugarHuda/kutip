#!/usr/bin/env node
/**
 * Automated QA suite for Kutip.
 *
 * Hits every integration point + every page + every API and asserts
 * the expected shape. Exits non-zero on the first failure so it can
 * gate a deploy. Intentionally paranoid — we'd rather a false-positive
 * than ship a broken judging day.
 *
 * Usage: node scripts/qa-test.mjs [base]
 *   default base = https://kutip-zeta.vercel.app
 */

const BASE = process.argv[2] || "https://kutip-zeta.vercel.app";
const SUBGRAPH =
  "https://api.goldsky.com/api/public/project_cmo5pukv64upu01y48tefank9/subgraphs/kutip/0.1.0/gn";
const LEDGER = "0x99359DaF4f2504dF3da042cd38B8d01B8589E5Fa";
const RESEARCHER_AA = "0x4da7f4cFd443084027a39cc0f7c41466d9511776";
const SUMMARIZER_AA = "0xA6C36bA2BC8E84fCF276721F30FC79ceD609ef5c";
const KNOWN_QUERY_ID =
  "0x2f273ac8243078c8ee2e185fa3ae642c9eee88a6e474a886c02f8a727c9a9558";

let passed = 0;
let failed = 0;
const failures = [];

function fmt(ms) {
  return `${ms.toString().padStart(5)}ms`;
}

async function check(name, fn) {
  const t0 = Date.now();
  try {
    await fn();
    const dt = Date.now() - t0;
    console.log(`✓ ${fmt(dt)}  ${name}`);
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

console.log(`\nKutip QA · base=${BASE}\n${"─".repeat(60)}`);

// ─── Page smoke tests ────────────────────────────────────────────
await check("GET /", async () => {
  const res = await fetch(`${BASE}/`, { signal: AbortSignal.timeout(12000) });
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

await check("GET /leaderboard", async () => {
  const res = await fetch(`${BASE}/leaderboard`);
  assert(res.ok, `status ${res.status}`);
  const html = await res.text();
  assert(html.includes("Stats indexed by Goldsky"), "not using subgraph source");
});

await check("GET /verify", async () => {
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

await check("GET /verify/lookup → redirect", async () => {
  const res = await fetch(`${BASE}/verify/lookup?q=0xaaaa`, {
    redirect: "manual"
  });
  assert(res.status === 307 || res.status === 302, `status ${res.status}`);
});

// ─── API endpoints ──────────────────────────────────────────────
await check("GET /api/warmup", async () => {
  const { status, data } = await fetchJson(`${BASE}/api/warmup`);
  assert(status === 200, `status ${status}`);
  assert(data.aaEnabled === true, "AA not enabled");
  assert(data.chainId === 2368, `wrong chainId ${data.chainId}`);
  assert(data.aaAddress?.toLowerCase() === RESEARCHER_AA.toLowerCase(), "AA addr mismatch");
});

await check("GET /api/x402-status", async () => {
  const { status, data } = await fetchJson(`${BASE}/api/x402-status`);
  assert(status === 200, `status ${status}`);
  assert(data.reachable === true, "Pieverse unreachable");
  assert(data.supportsKiteTestnet === true, "kite-testnet not supported");
});

await check("GET /api/orcid-check · real", async () => {
  const { status, data } = await fetchJson(
    `${BASE}/api/orcid-check?orcid=0000-0002-1825-0097`
  );
  assert(status === 200, `status ${status}`);
  assert(data.status === "real", `status: ${data.status}`);
  assert(data.name === "Josiah Carberry", `name: ${data.name}`);
});

await check("GET /api/orcid-check · catalog", async () => {
  const { status, data } = await fetchJson(
    `${BASE}/api/orcid-check?orcid=0000-0001-1234-0001`
  );
  assert(status === 200, `status ${status}`);
  assert(data.status === "catalog", `status: ${data.status}`);
  assert(data.name?.includes("Chen"), `name: ${data.name}`);
});

await check("GET /api/orcid-check · unknown → 404", async () => {
  const res = await fetch(
    `${BASE}/api/orcid-check?orcid=9999-9999-9999-9998`
  );
  assert(res.status === 404, `status ${res.status}`);
});

await check("GET /api/orcid-check · malformed → 400", async () => {
  const res = await fetch(`${BASE}/api/orcid-check`);
  assert(res.status === 400, `status ${res.status}`);
});

// ─── Subgraph health ────────────────────────────────────────────
let subgraphAttestations = 0;
let subgraphAuthors = 0;
let subgraphTotalEarnings = 0n;

await check("POST subgraph _meta", async () => {
  const { status, data } = await fetchJson(SUBGRAPH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: "{ _meta { block { number } hasIndexingErrors } }"
    })
  });
  assert(status === 200, `status ${status}`);
  assert(!data.errors, `errors: ${JSON.stringify(data.errors)}`);
  assert(data.data._meta.hasIndexingErrors === false, "has indexing errors");
  assert(
    data.data._meta.block.number > 20944832,
    `not indexed past deploy: ${data.data._meta.block.number}`
  );
});

await check("POST subgraph attestations", async () => {
  const { status, data } = await fetchJson(SUBGRAPH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query:
        "{ attestations(first: 50, orderBy: timestamp, orderDirection: desc) { id payer totalPaid citationCount } }"
    })
  });
  assert(status === 200, `status ${status}`);
  const atts = data.data.attestations;
  subgraphAttestations = atts.length;
  assert(atts.length >= 1, `only ${atts.length} attestations`);
  for (const a of atts) {
    assert(a.id.startsWith("0x"), "bad attestation id");
    assert(a.payer.startsWith("0x"), "bad payer");
    assert(BigInt(a.totalPaid) > 0n, `zero totalPaid for ${a.id}`);
    assert(a.citationCount > 0, `zero citations for ${a.id}`);
  }
});

await check("POST subgraph authors", async () => {
  const { status, data } = await fetchJson(SUBGRAPH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query:
        "{ authors(first: 50, orderBy: totalEarnings, orderDirection: desc) { id totalEarnings citationCount } }"
    })
  });
  assert(status === 200, `status ${status}`);
  const authors = data.data.authors;
  subgraphAuthors = authors.length;
  assert(authors.length >= 1, "no authors");
  for (const a of authors) {
    subgraphTotalEarnings += BigInt(a.totalEarnings);
    assert(a.id.startsWith("0x"), "bad author id");
    assert(BigInt(a.totalEarnings) > 0n, `zero earnings for ${a.id}`);
  }
});

await check("POST subgraph author 7-day stats", async () => {
  const { status, data } = await fetchJson(SUBGRAPH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `{ authorDayStats(first: 20, orderBy: date, orderDirection: desc) { id date citations earnings } }`
    })
  });
  assert(status === 200, `status ${status}`);
  const stats = data.data.authorDayStats;
  assert(stats.length >= 1, "no day stats");
});

await check("POST subgraph known queryId resolves", async () => {
  const { status, data } = await fetchJson(SUBGRAPH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `{ attestation(id: "${KNOWN_QUERY_ID}") { id payer totalPaid citationCount citations { author { id } amount weightBps } } }`
    })
  });
  assert(status === 200, `status ${status}`);
  const att = data.data.attestation;
  assert(att != null, "known queryId not indexed");
  assert(att.citations.length === 3, `citation count mismatch: ${att.citations.length}`);
  const weightSum = att.citations.reduce((s, c) => s + c.weightBps, 0);
  assert(weightSum === 10000, `weight sum ${weightSum} != 10000`);
});

// ─── Data integrity ──────────────────────────────────────────────
await check("data integrity · attestation count ≥ 3", async () => {
  assert(subgraphAttestations >= 3, `only ${subgraphAttestations} attestations`);
});

await check("data integrity · totalEarnings > 0", async () => {
  assert(
    subgraphTotalEarnings > 0n,
    `totalEarnings=${subgraphTotalEarnings}`
  );
});

// Summary
console.log(`\n${"─".repeat(60)}`);
console.log(`Passed: ${passed}  ·  Failed: ${failed}`);
console.log(`Subgraph: ${subgraphAttestations} attestations · ${subgraphAuthors} authors · ${Number(subgraphTotalEarnings) / 1e18} USDC paid`);

if (failed > 0) {
  console.log("\nFAILURES:");
  for (const f of failures) console.log(`  · ${f.name}\n      ${f.msg}`);
  process.exit(1);
}

console.log("\nALL GREEN ✓");
