# Kutip — UI/UX Design Prompt (for Claude / v0 / Lovable / any generative design tool)

> Paste this whole document into Claude, v0.dev, Lovable, or any AI-assisted
> design tool. It is self-contained: product context, brand language, page
> architecture, components, motion, edge states, voice, and anti-patterns.
> If the tool asks follow-ups, answer from this file first.

---

## 0. One-sentence identity

**Kutip is the first autonomous AI research agent that pays the humans it learns from — cryptographically, on-chain, in real time.**

Every design decision should reinforce one of three emotions, in order of priority:

1. **Trust** — the money flow is real, auditable, irreversible.
2. **Fairness** — authors win, agents win, users win, at the same moment.
3. **Quiet magic** — the "payout" step should feel like watching dominoes fall, not like watching a loading bar.

---

## 1. Product context (read this before designing anything)

- Track: Kite AI Global Hackathon 2026, **Novel** category. Judges optimize for agent autonomy, real-world applicability, novelty.
- Tech: Next.js 14 App Router, Tailwind, wagmi + viem. On-chain settlement on Kite testnet (Chain ID 2368, block time 1s, gas ≈ free).
- Primary user flow:
  1. Land on `/`
  2. Go to `/research` → type a question → set a USDC budget → click pay
  3. Watch the agent progress live (5 steps)
  4. Read the summary + see the on-chain attribution receipt
  5. Click a citation → land on the author's wallet on KiteScan
  6. Separately: `/leaderboard` ranks authors by USDC earned
  7. Public `/verify/[queryId]` shows cryptographic proof of any past query

- The demo video is 90 seconds. The UI must hit a visual climax at 0:40 when the "revenue split" panel reveals. Design for that frame.

---

## 2. Design direction — pick the right shelf, don't mix shelves

Kutip sits in the **"trust-gradient workstation"** archetype:
precise, tabular, monospaced-where-it-counts, warm-where-it-matters. Think:

- **Stripe** (trust + numbers look precious)
- **Vercel** (density + breathing room + focus)
- **Linear** (command-palette feel, no decorative clutter)
- **Dune Analytics** (data can be poetry when laid out right)
- **Arc Search / Perplexity** (question → live agent work → cited answer)

