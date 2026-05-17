# Kutip — The research agent that pays its sources.

> An autonomous AI research agent that attests every citation on-chain and splits USDT back to the cited authors, in real-time, on the first AI-payments blockchain.

**Built for:** Kite AI Global Hackathon 2026 — **Novel track**
**Team:** Pugar Huda Mantoro ([@PugarHuda](https://github.com/PugarHuda))
**Live demo:** <https://kutip-zeta.vercel.app> · **Repo:** <https://github.com/PugarHuda/kutip>

*Kutip* (koo-teep) is Indonesian for *cite*.

---

## What it does in one sentence

A user asks a research question. The agent pays for source papers via x402, reads them with an LLM, submits an on-chain attestation that splits USDT across the cited authors — all without the user signing a single wallet transaction, and without the agent ever holding a KITE token.

## Demo flow (90 seconds)

```
1. User opens /research, connects wallet, signs one EIP-712 delegation
     "Agent may spend max 2 USDT/query, 10 USDT/day, 24h expiry"
2. User types a question, clicks "Pay 0.5 USDT & research"
     Zero gas prompts after this point.
3. Agent (Researcher AA) runs 5 steps — each with live ticker:
     Search → Purchase via x402 → Read with LLM → Attribute → Settle on-chain
4. On settlement, one atomic UserOp:
     • transfer sub-agent fee (5%) to Summarizer AA
     • transfer totalPaid to AttributionLedger
     • call attestAndSplit(queryId, citations)
     • paymaster postOp pulls ~0.02 USDT from AA for gas
5. Same query is mirrored to Avalanche Fuji within seconds
     via operator relayer — LayerZero-pattern cross-chain proof.
6. Receipt shows:
     • Tx hash on KiteScan + SnowTrace
     • Session id + delegator (Passport ✓ chip)
     • Authors paid (80% of spend, split by citation weight)
     • Sub-agent fee to Summarizer (5%)
```

---

## Feature highlights

| Feature | Why it matters | File |
|---|---|---|
| **EIP-4337 AA via gokite-aa-sdk** | Agent has its own on-chain identity. KiteScan shows AA address as payer, not user. | [`lib/agent-passport.ts`](web/lib/agent-passport.ts) |
| **Agent Passport session delegation** | User signs one EIP-712 SpendingIntent, agent operates within cap without per-query prompts. Drop-in-ready for Kite Passport public launch. | [`lib/session.ts`](web/lib/session.ts) |
| **Kite paymaster gasless UX** | Agent never holds KITE. Paymaster fronts gas, pulls USDT back in postOp. User pays zero in any currency. | [`lib/ledger.ts:submitViaAA`](web/lib/ledger.ts) |
| **Multi-agent composition** | Researcher AA + Summarizer AA (different salts of same EOA). Sub-agent receives 5% per query automatically. | [`getSummarizerAAAddress()`](web/lib/agent-passport.ts) |
| **ORCID OAuth ownership proof** | Authors prove ORCID via real OAuth2 flow (not just knowing the number). HMAC-signed session cookie enforced at API gate. | [`lib/orcid-oauth.ts`](web/lib/orcid-oauth.ts) |
| **On-chain NameRegistry** | ORCID → wallet bindings persisted on Kite via operator AA. Claim survives Lambda cold starts, verifiable via KiteScan. | [`contracts/src/NameRegistry.sol`](contracts/src/NameRegistry.sol) |
| **Cross-chain receipt mirror** | Every attestation auto-replicates to `CitationMirror` on Avalanche Fuji. LayerZero-pattern; swaps to DVN-attested once Kite exposes its LZ endpoint. | [`contracts/src/CitationMirror.sol`](contracts/src/CitationMirror.sol) |
| **2-of-3 Safe governance** | Ecosystem fund + escrow gated by Safe v1.4.1 multisig. Even if one signer key leaks, funds stay put. | [`scripts/deploy-safe.mjs`](scripts/deploy-safe.mjs) |
| **Unclaimed yield escrow** | Payouts to un-bound authors accrue in `UnclaimedYieldEscrow` (5% APY target) until they bind an ORCID. | [`contracts/src/UnclaimedYieldEscrow.sol`](contracts/src/UnclaimedYieldEscrow.sol) |
| **ERC-8004 Trustless Agents + ERC-6551 TBAs** | Each agent has a Reputation NFT whose token-bound account holds its earnings. Portable, composable. | [`contracts/src/AgentRegistry8004.sol`](contracts/src/AgentRegistry8004.sol) |
| **Reverse x402** | Cached query summaries re-monetized via x402 paywall. Other agents pay Kutip to cite Kutip → recursive author payouts. | [`app/api/summaries/[queryId]/route.ts`](web/app/api/summaries/[queryId]/route.ts) |
| **Citation bounties** | Anyone can sponsor a research question; Kutip satisfies it and claims the bounty. | [`contracts/src/BountyMarket.sol`](contracts/src/BountyMarket.sol) |
| **Goldsky subgraph** | Full indexer for attestations, authors, day stats, bindings. Powers `/leaderboard` windowed queries + `/authors/[id]` sparklines. | [`subgraph/`](subgraph/) |

---

## Architecture

```
┌───────────────────────────────────────────────────────────────────────┐
│                              User (wallet)                            │
│                                   │                                   │
│                  signs one EIP-712 SpendingIntent                     │
└───────────────────────────────────┼───────────────────────────────────┘
                                    │
                                    ▼
┌───────────────────────────────────────────────────────────────────────┐
│                        Next.js App (Vercel)                           │
│ ─────────────────────────────────────────────────────────────────────│
│ /research (UI + SSE stream) ── /api/query ── lib/agent.ts            │
│                                                │                     │
│                                     1. Search (Semantic Scholar)      │
│                                     2. Purchase via x402 (on-chain)   │
│                                     3. Read with OpenRouter LLM       │
│                                     4. Warm claim cache from chain    │
│                                     5. Attest on Kite (batched UserOp)│
│                                     6. Mirror to Fuji (relayer)       │
└───────────────────────────────────┼───────────────────────────────────┘
                                    │
           ┌────────────────────────┼────────────────────────┐
           │                        │                        │
           ▼                        ▼                        ▼
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────────┐
│ Kite testnet     │    │ Avalanche Fuji   │    │ Goldsky subgraph     │
│ (chain 2368)     │    │ (chain 43113)    │    │                      │
│                  │    │                  │    │ Indexes events from  │
│ AttributionLedger│    │ CitationMirror   │    │ Kite into queryable  │
│ UnclaimedYield…  │    │ (operator-relay) │    │ GraphQL — powers     │
│ BountyMarket     │    │                  │    │ /leaderboard +       │
│ AgentReputation  │    │                  │    │ /authors/[id]        │
│ AgentRegistry8004│    │                  │    │                      │
│ NameRegistry     │    │                  │    │                      │
│ Operator Safe    │    │                  │    │                      │
│ (2-of-3 v1.4.1)  │    │                  │    │                      │
└──────────────────┘    └──────────────────┘    └──────────────────────┘
```

---

## Contracts

### Kite testnet (chain 2368, RPC: https://rpc-testnet.gokite.ai/)

| Contract | Address | Purpose |
|---|---|---|
| AttributionLedger | [`0xbC4eeC2f…2D36`](https://testnet.kitescan.ai/address/0xbC4eeC2f75a0DCf61509842e1c18Abff7236A338) | Atomic settle — split fee (80/15/5) + emit citation events |
| UnclaimedYieldEscrow | [`0xcbab887d…547b40`](https://testnet.kitescan.ai/address/0xcbab887da9c2a16612a9120b4170e74c50547b40) | Holds payouts for un-bound authors at 5% APY target |
| BountyMarket | [`0x1ba00a38…b3f72`](https://testnet.kitescan.ai/address/0x1ba00a38b25adf68ac599cd25094e2aa923b3f72) | Sponsored research questions, operator-settled |
| AgentReputation (ERC-721) | [`0x8f53EB5C…db15`](https://testnet.kitescan.ai/address/0x8f53EB5C04B773F0F31FE41623EA19d2Fd84db15) | Soul-bound agent reputation NFTs |
| AgentRegistry8004 | [`0xde6d6ab9…7dcd`](https://testnet.kitescan.ai/address/0xde6d6ab98f216e6421c1b73bdab2f03064d27dcd) | ERC-8004 Trustless Agents registry |
| ERC6551 Registry | [`0x2f432eff…1012`](https://testnet.kitescan.ai/address/0x2f432effbbd83df8df610e5e0c0057b65bd31012) | Canonical ERC-6551 factory |
| ERC6551 Account impl | [`0x7d9c63f1…f456`](https://testnet.kitescan.ai/address/0x7d9c63f12af5ad7a18bb8d39ac8c1dd23e95f456) | Token-bound account implementation |
| **NameRegistry** | [`0x5a9b1304…2FEF9`](https://testnet.kitescan.ai/address/0x5a9b13043452a99A15cA01F306191a639002FEF9) | On-chain ORCID → wallet bindings |
| **Operator Safe (2-of-3)** | [`0x5258161f…c36AA`](https://testnet.kitescan.ai/address/0x5258161fb69e6a33922c1Fe46C042A78572c36AA) | Governance multisig (Safe v1.4.1) |

### Avalanche Fuji (chain 43113)

| Contract | Address | Purpose |
|---|---|---|
| **CitationMirror** | [`0x99359dAf…E5fA`](https://testnet.snowtrace.io/address/0x99359dAf4f2504dF3DA042cD38b8D01b8589E5fA) | Cross-chain receipt mirror — LayerZero-pattern |

### Agent identities (EIP-4337 smart accounts)

| Role | Address | Token-Bound Account |
|---|---|---|
| Researcher AA | [`0x4da7f4cF…1776`](https://testnet.kitescan.ai/address/0x4da7f4cFd443084027a39cc0f7c41466d9511776) | [`0xb1fa88ba…df04`](https://testnet.kitescan.ai/address/0xb1fa88ba20561378a67c3a2d477a2461c704df04) |
| Summarizer AA | [`0xA6C36bA2…ef5c`](https://testnet.kitescan.ai/address/0xA6C36bA2BC8E84fCF276721F30FC79ceD609ef5c) | [`0xb92d4841…8323`](https://testnet.kitescan.ai/address/0xb92d484150efadfb23c55749afad3d7072bd8323) |

---

## Performance (April 2026, production deployment)

Sequential stress test, 5 queries at 0.5 USDT each, measured end-to-end from `POST /api/query` to attestation confirmation:

| Metric | Value | Note |
|---|---|---|
| Success rate | 4 / 5 (80%) | Failure was balance exhaustion, not code bug |
| **p50 latency** | **12.5 s** | Warm Lambda + warm LLM + 1 bundler RT |
| p95 latency | 38.4 s | Dominated by cold start (Lambda spin + model boot) |
| Min / Max | 9.7 s / 38.4 s | |
| Concurrent nonce collisions | Serialize via AA | Known AA limitation — 1 tx per signer at a time |

QA suite (`scripts/qa-test.mjs`): **50 / 50 automated checks green** on every push.

---

## Hackathon requirements checklist

| Requirement | Status |
|---|---|
| Agent performs a task and settles on Kite chain | ✅ `attestAndSplit` atomic batch |
| Executes paid actions (API calls, services, transactions) | ✅ Real x402 handshake — HTTP 402 → on-chain USDT settle on Kite; plus the `attestAndSplit` payout tx |
| Works end-to-end in a live demo in production | ✅ https://kutip-zeta.vercel.app |
| Uses Kite chain for attestations (proof, auditability) | ✅ `AttributionLedger` on chain 2368 |
| Functional UI (web app) | ✅ Next.js 14 App Router |
| Demo publicly accessible or reproducible via README | ✅ Vercel deploy + reproducible quick start |

## Judging criteria alignment

| Criterion | How Kutip scores |
|---|---|
| **Agent Autonomy** | Passport session delegation → agent runs without per-query human clicks within cryptographic caps. AA submits attestations as itself, not via user EOA. |
| **Developer Experience** | `/gasless` page with live paymaster probe. Error decoder that surfaces `WeightMismatch` / `ERC20InsufficientAllowance` / custom errors inline. 50-check QA suite in one command. |
| **Real-World Applicability** | Solves a real crisis (AI-scraping vs creator economy). ORCID OAuth + on-chain binding is production-shape, not mocked. |
| **Novel / Creativity** | Reverse x402 (cache-paywall). Citation bounties. Cross-chain mirror. Two-agent composition with sub-agent fees. ERC-8004 + ERC-6551 stacked. |

---

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 14 App Router · wagmi + viem · Tailwind |
| Agent LLM | OpenRouter · `z-ai/glm-4.5-air:free` primary, `openai/gpt-oss-120b:free` fallback |
| Agent identity | EIP-4337 via `gokite-aa-sdk@1.0.15` · Kite staging bundler · Kite paymaster |
| Corpus | OpenAlex + Semantic Scholar live search, with a static catalog fallback |
| Payments | x402 — real HTTP 402 → on-chain USDT settlement on Kite, verified on-chain (facilitator-free). Pieverse facilitator path also wired. |
| Contracts | Solidity 0.8.24 · Foundry · OpenZeppelin 5.x |
| Chain | Kite testnet (2368) + Avalanche Fuji (43113) |
| Indexer | Goldsky subgraph (AssemblyScript mapping) |
| Auth | ORCID OAuth 2.0 (`/authenticate` scope) · HMAC session cookie |
| Multisig | Safe v1.4.1 (canonical deployment on Kite) |
| Deploy | Vercel (FE+BE serverless) + Kite/Fuji (contracts) |

---

## Quick start

```bash
# Prereqs: Node 20+, pnpm, Foundry
git clone https://github.com/PugarHuda/kutip && cd kutip

# 1) Secrets
cp .env.example .env
#   Fill: PRIVATE_KEY, OPENROUTER_API_KEY,
#         ORCID_CLIENT_ID + SECRET + COOKIE_SECRET (optional, enables OAuth)

# 2) Contracts
cd contracts
forge install OpenZeppelin/openzeppelin-contracts foundry-rs/forge-std
forge build
forge script script/Deploy.s.sol --rpc-url https://rpc-testnet.gokite.ai --broadcast
#   Record addresses → back into .env as NEXT_PUBLIC_ATTRIBUTION_LEDGER, etc.

# 3) Web app
cd ../web && pnpm install
cd .. && pnpm run env:sync     # propagates .env → web/.env.local
cd web && pnpm dev             # http://localhost:3000
```

## Project structure

```
Kutip/
├── contracts/              Foundry · all Solidity contracts + deploy scripts
│   ├── src/
│   │   ├── AttributionLedger.sol       Fee split + citation attest
│   │   ├── NameRegistry.sol            On-chain ORCID → wallet
│   │   ├── UnclaimedYieldEscrow.sol    Holds unbound-author payouts
│   │   ├── BountyMarket.sol            Sponsored research
│   │   ├── AgentRegistry8004.sol       ERC-8004 agent identity
│   │   ├── AgentReputation.sol         ERC-721 reputation NFT
│   │   ├── ERC6551Account.sol          Token-bound account impl
│   │   ├── ERC6551Registry.sol         TBA factory
│   │   └── CitationMirror.sol          Fuji-deployed cross-chain mirror
│   └── script/*.s.sol
├── web/                    Next.js 14 app
│   ├── app/
│   │   ├── research/               Main agent UI (Passport + live ticker)
│   │   ├── claim/                  ORCID OAuth + wallet-sign claim flow
│   │   ├── leaderboard/            Windowed earnings (all/week/month)
│   │   ├── authors/[id]/           Per-author profile + 30-day sparkline
│   │   ├── agents/                 ERC-8004 agent directory
│   │   ├── gasless/                Paymaster showcase
│   │   ├── governance/             Safe multisig status
│   │   ├── registry/ market/       Hub pages
│   │   └── api/
│   │       ├── query/              SSE stream for research
│   │       ├── claim/              OAuth-gated bind
│   │       ├── session/            EIP-712 delegation
│   │       ├── balances/           Live AA + paymaster balances
│   │       ├── gasless-stats/      Paymaster probe
│   │       ├── safe-stats/         Multisig state
│   │       ├── summaries/[id]/     Reverse-x402 cache
│   │       └── auth/orcid/*        OAuth authorize/callback/status
│   ├── lib/                        Business logic (agent, session, ledger, etc.)
│   └── scripts/                    qa-test, stress-test, fund-aa, deploy-safe
├── subgraph/               Goldsky subgraph (AssemblyScript)
├── docs/                   Plans, demo script, submission copy, agent-passport
├── scripts/                Root-level (sync-env, fund-aa, deploy-safe)
└── README.md               This file
```

---

## Testing

**Foundry — 56/56 passing** (`cd contracts && forge test`):
- Includes 4× 256-run fuzz suites (1024 random scenarios)
- Property-based: fund conservation invariant, yield linearity
- Boundary cases: weight 9999/10001, dust payment, dust principal, double-claim revert

**Vitest — 149 cases across 7 files** (`cd web && pnpm test`):
- 143 unit (6 suites) + 6 integration (`/api/claim` full flow with nock)
- London-school isolation, real `ethers.Wallet` for crypto primitives
- `fast-check` property-based tests on financial invariants (weight sum=10000)
- Coverage gates: **100% on `lib/x402.ts`**, 100% branches on `session.ts` + `claim-registry.ts`, 90%+ branches on `orcid-oauth.ts`

**CI** — `.github/workflows/test.yml` runs both jobs on every PR.

Convention: `describe(method) → describe(positive|negative|edge) → it`. See [`docs/testing.md`](docs/testing.md) for full guide, mocking strategy, and adding-tests workflow.

```bash
# Reproduce local test run
cd contracts && forge test            # 56 contract tests
cd ../web && pnpm test                # 149 TypeScript tests
pnpm test:coverage                    # HTML report at web/coverage/
```

---

## Integrate with Kutip

Kutip is composable. Other agents, indexers, and apps can plug into the
research-and-pay loop three ways — pick whichever matches your runtime.

### 1. MCP — for AI agents (Claude Desktop, Cursor, Cline)

The fastest path. One stdio process, three tools that any MCP-compatible
LLM client can call natively. Full setup in [`mcp/README.md`](mcp/README.md).

| Tool | Description |
|---|---|
| `kutip.research(query, budgetUSDC)` | Run a query end-to-end. Returns summary + citations + Kite tx hash. |
| `kutip.summary(queryId)` | Fetch a past summary via reverse-x402 paywall. |
| `kutip.authors(limit, onlyClaimed)` | List paid authors + their wallets. |

> Why it matters: an external agent that cites Kutip's work pays Kutip,
> which pays the original authors. Recursive royalties without escrow tracking.

### 2. HTTP API — for any backend / curl

Three public endpoints power most integrations. Every other route in
`/api/*` is internal to the dashboard.

```bash
# Run a research query (the dashboard uses the same endpoint).
curl -X POST https://kutip-zeta.vercel.app/api/query \
  -H "content-type: application/json" \
  -d '{"query":"What are the top carbon capture methods in 2024?","budgetUSDC":"0.10"}'

# Retrieve a saved summary (reverse-x402: receipt-or-pay).
curl https://kutip-zeta.vercel.app/api/summaries/<queryId>

# Real x402 corpus-access endpoint — POST with no header returns a
# genuine HTTP 402 challenge; pay on-chain, retry with X-PAYMENT.
curl -i -X POST https://kutip-zeta.vercel.app/api/x402 \
  -H "content-type: application/json" -d '{"queryId":"demo-1"}'

# Bind ORCID → wallet (after OAuth + EIP-712 signature).
curl -X POST https://kutip-zeta.vercel.app/api/claim \
  -H "content-type: application/json" \
  --cookie "kutip_orcid_verified=<signed-cookie>" \
  -d '{"orcid":"0009-0002-8864-0901","wallet":"0x...","signature":"0x..."}'
```

Full request/response shapes live in the route files:
[`api/query`](web/app/api/query/route.ts) · [`api/x402`](web/app/api/x402/route.ts) · [`api/summaries/[queryId]`](web/app/api/summaries/[queryId]/route.ts) · [`api/claim`](web/app/api/claim/route.ts).

### 3. On-chain — for indexers, wallets, settlement bots

Read directly from `AttributionLedger` (Kite testnet) or the Goldsky
subgraph. No HTTP layer, no rate limits.

| Source | Use for |
|---|---|
| `AttributionLedger.attestAndSplit` event | Watch every paid query, indexer-friendly |
| `AttributionLedger.authorEarnings(addr)` | Lifetime USDT earned for a wallet |
| Goldsky subgraph | Pre-aggregated leaderboard + recent attestations |
| `CitationMirror` (Fuji) | Cross-chain proof reachable from Avalanche-native apps |

ABIs are in [`contracts/abi/`](contracts/abi/) (auto-exported from Foundry build).

---

## Documentation

Long-form docs live under [`docs/`](docs/README.md) — organised as a
GitBook-shaped book (read [`SUMMARY.md`](docs/SUMMARY.md) for the
sidebar). Highlights:

- [**Architecture**](docs/architecture.md) — money flow, identity
  binding, contract addresses
- [**Security model**](docs/security.md) — threat model + every audit
  finding (14 patched across 3 rounds) and how to verify each fix
- [**Usage guide**](docs/usage.md) — run a query, sign a session,
  claim author earnings
- [**Integrate / API**](docs/integrate.md) — call Kutip from your own
  app, an MCP client, or directly on-chain
- [**Testing guide**](docs/testing.md) — 56 Foundry tests + 149 Vitest
  cases, conventions for adding more
- [**Deployment**](docs/deployment.md) — contract deploy order +
  Vercel setup
- [**Agent Passport**](docs/agent-passport.md) — EIP-712 session
  delegation deeper dive
- [**Demo script**](docs/demo-script.md) — the 90-second walkthrough

Import into [GitBook](https://gitbook.com), [Honkit](https://github.com/honkit/honkit),
or [mdBook](https://rust-lang.github.io/mdBook/) — all read
`docs/SUMMARY.md` for the sidebar. The repo ships a `.gitbook.yaml`
at the root for direct GitBook hosting.

---

## Links

- Live demo: <https://kutip-zeta.vercel.app>
- Pitch deck: <https://kutip-zeta.vercel.app/slides>
- Docs: <https://kutip-zeta.vercel.app/docs>
- GitHub: <https://github.com/PugarHuda/kutip>
- Kite Block Explorer: <https://testnet.kitescan.ai>
- SnowTrace (Fuji): <https://testnet.snowtrace.io>
- Goldsky subgraph: https://api.goldsky.com/api/public/project_cmo5pukv64upu01y48tefank9/subgraphs/kutip/0.1.0/gn

## License

MIT
