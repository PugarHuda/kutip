# Kutip — 90-Second Demo Recording Playbook

> **For:** the 1-take recording you'll upload to YouTube + paste into the Encode submission form.
> **Length target:** 90s ± 5s. Anything over 100s loses judges.
> **Resolution:** 1920×1080 minimum, 30fps.

---

## 1. Pre-Flight Checklist

Run through this **30 minutes before record** so nothing surprises you mid-take.

### Wallet state
```
EOA  0x5C91B851D9Aa20172e6067d9236920A6CBabf40c   ≥ 1 USDC + ≥ 0.5 KITE
AA   0x4da7f4cFd443084027a39cc0f7c41466d9511776   ≥ 1.5 USDC
```

Quick check:
```bash
cd web && node -e "const {createPublicClient,http,formatUnits}=require('viem');const c=createPublicClient({transport:http('https://rpc-testnet.gokite.ai')});const abi=[{name:'balanceOf',type:'function',stateMutability:'view',inputs:[{type:'address'}],outputs:[{type:'uint256'}]}];const USD='0x0fF5393387ad2f9f691FD6Fd28e07E3969e27e63';(async()=>{console.log('EOA:',formatUnits(await c.readContract({address:USD,abi,functionName:'balanceOf',args:['0x5C91B851D9Aa20172e6067d9236920A6CBabf40c']}),18));console.log('AA :',formatUnits(await c.readContract({address:USD,abi,functionName:'balanceOf',args:['0x4da7f4cFd443084027a39cc0f7c41466d9511776']}),18));})()"
```

If AA <1.5 USDC: `node web/scripts/fund-aa.mjs 0x4da7f4cFd443084027a39cc0f7c41466d9511776 1.0`

### Browser tabs (open in this order, **left to right**)
1. https://kutip-zeta.vercel.app — landing
2. https://kutip-zeta.vercel.app/dashboard — research workbench
3. https://kutip-zeta.vercel.app/dashboard/claim — claim page (have your ORCID handy: `0009-0002-8864-0901`)
4. https://kutip-zeta.vercel.app/dashboard/governance — Safe page
5. https://testnet.kitescan.ai/address/0xe2c4e97738884fd6db2fbb62c1cd672ef1debc4c — KitePass vault on KiteScan
6. https://testnet.snowtrace.io/address/0x99359dAf4f2504dF3DA042cD38b8D01b8589E5fA — Fuji mirror

### Pre-warm Vercel
Cold start = ~15-30s lag. Pre-warm before record:
```bash
curl -s https://kutip-zeta.vercel.app/api/warmup
curl -s https://kutip-zeta.vercel.app/api/balances
curl -s https://kutip-zeta.vercel.app/api/kitepass/info
```

Then fire **one throwaway query** in the browser so the LLM warms up:
- Open `/dashboard`, paste "carbon capture methods in 2024", click Pay
- Wait for result (~25-30s warm)
- Refresh page (clears the result so the next "live" query feels fresh)

### Recording tools
- **OBS Studio** (free) — Display Capture source, 1080p output
- **Audio:** dedicated mic if possible. Filter: noise suppression on.
- **Mouse:** turn cursor highlighting ON (`OBS Settings > Mouse cursor`)
- **Webcam corner** (optional): bottom-right, 240×135px circle. Builds trust.
- **Background music:** lofi at -22 dB. Get from YouTube Audio Library.

### Browser hygiene
- Hide bookmarks bar (`Ctrl+Shift+B`)
- Use Chrome Incognito + only ONE Kutip-related extension visible (MetaMask)
- Make font scaling 110% so tiny text reads on small playback
- DevTools closed
- Notifications muted (Slack/Discord)

---

## 2. Shot List (90 seconds total)

### Shot 1 — Hook (0:00 → 0:08) · 8s
**Frame:** KiteScan tab on the KitePass vault address. Show the spending rules section with `amountUsed: X / 10 USDC daily`.

**Voice (steady, no rush):**
> "Three days ago, an AI agent paid four researchers — and none of them
> asked. It cited their papers, then sent them USDC."

### Shot 2 — Landing (0:08 → 0:18) · 10s
**Action:** Cmd-click landing tab. Cursor follows down the hero, then "Enter Dashboard" button glows on hover.

**Voice:**
> "This is Kutip. The first agent shipping real Kite Passport delegation
> end-to-end. Authors get paid, agents stay bounded, every receipt
> mirrors cross-chain."

**Click "Enter Dashboard."**

### Shot 3 — Sidebar tour (0:18 → 0:30) · 12s
**Frame:** /dashboard. Sidebar visible.

**Action sequence:**
1. Cursor lingers on "Research" (active)
2. Slow scroll the right side showing query input + budget
3. Cursor moves down the sidebar — point to AgentStateFooter ("Researcher AA · 1.04 USDC", "KitePass on-chain · 0.0/10.0 daily")
4. Cursor hovers the "↗" next to KitePass on-chain — KiteScan opens in new tab in the corner of the screen briefly

**Voice:**
> "On the left — the agent's wallet, balance, and Kite Passport vault
> with live spending rules pulled straight from chain. Two USDC per query
> max. Ten USDC per day. Anyone can verify."

### Shot 4 — Run query (0:30 → 0:55) · 25s
**Action:**
1. Click query input
2. Type **"Compare mineralization vs biochar for long-term carbon storage"** (don't paste — typing reads more genuine on camera, and you'll want autocomplete suggestions OFF)
3. Budget click `0.5` (2nd preset chip)
4. Click big "Pay 0.50 USDC & research" button
5. Step ticker animates — DON'T cut camera. Each step shows themed icon.

