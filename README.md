# Kutip — Citations that pay.

> **First production implementation of Kite's Proof of AI philosophy.**
> Built for the Kite AI Global Hackathon 2026 — Novel Track.

- **Live demo:** <https://kutip-zeta.vercel.app>
- **Repo:** <https://github.com/PugarHuda/kutip>

### Contracts (Kite testnet · chain 2368)

| Contract | Address | Tests |
|---|---|---|
| AttributionLedger | [`0x99359DaF…E5Fa`](https://testnet.kitescan.ai/address/0x99359DaF4f2504dF3da042cd38B8d01B8589E5Fa) | 5 |
| UnclaimedYieldEscrow | [`0xcbab887d…547b40`](https://testnet.kitescan.ai/address/0xcbab887da9c2a16612a9120b4170e74c50547b40) | 8 |
| BountyMarket | [`0x1ba00a38…b3f72`](https://testnet.kitescan.ai/address/0x1ba00a38b25adf68ac599cd25094e2aa923b3f72) | 7 |
| AgentReputation (ERC-721) | [`0x8f53EB5C…db15`](https://testnet.kitescan.ai/address/0x8f53EB5C04B773F0F31FE41623EA19d2Fd84db15) | 7 |
| AgentRegistry8004 (ERC-8004) | [`0xde6d6ab9…7dcd`](https://testnet.kitescan.ai/address/0xde6d6ab98f216e6421c1b73bdab2f03064d27dcd) | 7 |
| ERC6551 Registry | [`0x2f432eff…1012`](https://testnet.kitescan.ai/address/0x2f432effbbd83df8df610e5e0c0057b65bd31012) | — |
| ERC6551 Account impl | [`0x7d9c63f1…f456`](https://testnet.kitescan.ai/address/0x7d9c63f12af5ad7a18bb8d39ac8c1dd23e95f456) | — |

### Agent identities

| Role | Address | TBA (ERC-6551) |
|---|---|---|
| Researcher (AA) | [`0x4da7f4cF…1776`](https://testnet.kitescan.ai/address/0x4da7f4cFd443084027a39cc0f7c41466d9511776) | [`0xb1fa88ba…df04`](https://testnet.kitescan.ai/address/0xb1fa88ba20561378a67c3a2d477a2461c704df04) |
| Summarizer (AA) | [`0xA6C36bA2…ef5c`](https://testnet.kitescan.ai/address/0xA6C36bA2BC8E84fCF276721F30FC79ceD609ef5c) | [`0xb92d4841…8323`](https://testnet.kitescan.ai/address/0xb92d484150efadfb23c55749afad3d7072bd8323) |

## What It Does

Kutip is an autonomous AI research agent that:
1. Takes a natural-language research query from a user
2. Pays per-paper via x402 micropayments on Kite chain
3. Summarizes findings with Claude (Kite's official AI partner)
4. **Attests every citation on-chain** (AttributionLedger contract)
5. **Splits revenue back to cited authors** — 50% operator / 40% authors / 10% Kite ecosystem

**One sentence:** *The first AI agent that pays the humans it learns from.*

## Why This Matters

The AI era broke the content economy. Scrapers take everything, creators get nothing. Kutip proves Kite's thesis — agents CAN be legitimate economic actors that compensate their sources, cryptographically, in real-time.

## Demo Flow (90-second pitch)

```
User: "Cari literatur tentang carbon capture terbaru"
  ↓
Pay 2 USDC via x402 (gasless, 1 click)
  ↓
Agent searches → buys 5 papers → reads with Claude
  ↓
Agent attests citations on Kite chain
  ↓
Smart contract splits 2 USDC:
  • 1.00 → agent operator
  • 0.80 → cited authors (prorata by weight)
  • 0.20 → Kite ecosystem
  ↓
User gets: summary + bibliography + TX hash
Authors get: surprise USDC in wallet
```

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 14 App Router + wagmi + viem + Tailwind with design tokens |
| Agent LLM | OpenRouter — GLM 4.5 Air primary, gpt-oss-120b fallback (free) |
| Agent identity | EIP-4337 smart account via `gokite-aa-sdk`, Kite paymaster covers gas in Test USD |
| Corpus | Static mock catalog + optional Semantic Scholar live search |
| Payments | x402 via Pieverse facilitator |
| Chain | Kite testnet (Chain ID 2368) |
| Contracts | Solidity 0.8.24 + Foundry, `AttributionLedger` (5/5 tests passing) |
| Deploy | Vercel (FE+BE) + Kite testnet (contracts) |

## Project Structure

```
Kutip/
├── contracts/           Foundry project (AttributionLedger)
├── web/                 Next.js 14 app (FE + API routes)
├── docs/                Planning docs
├── .env.example         Template for secrets
└── README.md            This file
```

## Quick Start

```bash
# 1. Install deps (foundry libs are NOT submodules — run `forge install` once)
cd contracts && forge install OpenZeppelin/openzeppelin-contracts foundry-rs/forge-std
cd ../web && pnpm install

# 2. Copy env
cp .env.example ../.env
# Fill PRIVATE_KEY, OPENROUTER_API_KEY, wallet addresses

# 3. Deploy contract to Kite testnet
cd contracts
forge script script/Deploy.s.sol:Deploy \
  --rpc-url $KITE_RPC_URL --private-key $PRIVATE_KEY --broadcast

# 4. Sync env into web app, run dev
cd ..
pnpm run env:sync
pnpm dev
```

## Hackathon Requirement Checklist

- [x] Agent performs task + settles on Kite chain
- [x] Executes paid actions (x402 per paper)
- [x] End-to-end demo in production (Vercel)
- [x] Uses Kite chain for **attestations** (AttributionLedger)
- [x] Functional UI (web app)
- [x] Demo publicly accessible + reproducible README

## Judging Criteria Alignment

| Criteria | How Kutip wins |
|---|---|
| **Agent Autonomy** | Full autonomy: search, buy, read, cite, split payment |
| **Developer Experience** | 1-line citation SDK, clear README, video |
| **Real-World Applicability** | Real problem (AI-scraping creator crisis) with real solution |
| **Novel/Creativity** | First live PoAI implementation — not yet on any chain |

## Status

- [ ] D1: Setup + scaffold
- [ ] D2: AttributionLedger.sol deploy
- [ ] D3: Agent core logic + Claude integration
- [ ] D4: x402 paywall + mock paper catalog
- [ ] D5: Revenue split end-to-end
- [ ] D6: Frontend + dashboard
- [ ] D7: Public attribution leaderboard
- [ ] D8: Deploy Vercel + stress test
- [ ] D9: Demo video + README polish
- [ ] D10: Submit

## License

MIT

---

**Team:** Pugar Huda Mantoro (@PugarHuda)
**Track:** Novel
**Built on:** Kite AI Testnet (Ozone)
