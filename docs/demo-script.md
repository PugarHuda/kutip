# Kutip — 90-Second Demo Script

## Pre-production

- Record at 1080p minimum
- Use OBS for screen capture
- Webcam corner for face narration (builds trust)
- Background music: light lofi at -20dB

### Timing reality (from 2026-04-19 prod stress test)

| Phase | Latency |
|---|---|
| Vercel cold start | ~15s (first query after idle) |
| Warm query end-to-end | ~25-30s |
| p95 worst case | ~58s |

**Pre-warm before recording.** Run one throwaway query before hitting record.
Otherwise the shot will have a 15s pause that reads as "broken."

Warmup cron hits `/api/warmup` every 30 min — if you haven't visited the site
in 2+ hours, expect another cold start. Re-warm.

## Shot List

### Shot 1 — Hook (0:00 → 0:10)
**Visual:** Split screen — left: news headline "AI Companies Sued by Authors", right: pile of unpaid citations.
**Narration:**
> "AI agents scrape researchers' work for free. Authors stay poor.
> Kite's vision says this is broken. I built the fix."

### Shot 2 — Product Walkthrough (0:10 → 0:40)
**Visual:** Desktop recording of Kutip landing → research page.
- Paste: "Find top 3 carbon capture methods in 2024"
- Click "Pay 2 USDC via x402"
- Wallet pops (1 click, gasless)
- Dashboard live: "Agent buying paper 1 of 5..."

**Narration:**
> "One click. Two USDC. Agent searches, buys five paywalled papers,
> reads them with Claude — Kite's AI partner."

### Shot 3 — The Magic Moment (0:40 → 1:00)
**Visual:** Summary appears. Click "Attribution receipt" panel.
Zoom into on-chain proof:
- 0.80 USDC → Dr. Chen (3 citations)
- 0.40 USDC → Dr. Hoffmann (2 citations)
- 0.30 USDC → Dr. Sigurdsson (1 citation)
- 0.30 USDC → Dr. Sharma (1 citation)
- ...all via AttributionLedger contract

**Narration:**
> "Here's the magic.
> Every citation triggers a payment back to the author.
> Cryptographically. Instantly. On Kite chain."

### Shot 4 — Open Leaderboard (1:00 → 1:20)
**Visual:** /leaderboard page — showing top earning authors publicly.
Open Dr. Chen's address in KiteScan. Show real USDC balance.

**Narration:**
> "This is Dr. Chen. I don't know her. I've never met her.
> But her paper was cited 47 times this week. She earned 38 USDC.
> Zero human intervention. Zero permission needed."

### Shot 5 — Call to Action (1:20 → 1:30)
**Visual:** Kutip logo + tagline + Kite branding.
**Narration:**
> "Kutip — built on Kite, the first AI payment blockchain.
> This is what the agentic economy is supposed to look like."

## Captions

Always include captions (Descript auto-generates). 95% of social viewers watch muted.

## Thumbnail

Big text: "AI AGENTS THAT PAY BACK"
Subtle: Kite logo bottom right.
Face or product screenshot left half.

## Distribution

Hackathon submission: required.
Post to X: tag @GoKiteAI @encodeclub.
Post to LinkedIn: longer caption with story.
Discord Kite #general: pinned comment.