**Avoid:**
- Generic shadcn demo landing page (gradient hero + three feature cards + testimonial grid)
- "Web3 aesthetic" (chrome gradients, neon underglow, glitchy mono grids, rainbow ring highlights)
- Glassmorphism blur everywhere
- AI-generated stock illustrations with floating shapes
- Emojis as decorative elements (one emoji allowed: only if it's a diagram symbol, never as bullet)
- "Sparkle ✨" icons anywhere near the LLM output
- Centered single-column everything — we have density to show

---

## 3. Color system

### Brand anchor: Kite violet-blue (already locked)

| Token | Hex | Use |
|---|---|---|
| `kite-50` | `#f5f7ff` | App bg, surface bg |
| `kite-100` | `#eceffe` | Raised surface, hover |
| `kite-200` | `#dadffe` | Divider, subtle chip bg |
| `kite-500` | `#5566ff` | Primary action, links, focus ring |
| `kite-700` | `#3a44cc` | Pressed/hover on primary |
| `kite-900` | `#1a1f5e` | Body text, high-contrast |

### Accent — the "money moved" moment (NEW, introduce deliberately)

| Token | Hex | Use |
|---|---|---|
| `emerald-400` | `#34d399` | Successful attestation tx, author payout chip, +USDC delta |
| `emerald-50` | `#ecfdf5` | Payout row bg on hover |

> Emerald never appears on CTAs or navigation. It appears **only** in
> contexts where real money flowed. That reserves its emotional weight.

### Neutrals (warm, not cold — we are academic, not corporate SaaS)

| Token | Hex | Use |
|---|---|---|
| `stone-50` | `#fafaf9` | Alternate section bg (papers list) |
| `stone-200` | `#e7e5e4` | Low-contrast divider on stone bg |
| `stone-600` | `#57534e` | Journal / affiliation metadata |

### Semantic

| Token | Hex | Use |
|---|---|---|
| `amber-500` | `#f59e0b` | "Pending on-chain", "demo mode", budget warning |
| `rose-500` | `#f43f5e` | Attestation failed, insufficient balance |

### Dark mode (not hackathon priority — spec it for coverage but don't spend time)

Invert: bg `#0d1033` (deep navy, not pure black), surface `#171b4a`, text `#e6e8ff`,
accent emerald `#6ee7b7`, keep `kite-500` unchanged (POP on dark).

---

## 4. Typography

Three typefaces, no more:

| Role | Font | Why |
|---|---|---|
| UI + prose | **Inter** (`-tight` variant for display) | Neutral, screen-legible |
| Paper titles + pull quotes | **Newsreader** (serif) | Borrows authority from academic journals |
| Addresses, hashes, amounts, timestamps | **JetBrains Mono** with `tabular-nums` | Digits must align vertically |

### Scale (Tailwind-friendly)

| Name | Size / leading | Use |
|---|---|---|
| `display-2xl` | 72/80 tight | Hero only |
| `display-xl` | 56/64 tight | Page title on /research, /leaderboard |
| `h1` | 40/48 tight | Section open |
| `h2` | 28/36 | Panel header |
| `h3` | 20/28 | Card title |
| `body` | 16/26 | Prose default |
| `small` | 14/22 | Metadata |
| `caption` | 12/18 uppercase 0.08em | Labels, chips |
| `mono-sm` | 13/20 | Addresses, tx hashes |

### Typographic rules

- Paper titles render in Newsreader 18/26 italic — one rule, consistent across /research result view + /leaderboard + /verify.
- USDC amounts are **always** in JetBrains Mono with `tabular-nums`. Ever.
- Wallet addresses render as `0x5c91…bf40c` (first 6, ellipsis `…` not `...`, last 5). Full address on hover via tooltip with a copy icon inside.
- Never justify paragraphs. Ragged right only.

---

## 5. Page-by-page spec

Each page gets: **archetype · grid · key moment · must-have · don't**.

### 5.1 Landing — `/`

- **Archetype:** Editorial hero + a single visual diagram — no 3-up feature grid.
- **Grid:** max-w-6xl, 12-col. Hero left (7 cols), live "agent in action" diagram right (5 cols).
- **Key moment:** The diagram animates once, slowly, on first scroll into view — showing USDC flowing from the user's wallet into papers, through the agent, out to authors. It loops every 12s with a subtle idle state between loops.
- **Must-have:**
  - Hero headline: **"The research agent that pays its sources."**
  - Subhead: one sentence, no marketing hype. `"Every citation triggers a payment to the author, attested on Kite chain."`
  - Primary CTA: `Start a research query →` (kite-500)
  - Secondary CTA: `See author earnings` (ghost, border-kite-200)
  - Trust row below CTAs: three tiny metrics *read from the ledger* — `authors tracked · total paid out · queries attested`. Use current live numbers. On zero-state, show "— / just deployed".
  - Footer: single line, left-aligned, neutral. `Built on Kite testnet · hackathon 2026`
- **Don't:** feature grid, testimonial slider, FAQ accordion, roadmap, waitlist email field.

### 5.2 Research — `/research`

This is the hero page. Design for 1280px desktop first, reflow at 768 / 480.

- **Archetype:** Workstation. Input stays fixed on left; agent log + result stream right.
- **Grid:** two-column, left 420px fixed, right fluid. On mobile, collapse to one column with input as a sticky top strip.
- **Phase 1 — idle (form):**
  - Textarea, 3 lines, placeholder: "e.g., What are the top carbon capture methods in 2024?"
  - 3 suggestion chips below, mono-small, horizontally scrollable on mobile.
  - Budget: **not a slider**. Use a stepper with preset pills: `1 · 2 · 5 · 10 USDC` and a "custom" option. Show cost-per-paper estimate inline: `~5 papers × 0.40 USDC avg`.
  - Primary button: `Pay 2 USDC & research`. On hover, subtle translate-y -1px, no glow, no shadow change.
- **Phase 2 — running (agent progress):**
  - Right panel turns into a vertical log with 5 steps. Each step is a row: icon · label · timing · detail.
  - The currently-running step has a subtle 1px kite-500 left border and a breathing opacity animation (0.6 → 1.0 over 1.6s, ease-in-out).
  - Done steps fade their icon to kite-900/50 and lock in the duration (e.g., `0.8s`).
  - Error steps get rose-500 icon + inline retry button.
- **Phase 3 — result:**
  - Three vertically stacked panels, each on their own card, with 24px gap.
    1. **Summary panel** — Newsreader italic heading (the original question), then body in Inter 16/26. Paper citations render as inline `[1]` pills with a hover popover showing title + author + weight.
    2. **Attribution receipt panel** — THIS IS THE MAGIC MOMENT. A table-ish list of cited authors with their cut. Use emerald-400 sparingly for the "amount paid" column. Top-right of the panel: a pill showing `Tx · 0x4f2a… ↗` linking to KiteScan. When the page first reveals this panel post-stream, animate each row in with a 40ms stagger and a 100ms fade-up of 8px.
    3. **Full bibliography panel** — collapsed by default, click-to-expand, shows every paper with its DOI + price paid + per-author split.
- **Must-have on result:**
  - Copy-to-clipboard icon on every tx hash + wallet address (toast on copy).
  - "Download receipt (JSON)" + "Download summary (Markdown)" secondary buttons bottom-right of result block.
  - Permalink: `/verify/[queryId]` button. On click, copies link to clipboard AND opens in new tab.
- **Don't:** confetti, balloons, dialog modals, toast the result, hide the progress log after completion (leave it scrolled above — it's evidence).

