# Kutip — 10-Day Sprint Plan

> Deadline: 2026-04-27 18:59 WIB · Today: 2026-04-18

## Daily Breakdown

### D1 (Sat 18 Apr) — Scaffold ✅
- [x] Project structure created
- [x] README.md, CLAUDE.md, .env.example
- [x] Mock data: 15 papers + 17 authors
- [x] Foundry setup + AttributionLedger.sol + 5 passing tests
- [x] Next.js scaffold + landing, research, leaderboard, verify pages
- [x] Agent logic via OpenRouter (GLM 4.5 Air primary, gpt-oss fallback) + citation weighting
- [x] x402 paywall helper + mock paper API
- [x] lib/ledger.ts viem reader + submitAttestation
- [x] Agent step 5 submits attestAndSplit on-chain
- [x] Leaderboard reads authorEarnings/authorCitations live
- [x] Verify page reads getQuery + CitationPaid events
- [x] .env template + env:sync script
- [ ] **Next (blocks D2):** user fills .env with PRIVATE_KEY, runs faucet

### D2 (Sun 19 Apr) — Contract deploy
- [ ] Fund deployer wallet at faucet.gokite.ai
- [ ] Acquire mock USDC on `0x0fF5393387ad2f9f691FD6Fd28e07E3969e27e63`
- [ ] Fill `PRIVATE_KEY`, `NEXT_PUBLIC_AGENT_OPERATOR_ADDRESS`, `NEXT_PUBLIC_ECOSYSTEM_FUND_ADDRESS` in `.env`
- [ ] `pnpm run contracts:deploy` on Kite testnet
- [ ] Copy deployed address → `NEXT_PUBLIC_ATTRIBUTION_LEDGER`
- [ ] `pnpm run env:sync` → `web/.env.local`
- [ ] Verify contract on testnet.kitescan.ai (confirm constructor values)
- [ ] Record addresses in docs/deployment.md

### D3 (Mon 20 Apr) — Live demo loop
- [ ] Pre-fund service wallet with ~10 mock USDC
- [ ] Run `/research` with live OPENROUTER_API_KEY
- [ ] Confirm step 5 lands real tx (see KiteScan)
- [ ] Visit `/verify/<queryId>` — see on-chain payouts
- [ ] Visit `/leaderboard` — see non-zero stats
- [ ] Snapshot transcript for video reel

### D4 (Tue 21 Apr) — x402 hardening
- [ ] Integrate real Pieverse facilitator settlement (swap mock)
- [ ] Handle 402 → retry-with-signature from agent side
- [ ] Agent Passport session simulation

### D5 (Wed 22 Apr) — UX polish
- [ ] Query form: budget slider, cost preview, result download (PDF/JSON)
- [ ] Streaming summary to frontend as the LLM emits tokens (OpenRouter SSE)
- [ ] Error recovery UI: retry on attestation failure
- [ ] Mobile layout pass

### D6 (Wed 23 Apr) — Frontend Polish
- [ ] Query form with budget slider
- [ ] Live "agent working" UI (step-by-step progress)
- [ ] Results view: summary + citations + receipt
- [ ] Download PDF + JSON

### D7 (Thu 24 Apr) — Leaderboard + Verify
- [ ] Public leaderboard: top earning authors
- [ ] Verify page: /verify/[queryId] shows on-chain attestation
- [ ] Author claim flow (ORCID input → wallet binding)

### D8 (Fri 25 Apr) — Deploy + Harden
- [ ] Deploy to Vercel
- [ ] Environment vars setup
- [ ] Stress test: 50 queries sequential
- [ ] Error boundaries on every async path
- [ ] Mobile responsive check

### D9 (Sat 26 Apr) — Demo Assets
- [ ] Record 90-sec demo video (OBS + Premiere or Descript)
- [ ] README final pass + screenshots
- [ ] Architecture diagram (excalidraw)
- [ ] Write pitch copy for submission form

### D10 (Sun 27 Apr) — Submit
- [ ] Final smoke test on live URL
- [ ] Tweet demo teaser
- [ ] Submit to Encode Club dashboard before 18:59 WIB
- [ ] Post in Kite Discord #general

## Daily Checkpoint Ritual

Every day 21:00 WIB:
1. Push latest to GitHub
2. Update README checkbox status
3. Post 1-line progress to Kite Discord
4. Screenshot current state for demo video reel

## Emergency Protocol

If blocked > 2 hours on single issue:
- Ask in Kite Discord #technical-questions (mentors active)
- Simplify: drop feature, keep critical path
- Never skip the contract deployment or the video
