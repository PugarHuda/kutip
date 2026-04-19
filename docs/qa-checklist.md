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
```

Exits non-zero on any failure. Current covers:
- [x] All 6 pages return 200 (`/`, `/research`, `/leaderboard`, `/verify`, `/verify/[id]`, `/claim`)
- [x] `/verify/lookup` redirect works
- [x] `/api/warmup` → AA enabled, chainId 2368, researcher address matches
- [x] `/api/x402-status` → Pieverse reachable, Kite testnet supported
- [x] `/api/orcid-check` — real, catalog, unknown (404), malformed (400)
- [x] Goldsky subgraph `_meta` — indexed past deploy block, zero errors
- [x] Subgraph attestations query returns valid rows
- [x] Subgraph authors query returns valid rows with non-zero earnings
- [x] Known queryId resolves with 3 citations summing to 10000 bps
- [x] Data integrity — ≥3 attestations, >0 total earnings

**Last run**: 20/20 green · 3 attestations · 5 authors · 1.2 USDC paid.

---

## 👀 Manual pass (D10 morning, pre-submission)

Run each in a fresh private window (so no cached state).

### Visual — light mode
- [ ] `/` — identity block shows Researcher + Summarizer + Ledger + Pieverse facilitator (4 rows). Money-flow SVG animates smoothly.
- [ ] `/research` — idle state centered. Budget 1 highlighted. Try sample query button styled.
- [ ] `/research` — running state. 5 step rows animate (breathing kite-500 border on current, done = emerald check).
- [ ] `/research` — result state. Summary serif italic question at top. Receipt panel first row emerald. Tx chip pulse-ring animation runs once.
- [ ] `/leaderboard` — 7-day sparklines on top earners show real lines (not flat). Top row emerald-50 bg + left border.
- [ ] `/verify` — index shows 3+ attestations. QueryId lookup form visible.
- [ ] `/verify/0x2f273ac8…` — Stripe-style receipt, 3 payout rows, "Attested on Kite · Xm ago" chip.
- [ ] `/claim` — input pre-filled with Josiah Carberry. Preview card shows "Verified · orcid.org · 6 works" after 500ms debounce.

### Visual — dark mode
Toggle via TopNav moon icon, same sweep as above.
- [ ] All backgrounds invert cleanly (no hard-coded whites left over)
- [ ] Emerald chips still readable against dark surface
- [ ] Pattern-grid dots visible at low opacity
- [ ] Money-flow SVG text readable (foreign-color text fill)

### Mobile (375–390 width via DevTools or real phone)
- [ ] TopNav wraps, wallet chip drops to single icon
- [ ] Research page sidebar stacks above main panel
- [ ] Payout rows collapse to single column
- [ ] Leaderboard table horizontal-scrolls (no broken layout)
- [ ] Money-flow SVG scales to fit

### MetaMask flows (requires real wallet with Kite testnet network added)
- [ ] `/claim` step 1 — Connect wallet → MetaMask popup → account appears in button
- [ ] `/claim` preview — try `0000-0002-1825-0097` (Josiah) → "Verified · orcid.org"
- [ ] `/claim` step 3 — Sign → MetaMask shows plain-text claim message → click Sign
- [ ] `/claim` result — emerald "Bound to Josiah Carberry ✓" banner
- [ ] Go back to `/leaderboard` → Josiah Carberry appears with claimed wallet (after next query cites a matching paper)

### Full research query (requires AA pre-funded with ≥1.2 Test USD)
- [ ] Pick `direct air capture 2024` → budget 1 → click Pay
- [ ] Watch all 5 steps finish within 40s warm (or 60s cold)
- [ ] Step 5 label reads "Settled via agent smart account (AA)"
- [ ] Receipt panel animates in with staggered rows
- [ ] Tx chip pulse-ring animates once on reveal
- [ ] Click chip → opens KiteScan in new tab, verify tx has 3-4 ERC20 Transfer log entries (sub-agent fee + ledger fund + author payouts)
- [ ] Summarizer wallet balance increased by 0.05 USDC (check via KiteScan)
- [ ] Leaderboard refreshes to include new citations within ~1 minute (subgraph reindex)

### Demo video readiness
- [ ] `/api/warmup` fired within last 10 minutes (check timestamp)
- [ ] AA wallet has ≥3 Test USD (enough for 2 demo queries)
- [ ] OBS / screen recorder configured 1080p, 60fps, no compression
- [ ] Webcam framed, mic gain checked, no notifications enabled
- [ ] Browser zoom 100%, DevTools closed, bookmarks bar hidden
- [ ] 4 tabs pre-loaded: `/`, `/research`, `/verify`, `/leaderboard`
- [ ] MetaMask unlocked, Kite testnet selected
- [ ] Script handy — `docs/submission-copy.md` open on second screen

---

## 🔴 Known limits (document, don't fix)

| Thing | Why | Mitigation |
|---|---|---|
| Vercel cold start adds ~15s to first query after >30min idle | Hobby tier, 1 cron/day max | Fire `/api/warmup` manually ~5 min before demo |
| OpenRouter free tier ~200 req/day | Tier limit | If exhausted, swap `OPENROUTER_MODEL` → `anthropic/claude-sonnet-4-6` with billing; cost ~$0.003/query |
| Subgraph index lag 30-60s after new tx | Goldsky re-indexing | Mention during demo voice-over ("refreshes within a minute") |
| Pieverse full x402 signing not wired | Test USD token lacks EIP-3009 | Handshake + reachability only; documented in `lib/pieverse.ts` |
| `/claim` registry resets on Vercel cold start | Per-process in-memory Map | Known demo limit; production needs NameRegistry contract |
| EOA wallet's Test USD might drain | Each query burns ~0.4 Test USD (40% to real/synthetic authors) | Top up via `node scripts/fund-aa.mjs 0x4da7… 2` |

---

## 🚨 Pre-submission dry run

The morning of 2026-04-27, ≤4 hours before 18:59 WIB deadline:

1. [ ] Run automated QA: `node scripts/qa-test.mjs` → 20/20 green
2. [ ] Visual pass — one lap through all pages in each theme
3. [ ] One full query end-to-end with real AA wallet
4. [ ] One ORCID claim with real wallet
5. [ ] Fire `/api/warmup` right before recording
6. [ ] Record demo video
7. [ ] Upload unlisted to YouTube, grab URL
8. [ ] Fill Encode Club form (`docs/submission-copy.md` field map)
9. [ ] Submit
10. [ ] Post tweet + LinkedIn + Discord `#general`