### 5.3 Leaderboard — `/leaderboard`

- **Archetype:** Data-dense table, Dune Analytics-like.
- **Grid:** max-w-6xl. Three top-of-page stat tiles (authors tracked / total citations / total paid), then the table.
- **Table columns:** `#` rank · Author · Affiliation · Citations · USDC earned · Wallet · Trend (tiny 7-day sparkline, stone-600).
- **Top earner row:** subtle emerald-50 bg, left border emerald-400 1px. No crown icons, no medals.
- **Sort affordance:** sortable columns have a small `↕` that becomes `↑` or `↓` when active. Default sort: USDC earned DESC.
- **Must-have:**
  - Row hover: kite-50 bg, cursor default (not pointer — row itself doesn't click, only explicit links do).
  - Wallet column is a button: click to copy, hover shows explorer icon.
  - Footer line: `Stats read live from [AttributionLedger contract on Kite testnet]` — the bracketed part is an anchor to KiteScan.
- **Don't:** avatar circles (we don't have photos), generic "trend up" green arrows without actual data, pagination for <100 rows (just render).

### 5.4 Verify — `/verify/[queryId]`

- **Archetype:** Certificate. Like a Stripe receipt, not like a blockchain explorer.
- **Grid:** max-w-3xl, single column, generous padding.
- **Hero block:** kite-900 on kite-50. A small stamp-like chip at top-right says `✓ Attested on Kite · {age}` (e.g., "3m ago"). The queryId renders in JetBrains Mono, fully visible, with an inline copy icon. Below: the original question in Newsreader 22/30 italic, as if it were a quote.
- **Facts grid:** 2-col dl, label kite-900/60 small-caps caption, value mono. Payer · Total paid · Authors share · Citation count · Block time · Contract.
- **Payout list:** below the facts, a vertically stacked list of every author who got paid. Each row:
  - Left: author name + affiliation (Newsreader / small-caps)
  - Right: amount in mono + tx hash button
  - On first render, stagger fade-in 40ms per row.
- **Edge states:**
  - `queryId` not found → show a friendly empty state, not a raw "null" card. "No attestation recorded for this ID. It may be in flight, or the ID is wrong. Here's a related leaderboard link."
  - Ledger not configured (env missing) → show amber warning banner: "Contract not yet deployed — waiting for first attestation."

---

## 6. Component library (build these, reuse everywhere)

