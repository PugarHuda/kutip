# Kutip — Submission Copy

> **Status:** drafts parked here; finals get pasted into Encode Club form + socials.
> **Target deadline:** 2026-04-27 18:59 WIB

---

## Pick one opening (shapes all downstream copy)

### Option A — Technical lead ("what we built")
> Kutip is the first production implementation of Kite's Proof-of-AI. An
> autonomous research agent with its own EIP-4337 smart-account identity
> settles USDC payments to cited authors atomically with the attestation
> tx — agent-to-agent composition included, on Kite testnet, today.

*Feels like:* an infrastructure announcement. Engineers read it, lean in.
Works when the judging weight is on architecture & correctness.

### Option B — Problem lead ("what's broken")
> AI agents scraped your paper and paid you nothing. Kutip fixes the
> citation economy at its root: every time our agent quotes a researcher,
> real USDC moves to their wallet before the user sees the summary. Not
> attribution theater — cryptographic settlement, on Kite chain, in one
> second.

*Feels like:* a manifesto. Non-technical judges get the stakes fast.
Works when you need the "why does this matter" hook up front.

### Option C — Outcome lead ("what the human sees")
> Dr. Chen didn't ask for the 0.40 USDC that just landed in her wallet —
> an AI agent she's never met cited her paper on carbon capture, and
> Kite's attribution ledger paid her a fair share of what the user spent.
> That's the product. No onboarding, no consent forms, no middlemen.

*Feels like:* a human-interest story. Tweet-worthy.
Works when you want judges to remember ONE concrete scene.

---

## 200-word pitch (fill after picking tone)

_TBD — drafts below will expand the chosen opener._

---

## 100-word tech summary (for form "what did you build" field)

Kutip ships the first live agent-to-agent payment chain on Kite testnet.
An EIP-4337 Researcher smart-account runs a research query via
Claude/GLM through OpenRouter, atomically pre-pays a Summarizer
sub-agent 5% (same UserOp), then settles the remaining USDC through an
`AttributionLedger` Foundry contract that splits 50/40/10 to operator,
cited authors, and ecosystem — all in one transaction sponsored by
Kite's paymaster (no native KITE gas needed). Authors bind ORCID →
wallet via a `/claim` page with on-chain signature verification.
Pieverse x402 facilitator is wired for settlement; UI is a hi-fi
Next.js 14 app live on Vercel.

---

## Demo video outline (90 seconds)

> Directly keyed to what's on production at <https://kutip-zeta.vercel.app>.
> **Pre-warm** the site ~30s before recording (warmup cron hits daily
> 0800 UTC only — expect cold-start tax otherwise).

### Shot 1 · 0:00–0:08 — Hook
**Pick based on opener tone:**
- A: Close-up of `/verify` index page scrolling past 3 attestations on KiteScan.
- B: Split screen — news headline "AI companies sued by authors" | our landing.
- C: KiteScan author page showing real USDT balance + "0.40 earned today".

### Shot 2 · 0:08–0:30 — Flow
Landing page hero → click "Start a research query" → type sample
question → budget 1 USDC → click "Pay & research".

Call out on-screen:
- 5 agent steps streaming live
- Step 5 label changes to "Settled via agent smart account (AA)"
- Tx hash pill pulses emerald

### Shot 3 · 0:30–0:50 — The climax frame
Attribution receipt panel reveals. Voice hits "here's where it gets
interesting":
- Top-earner row highlighted emerald
- Each author name in serif italic, amount mono
- Sub-agent fee row → "and the Summarizer sub-agent gets its cut too"
- Tx hash chip → click → KiteScan tab opens

### Shot 4 · 0:50–1:10 — Proof
`/verify/<queryId>` page → 2-col facts grid → "Attested on Kite · Xm ago"
→ scroll to payouts list → each row links to author wallet on KiteScan.

### Shot 5 · 1:10–1:25 — Registry
`/claim` page → enter `0000-0001-1234-0001` → Connect wallet (MetaMask
popup) → personal_sign prompt → "Bound to Dr. Sarah Chen ✓" toast.

### Shot 6 · 1:25–1:30 — CTA
Landing → the 4-identity block (Researcher, Summarizer, Ledger, Pieverse
live) → end card: "kutip-zeta.vercel.app · Kite AI Hackathon 2026 · Novel."

---

## Architecture one-liner (for diagram + deck)

    User  →  Researcher AA  →  [ Summarizer AA, AttributionLedger ]  →  Authors
              (0x4da7)            (0xA6C3 · 5%)  (0x9935 · 50/40/10)   (real wallets when claimed)

**One UserOp, three calls, atomic.** Paymaster sponsors gas in stablecoin.

---

## Launch tweet draft (280 chars)

> i built an ai agent that paid 5 researchers USDC without asking them
> for permission or a signup form — citations become on-chain transfers,
> atomically with a sub-agent fee + attestation split.
>
> live on kite testnet 👇
> https://kutip-zeta.vercel.app
>
> built for @GoKiteAI hackathon · Novel track

---

## LinkedIn post (expanded, 150 words)

**TBD** — adapts tweet + adds one paragraph context about the AI-scraping
problem + one paragraph about Kite's Proof-of-AI thesis.

---

## Submission form field map (Encode Club)

| Field | Source |
|---|---|
| Project name | `Kutip` |
| Tagline | `Citations that pay.` |
| Live URL | `https://kutip-zeta.vercel.app` |
| Repo URL | `https://github.com/PugarHuda/kutip` |
| Video URL | *(upload to YouTube unlisted after record)* |
| Short description | ← 100-word tech summary above |
| Long description | ← 200-word pitch above |
| Track | Novel |
| Built on | Kite AI, OpenRouter, Foundry, Vercel |
| Team | Pugar Huda Mantoro (solo) |
