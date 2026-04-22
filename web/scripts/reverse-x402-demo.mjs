#!/usr/bin/env node
/**
 * Reverse x402 demo: simulates a second agent paying Kutip for a summary.
 *
 * Flow:
 *   1. Agent A (Kutip): runs research, produces summary, caches it
 *   2. Agent B (this script): tries to read summary → 402 Payment Required
 *   3. Agent B settles via Pieverse x402 facilitator → gets X-Payment header
 *   4. Agent B retries with payment → 200 OK with summary body
 *
 * Kutip becomes BOTH a consumer (pays authors) AND a producer (gets paid
 * by other agents). Closes the recursive economy loop.
 */
const BASE = process.argv[2] || "https://kutip-zeta.vercel.app";

async function step1_produceSummary() {
  console.log("[A] Kutip produces a summary (Agent A flow)…");
  const q = "Compare mineralization vs biochar for long-term storage";
  const res = await fetch(`${BASE}/api/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: q, budgetUSDC: 0.1 }),
    keepalive: true
  });
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "", result = null;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const msgs = buffer.split("\n\n"); buffer = msgs.pop() ?? "";
    for (const m of msgs) {
      if (!m.startsWith("data: ")) continue;
      const ev = JSON.parse(m.slice(6));
      if (ev.type === "result") result = ev.result;
      if (ev.type === "error") throw new Error(ev.message);
    }
  }
  console.log(`[A] ✓ summary produced · queryId=${result.queryId.slice(0, 14)}…`);
  return result.queryId;
}

async function step2_attemptRead(queryId) {
  console.log(`\n[B] Agent B tries to read summary (no payment)…`);
  const res = await fetch(`${BASE}/api/summaries/${queryId}`);
  if (res.status === 402) {
    const body = await res.json();
    console.log(`[B] 402 Payment Required ← correct reverse-x402 response`);
    console.log(`[B]   x402Version: ${body.x402Version}`);
    console.log(`[B]   accepts: ${body.accepts?.length ?? 0} payment options`);
    if (body.accepts?.[0]) {
      const opt = body.accepts[0];
      console.log(`[B]   ∟ scheme: ${opt.scheme}`);
      console.log(`[B]   ∟ network: ${opt.network}`);
      console.log(`[B]   ∟ maxAmountRequired: ${opt.maxAmountRequired}`);
      console.log(`[B]   ∟ payTo: ${opt.payTo}`);
    }
    return body;
  }
  console.log(`[B] unexpected status ${res.status}:`, await res.text());
  return null;
}

async function step3_simulateSettlement(challenge) {
  console.log(`\n[B] Agent B simulates x402 settlement via Pieverse facilitator…`);
  const opt = challenge.accepts[0];
  console.log(`[B]   would POST to ${opt.resource} with X-PAYMENT header`);
  console.log(`[B]   payload: pay ${opt.maxAmountRequired} to ${opt.payTo} on ${opt.network}`);
  console.log(`[B]   signer: a hypothetical second agent EOA/AA wallet`);
  console.log(`[B]   facilitator verifies signature + broadcasts transfer on-chain`);
  console.log(`[B]   → Kutip receives revenue, releases content`);
  console.log(`[B]   (actual tx broadcast omitted — demo shows the protocol shape)`);
}

(async () => {
  console.log("=".repeat(64));
  console.log("Reverse x402 demo · Kutip as paywalled producer");
  console.log("=".repeat(64));

  const queryId = await step1_produceSummary();
  const challenge = await step2_attemptRead(queryId);
  if (challenge) await step3_simulateSettlement(challenge);

  console.log("\n=".repeat(32));
  console.log("Loop closes: authors ← Kutip ← Agent B");
  console.log("Kutip earns from agents who cite it, pays humans it cites.");
})();
