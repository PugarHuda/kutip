# Kutip — The research agent that pays its sources.

> An autonomous AI research agent that attests every citation on-chain and splits USDC back to the cited authors, in real-time, on the first AI-payments blockchain.

**Built for:** Kite AI Global Hackathon 2026 — **Novel track**
**Team:** Pugar Huda Mantoro ([@PugarHuda](https://github.com/PugarHuda))
**Live demo:** <https://kutip-zeta.vercel.app> · **Repo:** <https://github.com/PugarHuda/kutip>

*Kutip* (koo-teep) is Indonesian for *cite*.

---

## What it does in one sentence

A user asks a research question. The agent pays for source papers via x402, reads them with an LLM, submits an on-chain attestation that splits USDC across the cited authors — all without the user signing a single wallet transaction, and without the agent ever holding a KITE token.

## Demo flow (90 seconds)

```
1. User opens /research, connects wallet, signs one EIP-712 delegation
     "Agent may spend max 2 USDC/query, 10 USDC/day, 24h expiry"
2. User types a question, clicks "Pay 0.5 USDC & research"
     Zero gas prompts after this point.
3. Agent (Researcher AA) runs 5 steps — each with live ticker:
     Search → Purchase via x402 → Read with LLM → Attribute → Settle on-chain
4. On settlement, one atomic UserOp:
     • transfer sub-agent fee (5%) to Summarizer AA
     • transfer totalPaid to AttributionLedger
     • call attestAndSplit(queryId, citations)
     • paymaster postOp pulls ~0.02 USDC from AA for gas
5. Same query is mirrored to Avalanche Fuji within seconds
     via operator relayer — LayerZero-pattern cross-chain proof.
6. Receipt shows:
     • Tx hash on KiteScan + SnowTrace
     • Session id + delegator (Passport ✓ chip)
     • Authors paid (40% of spend, split by citation weight)
     • Sub-agent fee to Summarizer (5%)
```

---

## Feature highlights

| Feature | Why it matters | File |
|---|---|---|
| **EIP-4337 AA via gokite-aa-sdk** | Agent has its own on-chain identity. KiteScan shows AA address as payer, not user. | [`lib/agent-passport.ts`](web/lib/agent-passport.ts) |
| **Agent Passport session delegation** | User signs one EIP-712 SpendingIntent, agent operates within cap without per-query prompts. Drop-in-ready for Kite Passport public launch. | [`lib/session.ts`](web/lib/session.ts) |
| **Kite paymaster gasless UX** | Agent never holds KITE. Paymaster fronts gas, pulls USDC back in postOp. User pays zero in any currency. | [`lib/ledger.ts:submitViaAA`](web/lib/ledger.ts) |
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
│                                     2. Purchase via x402 (Pieverse)   │
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
| AttributionLedger | [`0x99359DaF…E5Fa`](https://testnet.kitescan.ai/address/0x99359DaF4f2504dF3da042cd38B8d01B8589E5Fa) | Atomic settle — split fee + emit citation events |
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

Sequential stress test, 5 queries at 0.5 USDC each, measured end-to-end from `POST /api/query` to attestation confirmation:

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
| Executes paid actions (API calls, services, transactions) | ✅ x402 per-paper via Pieverse |
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
| Corpus | Static mock catalog (30+ carbon papers) + Semantic Scholar live search |
| Payments | x402 via Pieverse facilitator (`facilitator.pieverse.io`) |
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

## Links

- Live demo: <https://kutip-zeta.vercel.app>
- GitHub: <https://github.com/PugarHuda/kutip>
- Kite Block Explorer: <https://testnet.kitescan.ai>
- SnowTrace (Fuji): <https://testnet.snowtrace.io>
- Goldsky subgraph: https://api.goldsky.com/api/public/project_cmo5pukv64upu01y48tefank9/subgraphs/kutip/0.1.0/gn

## License

MIT
