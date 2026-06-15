# Finale pitch — 3 minutes, hard cap

Event: **Kite AI Hackathon · Finale** · 2026-06-16 17:00 BST
Practice: 2026-06-15 14:00 BST (= 20:00 WIB)
Rules: 3 minutes total · no live demo · short embedded video OK · one
presenter.

Deck: live at `/slides` on the deployed app — 7 slides, three of them
carry a pre-recorded clip the presenter narrates over.

---

## Timing — slide by slide

| Slide | Beat | Time | Cumulative |
|------:|------|-----:|-----------:|
| 1 | Hook | 0:15 | 0:15 |
| 2 | Flow (Clip 1) | 0:30 | 0:45 |
| 3 | Payout (Clip 2) | 0:30 | 1:15 |
| 4 | Three moats | 0:45 | 2:00 |
| 5 | Verify (Clip 3) | 0:25 | 2:25 |
| 6 | Scale (numbers) | 0:20 | 2:45 |
| 7 | Close | 0:15 | 3:00 |

Target landing: **2:55** with a 5-second buffer. If you drift, drop one
moat from slide 4 (`02 Gasless` is the safest cut — the digest moat is
the differentiator).

**Slides 8–13 are deep-dive Q&A** — one feature per slide (Fuji mirror,
ERC-8004/6551, Reverse-x402, Escrow yield, BountyMarket, MCP), each
with its own clip. NOT part of the 3-minute pitch. Press `→` past
slide 7 only during Q&A, or `End` to jump straight to the last one.

---

## The script (~430 words · 145 wpm)

### Slide 1 · Hook · 0:00–0:15
> "AI now writes papers, recommends papers, summarizes papers. The
> humans who actually wrote those papers? They get nothing.
> I'm Huda. I built **Kutip** — an AI research agent that pays the
> humans it learns from."

### Slide 2 · Flow + Clip 1 · 0:15–0:45
*[Clip 1 auto-plays — agent flow]*
> "Ask Kutip a research question. The agent searches academic papers,
> pays for them with a real x402 handshake, reads them with an LLM,
> weights each citation, and settles USDC to every cited author —
> on Kite, in **one atomic transaction**."

### Slide 3 · Payout + Clip 2 · 0:45–1:15
*[Clip 2 auto-plays — receipt + KiteScan]*
> "Eighty percent to authors. Fifteen to operator. Five to the Kite
> ecosystem. **The split is baked into the contract.** Every payment is
> a verifiable on-chain transfer — not a press release."

### Slide 4 · Three moats · 1:15–2:00
> "Three things you won't find anywhere else.
> **One — multi-agent on EIP-4337.** Researcher and Summarizer are
> separate smart accounts. The sub-agent earns its own 5% fee
> atomically. The user signs one Passport delegation and the agent
> runs autonomously within a cryptographic cap.
> **Two — truly gasless.** The paymaster fronts gas in USDC. The agent
> never holds KITE. The user pays zero gas, in any currency.
> **Three — verifiable, not just visible.** Every synthesis is
> keccak256-digested. One endpoint exports a portable JSON proof —
> attestation, payouts, and synthesis together."

### Slide 5 · Verify + Clip 3 · 2:00–2:25
*[Clip 3 auto-plays — history + digest + download]*
> "Recompute the hash and you'd catch any tampering. The full receipt
> ships in one click. **Anyone can audit a query.**"

### Slide 6 · Scale · 2:25–2:45
> "Live on testnet right now. Twelve Solidity contracts across two
> chains. Fifty-six Foundry tests including fuzz and invariants. One
> hundred forty-nine Vitest cases. CI green on every push."

### Slide 7 · Close · 2:45–3:00
> "AI agents will only grow. The question is whether they extract from
> humans or pay them. **Kutip shows the second model is real, and live
> today.** I built this solo, in seven weeks, on Kite. Thank you."

---

## Clip recording — three short silent screen-records

Drop the files under `web/public/clips/` with the exact names so the
deck picks them up:

| File | Duration | Shot list |
|------|---------:|-----------|
| `flow.mp4`   | ~15 s | `/research` → type query → click Pay → 5-step progress runs end-to-end → receipt appears. OK to speed-up 2× through the slow middle. |
| `payout.mp4` | ~12 s | Receipt "Authors paid" table visible → hover row → click tx hash → KiteScan with Transfer events. |
| `verify.mp4` | ~12 s | `/dashboard/history` → click any row → `/verify/<queryId>` → scroll to "Summary digest · keccak256" → click "Download JSON receipt". |

**Encoding:** 1080p, H.264 mp4, **silent audio** (your voice is the
narration). Looped by the deck. Each ≤15 s.

**Recording shortcut (Windows):** `Win + G` → record window → save →
rename to the exact filename above → place in `web/public/clips/`.

---

## Practice checklist (today's dry-run · 20:00 WIB)

- [ ] Hard-time yourself — must land ≤ 3:00 (target 2:55). Re-do if you
      blow through.
- [ ] Open `/slides` full-screen ahead of joining — keyboard `→` to
      advance, `←` to go back. **Don't fumble for the URL on stage.**
- [ ] Browser tab focused; mute system notifications.
- [ ] Mic test, lighting test, network test.
- [ ] Chat message ready to send when you join the call:
      `Hey — I'm Huda from Kutip, looking forward to pitching.`

## Failure modes — and the cheap save

| If… | Do this |
|-----|---------|
| A clip doesn't load | Don't pause — the slide still reads, just keep narrating; placeholder shows the shot list for context |
| You're at 2:30 with slide 4 still open | Compress slide 4 to "one — two — three" with one sentence each, skip examples |
| Wi-Fi drops mid-deck | Slides are static — they keep advancing on keyboard; clips will retry on next slide nav |
| Q&A goes deep on architecture | Press `End` to jump to slide 7 → press `Home` to jump back to a moat for the answer |

## What NOT to do

- **No live demo.** Encode rules; also a guaranteed way to die at 2:00 waiting on a cold Lambda.
- **Don't read the slides.** Slides exist to anchor visuals — your face stays on camera.
- **Don't apologize for being solo.** Lead with what you shipped, not what was hard.
- **Don't unmute audio on clips** — your narration is the audio track.
