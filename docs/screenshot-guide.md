# Kutip — Screenshot Capture Guide

> **Purpose:** the 9 visuals you'll attach to the Encode form, README, social posts, and presentation slides.
> **Format:** PNG, 1920×1080 minimum (or native 2x retina). Save under `docs/screenshots/`.
> **Naming:** `01-landing-hero.png`, `02-dashboard-research.png`, etc. — numeric prefix for ordering.

---

## Pre-shoot setup

Same as demo recording (see `demo-script.md` Section 1):
- Wallets funded (AA ≥1.5 USDC)
- Pre-warm Vercel
- Browser at 110% zoom (110% renders thicker text — looks more "designed")
- Hide bookmarks bar, dev tools closed, notifications muted
- **Light mode** for screenshots (looks better in submission attachments)

Capture tool: **Chrome DevTools → Run command → "Capture full size screenshot"** for full-page shots, OR **Lightshot** / built-in OS tool for crop.

---

## Shot 1 — `01-landing-hero.png`
**URL:** https://kutip-zeta.vercel.app
**Viewport:** Full width, scroll position TOP. Should show:
- Kutip wordmark + version chip
- Headline: "The research agent that pays its sources."
- "Enter Dashboard →" button hovered (mauve glow)
- MoneyFlow live diagram on the right
- 6-tile feature strip below

**Why:** First impression. Submission form's primary thumbnail.

---

## Shot 2 — `02-dashboard-research-idle.png`
**URL:** https://kutip-zeta.vercel.app/dashboard
**Viewport:** Full app shell, query input empty.
- Sidebar collapsed-but-visible with Research highlighted
- AgentStateFooter showing live balance + KitePass on-chain panel
- Query textarea pristine
- Step preview tiles below ("How a query runs")

**Why:** Shows the operator console at rest. "This is the working surface."

---

## Shot 3 — `03-dashboard-running.png`
**Trigger:** Run a fresh query, capture mid-flow at step 3 or 4.
**Viewport:** Dashboard during query.
- Sidebar still visible, balance unchanged
- Main panel: step ticker active with themed icon (e.g., "Reading with GLM" with brain icon spinning)
- Progress bar partial fill
- Animated dot ticker spelling current sub-step

**Why:** Captures the "agent is working" moment. Most demo-y of all 9.

---

## Shot 4 — `04-receipt-with-kitepass.png` ★
**Trigger:** Receipt after a successful query.
**Viewport:** Scroll to full receipt panel showing:
- Big emerald **Total USDC paid** number
- Authors paid table (3+ rows)
- "Authorized under session" row with `Passport ✓` chip
- **"Spending bounded by Kite Passport vault" row with `Kite Passport ✓` chip** — STAR OF THE SHOW
- "Mirrored on Avalanche Fuji" row with red LayerZero-pattern chip

**Why:** The single image that proves "real Kite Passport integration end-to-end". Use everywhere.

---

## Shot 5 — `05-kitescan-vault.png`
**URL:** https://testnet.kitescan.ai/address/0xe2c4e97738884fd6db2fbb62c1cd672ef1debc4c
**Action:** Click **Read Contract** tab, expand `getSpendingRules`.
- Show 2 rules: daily (10 USDC, X used) + per-tx (2 USDC, Y used)
- Address bar visible with the vault checksum

**Why:** On-chain proof that the receipt's claim is real. Pair with Shot 4 in slides.

---

## Shot 6 — `06-snowtrace-mirror.png`
**URL:** https://testnet.snowtrace.io/address/0x99359dAf4f2504dF3DA042cD38b8D01b8589E5fA
**Action:** Logs tab → filter `AttestationMirrored` event.
- Show 1+ event with `queryId`, `payerOnSource`, `totalPaid`, `citationCount`
- Address visible — emphasize "Avalanche Fuji" branding in URL

**Why:** Proves cross-chain mirror is live, not just claimed.

---

