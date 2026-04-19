# Kutip — QA Checklist

> Two passes: **automated** (handled by `web/scripts/qa-test.mjs`) and
> **manual** (stuff that needs human eyes + MetaMask + browser).
> Run both before D10 submission.

---

## 🤖 Automated pass

```bash
cd web
node scripts/qa-test.mjs                      # against prod
node scripts/qa-test.mjs http://localhost:3000 # against local dev

# And contract tests
cd ../contracts && forge test

# And web typecheck
cd ../web && ./node_modules/.bin/tsc --noEmit
```

### Current coverage (as of 2026-04-19 · 34/34 QA + 34/34 forge all green)

#### Page smoke (10)
- [x] `/` — tagline + 3 AA addresses rendered
- [x] `/research` — 200
- [x] `/agents` — ERC-8004 + ERC-6551 chips visible, Researcher + Summarizer cards
- [x] `/leaderboard` — "Stats indexed by Goldsky"
- [x] `/verify` — "Verify any query" index
- [x] `/verify/<knownQueryId>` — "Attested on Kite" chip
- [x] `/claim` — 200
- [x] `/escrow` — "Citations earn yield until claimed" + "5% APY"
- [x] `/bounties` — "Sponsor research you care about"
- [x] `/verify/lookup?q=…` → 307 redirect

#### API endpoints (7)
- [x] `/api/warmup` → AA enabled, chainId 2368
- [x] `/api/x402-status` → Pieverse reachable, Kite supported
- [x] `/api/orcid-check?orcid=0000-0002-1825-0097` → real (Josiah Carberry)
- [x] `/api/orcid-check?orcid=0000-0001-1234-0001` → catalog (Dr. Sarah Chen)
- [x] `/api/orcid-check?orcid=9999-9999-9999-9998` → 404
- [x] `/api/summaries` → directory with `count` + `totalRevenueUSDC`
- [x] `/api/summaries/<queryId>` → 402 (with accepts[] + x402Version) OR 404 on cold start

#### Subgraph (5)
- [x] `_meta` — indexed past deploy, zero errors
- [x] `attestations` query returns valid rows
- [x] `authors` query returns valid rows with non-zero earnings
- [x] `attestation(id: knownQueryId)` — 3 citations summing to 10000 bps
- [x] `authorDayStats` — at least 1 daily record

#### On-chain reads (10)
- [x] AttributionLedger deployed (has bytecode)
- [x] UnclaimedYieldEscrow — `totalPrincipalOutstanding()` callable
- [x] BountyMarket — `bountyCount() >= 1`
- [x] AgentReputation — `tokenCount() >= 2`
- [x] AgentRegistry8004 — `agentCount() >= 2`
- [x] ERC-6551 Registry deployed
- [x] ERC-6551 Account impl deployed
- [x] Researcher TBA — bytecode at derived address
- [x] Summarizer TBA — bytecode at derived address
- [x] Pieverse facilitator `/v2/supported` includes `eip155:2368`

#### Data integrity (2)
- [x] Subgraph attestation count ≥ 3
- [x] Subgraph totalEarnings > 0

---

## 👀 Manual pass (D10 morning, pre-submission)

Run each in a fresh private window so no cached state.

### Visual — light mode
- [ ] `/` — 4 identity pills (Researcher + Summarizer + AttributionLedger + Pieverse facilitator). Money-flow SVG animates with 4 coins.
- [ ] `/research` — idle state centered. Budget 1 highlighted. Try sample query button styled.
- [ ] `/research` — running state. 5 step rows animate (breathing kite-500 border on current, done = emerald check).
- [ ] `/research` — result state. Summary serif italic question. Receipt panel first row emerald. Tx chip pulse-ring animation runs once.
- [ ] `/agents` — 2 NFT cards (Researcher + Summarizer). Each shows AA wallet + TBA address + ERC-6551/ERC-8004 chips + capabilities snippet.
- [ ] `/leaderboard` — sparklines on top earners show real lines (not flat). Top row emerald-50 bg.
- [ ] `/verify` — index shows 3+ attestations. QueryId lookup form.
- [ ] `/verify/<id>` — Stripe receipt, 3 payout rows, "Reverse x402 · paywalled" panel visible.
- [ ] `/escrow` — stat tiles at top, seeded deposits listed with hash + principal + accrued yield.
- [ ] `/bounties` — 1 active bounty (carbon capture 2024) in table, chip says "active".
- [ ] `/claim` — input pre-filled with Josiah Carberry. After 500ms: "Verified · orcid.org · 6 works".

### Visual — dark mode
Toggle via TopNav moon icon, sweep all 9 pages.
- [ ] All backgrounds invert cleanly (no hard-coded whites)
- [ ] Emerald chips still readable against dark surface
- [ ] Pattern-grid dots visible at low opacity
- [ ] Money-flow SVG text readable

### Mobile (375–390 width via DevTools or real phone)
- [ ] TopNav wraps, wallet chip drops to icon
- [ ] Research page sidebar stacks above main panel
- [ ] Payout rows collapse to single column
- [ ] Leaderboard table horizontal-scrolls
- [ ] /agents cards stack to single column
- [ ] /bounties + /escrow tables scroll horizontally

