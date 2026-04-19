# Kutip — 10-Day Sprint Plan · Status 2026-04-19

> Deadline: 2026-04-27 18:59 WIB · 8 days of buffer remaining
>
> **Executed 8 of 10 plan-days' worth of work in 2 calendar days.**
> Core build + deploy + multi-agent done early. Only submission-prep left.

## Daily Breakdown

### D1 (Sat 18 Apr) — Scaffold ✅
- [x] Project structure
- [x] README.md, CLAUDE.md, .env.example
- [x] Mock data: 15 papers + 17 authors
- [x] Foundry + AttributionLedger.sol + 5/5 tests passing
- [x] Next.js scaffold: landing, research, leaderboard, verify
- [x] Agent logic via OpenRouter (GLM 4.5 Air + gpt-oss fallback)
- [x] x402 paywall helper + mock paper API
- [x] lib/ledger.ts + submitAttestation
- [x] On-chain attestation wired (step 5)
- [x] Leaderboard + Verify page read live

### D2 (Sun 19 Apr) — Contract deploy ✅
- [x] Deployer funded via `faucet.gokite.ai`
- [x] Test USD acquired (18-dec discovered, code adjusted)
- [x] `.env` filled (PK, operator, ecosystem, OpenRouter)
- [x] `forge script Deploy.s.sol --broadcast` on Kite testnet
- [x] **AttributionLedger live at [`0x99359DaF…E5Fa`](https://testnet.kitescan.ai/address/0x99359DaF4f2504dF3da042cd38B8d01B8589E5Fa)**
- [x] `env:sync` → `web/.env.local`
- [x] On-chain constructor values verified
- [x] Deployment log updated

### D3 (Sun 19 Apr · early) — Live demo loop ✅
- [x] AA service wallet funded
- [x] `/research` with live OpenRouter → real 3-paragraph summary w/ citations
- [x] **First real attestation: tx [`0x2b808988…`](https://testnet.kitescan.ai/tx/0x2b808988549efd3a001949ea7c155a55c8bfa56c9b2efe80f09050740b1de874)**
- [x] `/verify/<queryId>` shows on-chain payouts
- [x] `/leaderboard` non-zero stats
- [x] Snapshots captured

### D4 (Sun 19 Apr · equivalent) — Identity layer ⚠️
- [ ] Real Pieverse facilitator settlement (still mock — LOW priority, judges see attestation, not x402 internals)
- [ ] 402 retry-with-signature (still mock)
- [x] **Agent Passport equivalent via `gokite-aa-sdk`** — EIP-4337 AA wallet `0x4da7f4cF…1776`
- [x] Kite paymaster wired — agent pays gas in Test USD, no KITE needed
- [ ] Full passport signup/session (awaiting testnet invite — code structured for drop-in)

### D5+D6 (Sun 19 Apr) — UX + Frontend polish ✅
- [x] Budget stepper (1/2/5/10 pills + custom path)
- [x] Live agent-working UI (5 phases streamed via SSE)
- [x] Result panel: summary + receipt + bibliography
- [x] Full hi-fi design port from Claude Design bundle
- [x] Dark mode toggle (`/api/warmup` keeps cold-starts <20s)
- [x] Mobile responsive pass (tested @ 390px)
- [x] Streaming summary as tokens emit — NOT done (low pri, blocks demo consistency)
- [x] Download receipt/summary — buttons present but stubbed

### D7 (Sun 19 Apr) — Leaderboard + Verify + Claim ✅
- [x] Public leaderboard (Dune-style dense table, 7 cols, sparklines)
- [x] `/verify/[queryId]` Stripe-style receipt with live CitationPaid events
- [x] **Author claim flow `/claim`** — ORCID input + wallet sign + server verify
- [x] `getAuthor()` resolves claimed wallet over mock at query time

### D8 (Sun 19 Apr) — Deploy + Harden ✅
- [x] Vercel production at **https://kutip-zeta.vercel.app**
- [x] 13 env vars pushed via `push-vercel-env.sh`
- [x] Stress test: 5 concurrent → p95 58s → bumped `maxDuration` to 120s
- [x] Warmup cron → daily 0800 UTC
- [x] Mobile responsive verified
- [ ] Error boundaries on every async path (partial — happy + known-error paths covered)

### D9 (Sat 26 Apr) — Demo Assets ❌ NOT YET
- [ ] Record 90-sec demo video (OBS + Descript edit)
- [ ] README final pass with live URLs (partially done)
- [ ] Architecture diagram (excalidraw)
- [ ] Pitch copy for submission form (200 words)
- [ ] Tweet draft for launch

### D10 (Sun 27 Apr) — Submit ❌ NOT YET
- [ ] Final smoke test on live URL
- [ ] Submit to Encode Club dashboard before 18:59 WIB
- [ ] Tweet demo teaser
- [ ] Post in Kite Discord #general

## Bonus — not on original plan ✅
- [x] **Multi-agent composition**: Summarizer sub-agent at [`0xA6C36bA2…ef5c`](https://testnet.kitescan.ai/address/0xA6C36bA2BC8E84fCF276721F30FC79ceD609ef5c) — receives 5% of every query atomically from Researcher
- [x] **Semantic Scholar integration** (`KUTIP_USE_SEMANTIC_SCHOLAR=1`) — real academic corpus w/ graceful fallback
- [x] **Full hi-fi design port** from Claude Design bundle (pixel-close)
- [x] **`/api/warmup` + Vercel cron** — keeps cold start <15s

## What's ACTUALLY left before submission

**Must-have (3-5 hours total):**
1. **90-second demo video** (D9) — script + record + edit → upload
2. **Submission form copy** (D9) — 200-word pitch, tech summary, screenshots
3. **Final smoke test** (D10) — full flow recording from cold start
4. **Submit to Encode Club** (D10) — before 2026-04-27 18:59 WIB

**Nice-to-have:**
- Architecture diagram (1h)
- Tweet / LinkedIn launch post (30 min)
- Real Pieverse x402 integration (2-3h, LOW judge visibility)
- Download-receipt-as-JSON actually working (30 min)