## Shot 7 — `07-claim-verified.png`
**URL:** https://kutip-zeta.vercel.app/dashboard/claim
**Action:** ORCID `0009-0002-8864-0901` typed, OAuth completed (`?verified=...` in URL).
- Green "Signed in as ORCID 0009-0002-8864-0901" badge
- Wallet connected indicator
- Step 4 "Sign delegation" button enabled

**Why:** Shows the security-not-theater claim flow. Hits "Real-World Applicability" judging criterion.

---

## Shot 8 — `08-leaderboard-podium.png`
**URL:** https://kutip-zeta.vercel.app/dashboard/earnings
**Viewport:** Top of page showing:
- Stat tiles (Authors paid · Citations · USDC distributed)
- Top-3 podium cards (gold/silver/bronze with medal emojis)
- "Are you one of these authors?" CTA banner

**Why:** Visualizes who got paid + onboards next-author claims. Strong story image.

---

## Shot 9 — `09-governance-safe.png`
**URL:** https://kutip-zeta.vercel.app/dashboard/governance
**Viewport:** "2 / 3 signers required" big number + 3 owner cards.
- Tagline: "No single person can move Kutip's money."
- Live Safe stats from chain (threshold, nonce, version)
- 3 signer addresses listed

**Why:** Trust signal. Shows we care about decentralization, not just delivery.

---

## Bonus — `10-architecture-diagram.png` (optional)

Render the mermaid diagram in `submission-copy.md` to PNG:

```bash
# install mermaid CLI if needed
npm install -g @mermaid-js/mermaid-cli

# extract diagram from submission-copy.md to a temp file (or copy by hand)
mmdc -i diagram.mmd -o docs/screenshots/10-architecture-diagram.png -w 1600 -H 1200 -b transparent
```

Or use https://mermaid.live → paste → export PNG.

**Why:** Submission form often has "architecture diagram" field. Pre-rendered = ready.

---

## Where each shot ships

| Shot | README header | Submission form | X thread | LinkedIn | Slides |
|---|---|---|---|---|---|
| 1 Landing | ✓ | thumbnail | post 1 | hero | title slide |
| 2 Dashboard idle | | | post 2 | | |
| 3 Dashboard running | | gallery | post 3 | mid-image | demo flow slide |
| 4 Receipt + KitePass | ✓ | gallery | post 4 ★ | gallery | proof slide ★ |
| 5 KiteScan vault | | gallery | post 5 ★ | gallery | proof slide ★ |
| 6 SnowTrace mirror | | gallery | post 6 | | cross-chain slide |
| 7 Claim verified | | gallery | reply | gallery | identity slide |
| 8 Leaderboard | ✓ | gallery | post 7 | | impact slide |
| 9 Governance | | gallery | reply | | trust slide |
| 10 Architecture | | required field | post 0 | hero | architecture slide |

---

## Capture day workflow

1. **Morning:** AA balance check, pre-warm site. Run 1 throwaway query — that produces fresh data for Shots 3–6.
2. **Sequential capture (Shots 1, 2, 3, 4, 7, 8, 9):** ~20 minutes.
3. **External (Shots 5, 6):** open KiteScan + SnowTrace, capture in same session — fewer tab juggles.
4. **Architecture diagram (Shot 10):** render mermaid → save → done.
5. **Verify all 10 shots are 1080p+ and have no PII (no `localhost` URLs, no devtools, no chat windows).**
6. **Compress** for upload: TinyPNG or `pngquant -Q 80-95` to keep them under 2MB each.

---

## Common mistakes to avoid

- ❌ **Cropping too tight** — leave 40px breathing room on all sides. Submission form thumbnails sometimes auto-pad.
- ❌ **Capturing devtools bar** — close everything before screenshot.
- ❌ **Wrong-mode screenshots** — pick light or dark and stick with it across all 10 shots.
- ❌ **Stale data** — `0 attestations` looks bad; do a fresh query first.
- ❌ **Wallet selector visible** — disconnect & reconnect to clear popups before capturing.