### MetaMask flows (real wallet, Kite testnet network added)
- [ ] `/claim` step 1 → Connect wallet → MetaMask popup
- [ ] `/claim` step 2 — `0000-0002-1825-0097` (Josiah) → "Verified · orcid.org"
- [ ] `/claim` step 3 — Sign → MetaMask shows plain-text claim message → Sign
- [ ] `/claim` result — emerald "Bound to Josiah Carberry ✓" banner
- [ ] `/leaderboard` refresh — Josiah now shows with claimed wallet on next-matching-query

### Full research query (AA pre-funded with ≥1.2 Test USD)
- [ ] Pick sample query → budget 1 → click Pay
- [ ] All 5 steps finish within 40s warm (60s cold)
- [ ] Step 5 reads "Settled via agent smart account (AA)"
- [ ] Receipt panel animates staggered rows
- [ ] Tx chip pulse-ring animation
- [ ] Click chip → KiteScan tx has 3-5 ERC20 Transfer events
  - Sub-agent fee to Summarizer
  - Transfer to AttributionLedger
  - Author payouts or Escrow routing
- [ ] Summarizer TBA balance went up by 0.05
- [ ] Leaderboard refresh within ~1min — new citations visible
- [ ] Escrow row added if any author was unclaimed

### Demo video readiness
- [ ] `/api/warmup` fired within last 10 minutes
- [ ] AA wallet has ≥3 Test USD (enough for 2 demo queries)
- [ ] OBS / screen recorder at 1080p 60fps, no compression
- [ ] Webcam framed, mic gain checked, no notifications enabled
- [ ] Browser zoom 100%, DevTools closed, bookmarks hidden
- [ ] 5 tabs pre-loaded: `/`, `/research`, `/agents`, `/verify`, `/leaderboard`
- [ ] MetaMask unlocked, Kite testnet selected
- [ ] Script handy — `docs/submission-copy.md` on second screen

---

## 🔴 Known limits (document, don't fix)

| Thing | Why | Mitigation |
|---|---|---|
| Vercel cold start adds ~15s to first query after idle | Hobby tier | Fire `/api/warmup` manually ~5min before demo |
| OpenRouter free tier ~200 req/day | Tier limit | Swap `OPENROUTER_MODEL` → paid if exhausted |
| Subgraph index lag 30-60s after new tx | Goldsky re-indexing | Mention during voice-over |
| Pieverse full x402 signing not wired | Test USD lacks EIP-3009 | Handshake + reachability only |
| `/claim` registry resets on cold start | Per-process in-memory | Production needs NameRegistry contract |
| `/api/summaries` cache resets on cold start | Per-process in-memory | Production needs IPFS/Arweave |
| Ash Safe not in production flow | Testnet deploy not confirmed | Currently uses EOA as ecosystemFund |
| ORCID claims + escrow integration is post-attest (2-tx) | Escrow.operator immutable = EOA | Transactions sequential, both required for success |
| OpenSea / KiteScan may not render URL-encoded tokenURI | Base64 was skipped for solc 0.8.24 compat | Some explorers handle data:application/json,{...} fine, others don't. Non-blocking for function. |

---

## 🚨 Pre-submission dry run

Morning of 2026-04-27, ≤4 hours before 18:59 WIB deadline:

1. [ ] Run `node scripts/qa-test.mjs` → 34/34 green
2. [ ] Run `cd contracts && forge test` → 34/34 green
3. [ ] Visual pass — one lap through all 9 pages in each theme
4. [ ] One full research query end-to-end (funded AA)
5. [ ] One ORCID claim with real wallet (Josiah or mas Huda's own)
6. [ ] Fire `/api/warmup` right before recording
7. [ ] Record demo video (90s) — follow `docs/submission-copy.md` shot list
8. [ ] Upload unlisted to YouTube, grab URL
9. [ ] Fill Encode Club form (field map in `docs/submission-copy.md`)
10. [ ] Submit
11. [ ] Post tweet + LinkedIn + Discord `#general`

---

## Contract reference (for forge tests + on-chain checks)

| Contract | Address | Tests |
|---|---|---|
| AttributionLedger | `0x99359DaF4f2504dF3da042cd38B8d01B8589E5Fa` | 5 |
| UnclaimedYieldEscrow | `0xcbab887da9c2a16612a9120b4170e74c50547b40` | 8 |
| BountyMarket | `0x1ba00a38b25adf68ac599cd25094e2aa923b3f72` | 7 |
| AgentReputation (ERC-721) | `0x8f53EB5C04B773F0F31FE41623EA19d2Fd84db15` | 7 |
| AgentRegistry8004 | `0xde6d6ab98f216e6421c1b73bdab2f03064d27dcd` | 7 |
| ERC-6551 Registry | `0x2f432effbbd83df8df610e5e0c0057b65bd31012` | — |
| ERC-6551 Account impl | `0x7d9c63f12af5ad7a18bb8d39ac8c1dd23e95f456` | — |

| Agent identity | Address | TBA |
|---|---|---|
| Researcher (AA) | `0x4da7f4cFd443084027a39cc0f7c41466d9511776` | `0xb1fa88ba20561378a67c3a2d477a2461c704df04` |
| Summarizer (AA) | `0xA6C36bA2BC8E84fCF276721F30FC79ceD609ef5c` | `0xb92d484150efadfb23c55749afad3d7072bd8323` |
