# Kutip — Instructions for Claude Code

## Project Context

**What:** AI research agent on Kite AI that pays cited authors via x402 revenue split.
**Track:** Kite AI Hackathon 2026 — Novel.
**Deadline:** 2026-04-27 18:59 WIB.

## Stack Decisions (locked)

- **Frontend:** Next.js 14 App Router, TypeScript, wagmi+viem, Tailwind + shadcn/ui
- **Agent LLM:** OpenRouter (OpenAI-compatible) · primary `openai/gpt-oss-120b:free`, fallback `z-ai/glm-4.5-air:free`. Swap by editing `OPENROUTER_MODEL` in `.env`.
- **Contract:** Solidity 0.8.24 via Foundry (NOT Hardhat — faster compile)
- **Payment:** x402 spec via Pieverse facilitator (`facilitator.pieverse.io`)
- **Chain:** Kite testnet only (Chain ID 2368, RPC `rpc-testnet.gokite.ai`)
- **Service wallet (EOA):** `0x5C91B851D9Aa20172e6067d9236920A6CBabf40c` (deployer + operator + ecosystem for demo)
- **Agent identity (AA):** `0x4da7f4cFd443084027a39cc0f7c41466d9511776` (EIP-4337 smart account derived via gokite-aa-sdk, submits attestations). Toggle with `KUTIP_USE_AA=1`. Full Kite Passport (session/delegation layer) added when testnet invite lands — see `docs/agent-passport.md`.

## Network Config (hardcode, do NOT re-derive)

```
KITE_TESTNET_CHAIN_ID = 2368
KITE_TESTNET_RPC = https://rpc-testnet.gokite.ai/
KITE_TESTNET_EXPLORER = https://testnet.kitescan.ai/
KITE_FAUCET = https://faucet.gokite.ai
KITE_TESTNET_USDC = 0x0fF5393387ad2f9f691FD6Fd28e07E3969e27e63
PIEVERSE_FACILITATOR = https://facilitator.pieverse.io
PIEVERSE_TESTNET_SETTLE_ADDR = 0x12343e649e6b2b2b77649DFAb88f103c02F3C78b
```

## Conventions

- **Naming:** camelCase for TS, PascalCase for components/contracts, SCREAMING_SNAKE for env
- **Mock data:** Keep `data/papers.json` seeded with 30+ realistic papers (carbon capture, renewable energy — kamu skripsi topics)
- **Addresses:** Use checksummed form always
- **Error handling:** Only at API boundary — let internal errors bubble
- **No premature abstractions:** Inline until repeated 3 times
- **Zero comments** unless WHY is non-obvious (workaround, invariant, subtle bug)

## Agent Behavior Contract

The agent MUST:
1. Never call an external paid API without first completing x402 payment
2. Always attest citation AFTER successful summarization, BEFORE returning to user
3. Split revenue via single atomic transaction (not per-author — gas cost)
4. Fail closed: if attestation tx fails, DO NOT send summary to user

## Testing Discipline

- Foundry tests for contract (coverage >80% on critical paths)
- Playwright or simple E2E script for payment flow
- Skip unit tests for components (hackathon: time > coverage)

## Demo Script Protection

Keep `docs/demo-script.md` always current. Every feature merge = update demo script if visible.

## What NOT to Build

- Authentication (use wagmi wallet connect only)
- Email/notification system
- Multi-language (English only — judges are global but one lang)
- Admin panel
- Rate limiting (deploy behind Vercel protection)
- Complex caching (Next.js default is enough)

## Deployment Target

- Web: Vercel (free tier)
- Contract: Kite testnet only (save KITE tokens)
- Author DB: In-memory JSON (no real DB — this is hackathon demo)