### Button
- Primary: `bg-kite-500 text-white px-5 h-11 rounded-lg font-medium hover:bg-kite-700 active:translate-y-[1px] transition`
- Ghost: `border border-kite-200 text-kite-900 hover:bg-kite-100`
- Destructive (rare): `text-rose-500 bg-rose-50 hover:bg-rose-100`
- Sizes: `h-8` (sm), `h-11` (md default), `h-13` (lg for hero)
- No loading spinner inside buttons. Instead, button becomes disabled + label changes to "Paying…" with a 3-dot pulse.

### Card / Panel
- `bg-white border border-kite-200 rounded-xl p-6`
- No drop shadows by default. Elevated (modal, popover) uses one: `shadow-[0_8px_24px_-12px_rgba(26,31,94,0.15)]`.

### Chip / Pill
- Meta: `bg-kite-500/10 text-kite-700 px-2 py-0.5 rounded-full text-caption`
- Success: `bg-emerald-50 text-emerald-700`
- Pending: `bg-amber-50 text-amber-700`

### Code/Address token
- `font-mono text-mono-sm bg-kite-100 px-1.5 py-0.5 rounded border border-kite-200`
- With copy: hover reveals a 12px copy glyph to the right, margin-left: 6px.

### Tx hash link
- Renders as: `0x4f2a…a91c ↗` — kite-500, no underline, underline on hover only.
- Click opens KiteScan in new tab.

### Status icon (for agent progress)
- Pending: empty ring (`text-kite-900/30`)
- Running: filled dot (`text-kite-500`) with `animate-pulse` at a slow 1.6s cadence
- Done: check, `text-emerald-500`
- Error: cross, `text-rose-500`

### Stat tile
- Caption label (uppercase small) · Big number (mono, tabular-nums, kite-700) · Delta or subtext (stone-600)
- Never put the big number in color *and* caption in color — only one gets the ink.

---

## 7. Motion language

**Principle:** motion earns its presence by answering "what happened?" — it never decorates.

- All transitions on interactive elements: `200ms ease-out`. No 300ms+ ever.
- Step progress pulse: 1.6s, ease-in-out, opacity 0.6 → 1.0. Do not change scale.
- Panel reveal on result: 400ms ease-out, translate-y-[8px] → 0, opacity 0 → 1. Stagger children 40ms.
- Hero diagram: one full money-flow cycle every 12s. Idle state has a soft 2px breath on the "user wallet" node.
- **Zero parallax.** Zero scroll-hijacking. Zero "scroll to reveal next section" choreography on landing.

---

## 8. Iconography

Use **Lucide** (`lucide-react` already in deps). No Heroicons, no Tabler, no mixing.

Reserved icons:
- `Search` — search bar
- `ArrowRight` — primary CTAs
- `ExternalLink` (↗) — tx / explorer links (size-3.5 inline)
- `Check`, `X`, `Loader2` — agent status
- `Copy` — clipboard affordance
- `ChevronDown` — expand
- No others without a reason.

---

## 9. Voice & microcopy

