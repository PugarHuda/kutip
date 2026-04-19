#!/usr/bin/env node
// Fire N concurrent research queries against a Kutip deployment and report:
//   - success rate of each of the 5 agent steps
//   - p50/p95/p99 latency
//   - error taxonomy (LLM fail, RPC fail, insufficient balance, etc.)
//
// Usage: node scripts/stress-test.mjs [base] [n] [budget]
//   default base=https://kutip-zeta.vercel.app  n=10  budget=1

const BASE = process.argv[2] || "https://kutip-zeta.vercel.app";
const N = Number(process.argv[3] || 10);
const BUDGET = Number(process.argv[4] || 1);

const QUERIES = [
  "What are the top carbon capture methods in 2024?",
  "Latest progress on direct air capture cost reduction",
  "Compare mineralization vs biochar for long-term storage",
  "Tandem perovskite silicon solar cell efficiency",
  "Enhanced rock weathering field trials",
  "Blue hydrogen methane leakage analysis",
  "Ocean alkalinity enhancement pilots",
  "Offshore wind turbine materials fatigue",
  "Carbon capture policy frameworks 45Q",
  "Afforestation carbon yield satellite data",
  "Enzyme immobilization post-combustion capture",
  "Perovskite stability degradation mechanisms"
];

async function runQuery(i) {
  const query = QUERIES[i % QUERIES.length];
  const started = Date.now();
  const observed = {
    index: i,
    query: query.slice(0, 40),
    stepsSeen: 0,
    stepsDone: 0,
    gotResult: false,
    error: null,
    lastStep: null,
    attestMode: null,
    totalMs: 0
  };

  try {
    const res = await fetch(`${BASE}/api/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, budgetUSDC: BUDGET })
    });

    if (!res.ok) {
      observed.error = `HTTP ${res.status}`;
      observed.totalMs = Date.now() - started;
      return observed;
    }
    if (!res.body) {
      observed.error = "no body";
      observed.totalMs = Date.now() - started;
      return observed;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const messages = buffer.split("\n\n");
      buffer = messages.pop() ?? "";

      for (const msg of messages) {
        if (!msg.startsWith("data: ")) continue;
        try {
          const event = JSON.parse(msg.slice(6));
          if (event.type === "step") {
            observed.stepsSeen++;
            observed.lastStep = event.step.label;
            if (event.step.status === "done") observed.stepsDone++;
            if (event.step.status === "error") observed.error = event.step.detail;
          } else if (event.type === "result") {
            observed.gotResult = true;
            observed.attestMode = event.result.attestationMode ?? "skipped";
          } else if (event.type === "error") {
            observed.error = event.message;
          }
        } catch {}
      }
    }
  } catch (err) {
    observed.error = err?.message ?? "unknown";
  }

  observed.totalMs = Date.now() - started;
  return observed;
}

function p(arr, pct) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * pct));
  return sorted[idx];
}

console.log(`[stress] base=${BASE} n=${N} budget=${BUDGET}`);
console.log(`[stress] firing ${N} concurrent queries…\n`);

const t0 = Date.now();
const results = await Promise.all(Array.from({ length: N }, (_, i) => runQuery(i)));
const elapsed = Date.now() - t0;

console.log("per-query results:");
for (const r of results) {
  console.log(
    `  #${String(r.index).padStart(2, "0")} ${r.totalMs}ms ` +
      `steps=${r.stepsDone}/${r.stepsSeen} ` +
      `${r.gotResult ? `result attest=${r.attestMode}` : `FAIL: ${r.error ?? "incomplete"}`} ` +
      `last=${r.lastStep ?? "-"}`
  );
}

const latencies = results.map((r) => r.totalMs);
const succeeded = results.filter((r) => r.gotResult).length;
const attestAA = results.filter((r) => r.attestMode === "aa").length;
const attestEOA = results.filter((r) => r.attestMode === "eoa").length;
const attestSkipped = results.filter((r) => r.attestMode === "skipped").length;

const errorTaxonomy = new Map();
for (const r of results.filter((r) => !r.gotResult && r.error)) {
  const key = r.error.slice(0, 60);
  errorTaxonomy.set(key, (errorTaxonomy.get(key) || 0) + 1);
}

console.log("\nSUMMARY");
console.log(`  total time:      ${elapsed}ms`);
console.log(`  succeeded:       ${succeeded}/${N}`);
console.log(`  attest: aa=${attestAA} eoa=${attestEOA} skipped=${attestSkipped}`);
console.log(`  p50 / p95 / p99: ${p(latencies, 0.5)}ms / ${p(latencies, 0.95)}ms / ${p(latencies, 0.99)}ms`);
console.log(`  max:             ${Math.max(...latencies)}ms`);

if (errorTaxonomy.size > 0) {
  console.log("\nerrors observed:");
  for (const [msg, count] of [...errorTaxonomy.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${count}x ${msg}`);
  }
}