**Voice (timed to the steps):**
> "I ask. I authorize 0.5 USDC. The agent searches Semantic Scholar.
> Pays for each paper via x402. Reads them with an LLM. Builds the
> citation ledger." *(pause for last step)*  "And settles atomically
> on Kite — sub-agent fee, ledger transfer, and revenue split — in one
> UserOperation, sponsored by the paymaster."

### Shot 5 — Receipt + KitePass + mirror (0:55 → 1:15) · 20s
**Action:**
1. Receipt animates in. Big emerald number shows USDC paid.
2. Scroll past summary text (1s), past authors paid table (3s)
3. Land on **"Spending bounded by Kite Passport vault"** row — `Kite Passport ✓` chip glows
4. **CLICK the vault address** — KiteScan tab opens
5. Show the spending rules — point at the `amountUsed` field which now reads `0.5 USDC` (just spent)
6. Cmd-Tab back, scroll one more row to **"Mirrored on Avalanche Fuji"**
7. Click the Fuji tx hash — SnowTrace shows `AttestationMirrored` event

**Voice:**
> "The receipt. Every author, their cut, their wallet. Spending bounded
> by our Kite Passport vault — click — see the rules and the daily
> usage just ticked up. And — within seconds — this attestation
> mirrors to Avalanche Fuji. Cross-chain citation proof, zero gas
> from my pocket."

### Shot 6 — ORCID + governance (1:15 → 1:25) · 10s
**Action:**
1. Sidebar → "Claim as Author"
2. ORCID input pre-filled with `0009-0002-8864-0901`
3. Click "Verify via ORCID" — quick redirect (don't fully demo OAuth — implies it works)
4. Cmd-Tab to /dashboard/governance
5. "2 / 3 signers" big number visible

**Voice:**
> "Authors prove ORCID via real OAuth — log into orcid.org, never
> guess. Bind on chain. And the ecosystem fund? Two-of-three Safe
> multisig. Even I can't move the money alone."

### Shot 7 — CTA (1:25 → 1:30) · 5s
**Frame:** Cut to landing hero. Tagline visible.

**Voice:**
> "Kutip. The research agent that pays its sources. Built on Kite.
> Link below."

---

## 3. Recovery Protocol

If something breaks **mid-take**:

| Issue | Fix in real-time |
|---|---|
| Cold-start lag at Shot 4 | Don't restart. Voiceover: "While the agent boots up, watch the step ticker explain what it's about to do." |
| Receipt fails (revert) | Cut to KiteScan showing a previous successful tx. Reuse Shot 5 voiceover. |
| Wallet popup blocks | Pre-approve session before record. Or fall back to "this is normally where MetaMask asks once" voiceover. |
| Browser zoom/overlay | Zoom levels: site at 110%, KiteScan at 100%, SnowTrace at 100%. Set BEFORE recording. |
| Mic clip / pop | Re-record only that 5s shot, splice in editor (DaVinci Resolve free, Descript). |

---

## 4. Post-Production

1. **Trim** intro/outro silence (target hard 90s).
2. **Add captions** — Descript or YouTube auto-caption + manually fix names/addresses. 90% of judges watch muted.
3. **Add tagline overlay** at Shot 1 ("First agent shipping real Kite Passport delegation") in upper-third for 4s.
4. **Add KiteScan tx hash overlay** at Shot 5 climax for 3s — prevents "fake demo" suspicion.
5. **Outro card** (Shot 7): logo + URL + "Submit: [Encode Club hackathon link]"
6. **Music duck** — drop music to -30 dB during voice; back to -22 dB for outro.

---

## 5. Distribution

| Platform | Action |
|---|---|
| **YouTube** | Upload as **unlisted**, paste URL into Encode form |
| **X** | Tweet with thread: hook + 3-feature beats + final demo URL · tag @GoKiteAI @encodeclub |
| **LinkedIn** | Long-form post with full pitch + video embed |
| **Discord** | `#general` in Kite hackathon — pin via team |
| **GitHub README** | Embed video at top of README — judges who land on GitHub see it instantly |

---

## 6. Submission Form Field Map

| Field | Source |
|---|---|
| Project name | `Kutip` |
| Tagline | `Citations that pay.` |
| Live URL | `https://kutip-zeta.vercel.app` |
| Repo URL | `https://github.com/PugarHuda/kutip` |
| Video URL | YouTube unlisted link from Section 5 |
| Short description | Use 100-word tech summary in `submission-copy.md` |
| Long description | Use 200-word pitch in `submission-copy.md` |
| Track | Novel |
| Built on | Kite AI · OpenRouter · Foundry · Vercel · Semantic Scholar · ORCID · Goldsky · Pieverse · LayerZero-pattern (Avalanche Fuji) · Safe |
| Team | Pugar Huda Mantoro (solo · @PugarHuda) |
| Email | pugarhudam@gmail.com |

---

## 7. Final Smoke Test (the morning of submission)

```bash
cd web && node scripts/qa-test.mjs   # expect 53/53 green
curl -s https://kutip-zeta.vercel.app/api/kitepass/info | grep configured  # configured":true
curl -s https://kutip-zeta.vercel.app/api/warmup | grep aaEnabled            # true
```

If any of these red — **don't submit**. Fix first. The 17th deadline is locked but submitting at 1am beats submitting at 11:59pm with a known break.