- Tone: plainspoken, slightly dry, no hype. **"Fair" over "revolutionary".**
- Active voice always.
- Numbers win over adjectives: say `2.00 USDC` not `two bucks`, say `95% of authors reached` not `nearly every author`.
- Zero words to strip from copy: "seamless", "powerful", "robust", "next-generation", "cutting-edge", "journey", "unleash", "AI-powered" (we know it's AI).
- Error messages: say what happened + what the user can do. `"Your wallet doesn't have enough USDC. Need 2.00, found 0.45. [Get testnet USDC →]"`

### Specific strings

| Context | String |
|---|---|
| Landing hero | `The research agent that pays its sources.` |
| Landing sub | `Every citation triggers a payment to the author, attested on Kite chain.` |
| Research CTA idle | `Pay 2 USDC & research →` |
| Research CTA running | `Paying…` (then per-step label in log panel) |
| Agent step 5 label | `Settling on Kite chain` |
| Receipt panel title | `Attribution receipt` |
| Leaderboard title | `Author earnings` (not "Leaderboard" — warmer) |
| Verify page title | `Attestation proof` |
| Empty leaderboard | `No queries yet. Run one → /research` |
| Demo-mode banner | `Demo mode: contract not deployed. Attestations are simulated.` |

---

## 10. Accessibility (non-negotiable, ship-blocker if failed)

- Contrast: every text combination must hit WCAG AA (4.5:1 for body, 3:1 for large text).
- Focus ring: `ring-2 ring-kite-500 ring-offset-2 ring-offset-kite-50` — always visible on keyboard focus, never suppressed.
- All copy buttons, chips, and sortable column headers must be keyboard-operable (`button`, not `div onclick`).
- Textarea has a visible character counter at 500 chars (warning at 450).
- `prefers-reduced-motion`: disable all pulse/stagger/translate animations. Instant state change.
- Every icon button has `aria-label`. Every amount has an invisible full-word alternative (`aria-label="2.00 USDC"`).
- Color is never the only signal: the "top earner" row also has a subtle left border, not just emerald bg.

---

## 11. Specifically, for the demo video (0:40 climax)

The frame at second 40 — when the revenue split panel renders — has to be the shot we post on Twitter. Design for this frame:

- The researcher's question sits at the top in Newsreader italic, feeling like a quote.
- The summary paragraphs are visible but dimmed.
- The **attribution receipt** panel takes center. Each author line animates in with its emerald amount visible. The top row (highest cut) gets emerald-50 bg.
- At the top right of the receipt panel: the tx hash pill pulses once after attestation lands, then rests.
- Background: the pattern-grid from `globals.css` is visible but at 4% opacity, not 6%, for higher signal-to-decoration ratio.

**Design this frame first. Everything else is in service of it.**

---

## 12. Anti-slop checklist (review before shipping any page)

Run this list before committing a screen:

- [ ] No more than **one** gradient on the screen (and only if justified)
- [ ] No "glass" blurs on cards
- [ ] No stock illustrations, no 3D blobs, no floating coins
- [ ] Every border is either 1px kite-200 or 1px kite-900/10. No 2px. No dashed.
- [ ] Every `text-gray-*` is gone — use kite-900/60 instead for secondary text.
- [ ] Every button has a real hover, active, and focus state — not just default.
- [ ] No `aria-disabled="true"` without visible disabled styling.
- [ ] Addresses and hashes never overflow their container (truncate with ellipsis).
- [ ] Numbers with different decimals still vertically align — verify with `tabular-nums`.
- [ ] Dark mode doesn't break emerald contrast on kite-900 bg (check explicitly).

---

## 13. Deliverables checklist for the designer

If generating this with an AI design tool, request output in this order:

1. Landing hero frame (desktop 1440)
2. Research page — phase 2 (agent running) — desktop 1280
3. Research page — phase 3 (result with receipt panel) — desktop 1280
4. Leaderboard full page — desktop 1280
5. Verify page with populated payouts — desktop 1024
6. Research page mobile 390 — phase 2 and phase 3 stacked
7. Empty states for leaderboard, verify, and research error
8. 90-second demo video shot list referencing exact frames above

For each frame, export:
- Figma / Framer mock at 2x
- React/Tailwind component code matching our existing tokens in `Kutip/web/tailwind.config.ts` and `app/globals.css`
- A 4-word rationale under each frame describing the one thing it is designed to do

---

## 14. What already exists (don't redesign from zero)

- Tailwind config at `web/tailwind.config.ts` — the `kite` color scale is locked.
- `app/globals.css` — has `.pattern-grid` utility.
- Route skeleton: `/`, `/research`, `/leaderboard`, `/verify/[queryId]` are scaffolded.
- Lucide icons + Radix Slot + class-variance-authority are in deps — use them.
- The agent logic streams SSE events of shape `{type:"step"|"result"|"error", ...}` — the UI on /research subscribes to that. Do not change the event schema, only its presentation.

Design the layer on top of this, not under it.

---

*Kutip — "First live implementation of Kite's Proof of AI." — Hackathon 2026.*
