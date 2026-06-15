# 📖 NARASI · BACA INI · KUTIP FINALE PITCH

3 menit ketat untuk pitch utama (slide 1–7). Slide 8–19 hanya kalau
juri tanya. Total ~320 kata = ~145 wpm = mendarat **2:30 di latihan**,
**2:45–2:55 di stage** (demam panggung naikkan WPM ~10%).

---

## 🎯 PITCH UTAMA · 3 MENIT (slide 1–7)

### Slide 1 · HOOK · 0:00 – 0:15

> "AI cites human research. The humans? **Get nothing.**
>
> I'm Huda. I built **Kutip** — an AI agent that **pays the humans it
> learns from**.
>
> On-chain. Atomically. The moment it answers."

*[15 dtk · jeda dramatis di "nothing"]*

---

### Slide 2 · FLOW (clip auto-play) · 0:15 – 0:40

> "Ask a research question.
>
> Kutip searches papers. Pays for them via **x402**. Reads with an
> LLM. Weights citations.
>
> Settles USDC to every cited author — **one atomic transaction on
> Kite**."

*[25 dtk · biarkan klip jalan, mata ke kamera]*

---

### Slide 3 · PAYOUT (clip auto-play) · 0:40 – 1:05

> "**Eighty percent** to authors. Fifteen operator. Five ecosystem.
>
> Baked into the contract. Not a promise.
>
> And mirrored to **Avalanche Fuji** within seconds. Cross-chain
> proof."

*[25 dtk]*

---

### Slide 4 · THREE MOATS · 1:05 – 1:50

> "Three things you won't find anywhere else.
>
> **One** — multi-agent EIP-4337. Researcher and Summarizer are
> **separate smart accounts**. The sub-agent earns its own fee,
> atomically.
>
> **Two** — truly gasless. Paymaster fronts gas in USDC. User pays
> **zero gas, any currency**.
>
> **Three** — verifiable, not visible. Every synthesis
> **keccak256-digested**. One endpoint exports the whole proof —
> attestation, payouts, synthesis."

*[45 dtk · stabil, jangan buru-buru — bagian terpadat]*

---

### Slide 5 · VERIFY (clip auto-play) · 1:50 – 2:10

> "Recompute the hash. Catch any tampering.
>
> **Anyone can audit a query.**"

*[20 dtk · beri ruang, biarkan klip mengisi]*

---

### Slide 6 · SCALE · 2:10 – 2:25

> "Live on testnet today.
>
> **Twelve contracts. Two chains. Two hundred tests.** CI green every
> push."

*[15 dtk · ucapkan angka pelan dan tegas]*

---

### Slide 7 · CLOSE · 2:25 – 2:40

> "AI agents will only grow.
>
> The question is whether they **extract** from humans — or **pay**
> them.
>
> Kutip shows the second model is **real, and live today**.
>
> Solo. Seven weeks. On Kite. Thank you."

*[15 dtk · slow down kalimat terakhir, lalu diam 2 dtk]*

---

# 🎙️ Q&A · DEEP DIVES (slide 8–19, hanya kalau ditanya)

Tiap baris ~10–15 detik. Klip auto-play, kamu narasikan di atasnya.

### Slide 8 · Authors 1/3 · ORCID OAuth
> "Real ORCID OAuth — not just typing the number. Sign in at
> orcid.org. Sign an EIP-712 claim that binds **ORCID-to-wallet**
> on-chain. Future citations route automatically."

### Slide 9 · Authors 2/3 · UnclaimedYieldEscrow
> "Citations for authors without a wallet park in an escrow at
> **5% APY**. When they verify their ORCID, principal plus yield
> ship to their wallet. **No use-it-or-lose-it.**"

### Slide 10 · Authors 3/3 · Earnings dashboard
> "**109 author wallets paid** across attested queries. Podium,
> ranked list, sub-cent precision. Numbers from the ledger — not a
> spreadsheet."

### Slide 11 · Agents 1/3 · ERC-8004 + ERC-6551
> "Each agent holds an **ERC-8004 reputation NFT** with a token-bound
> account. Portable identity. Auditable. Ready for DAO governance."

### Slide 12 · Agents 2/3 · Gasless paymaster
> "Paymaster fronts gas in KITE. Pulls cost back in USDC from the
> agent's account inside the same UserOp. **Atomically.** Agent
> never holds KITE."

### Slide 13 · Agents 3/3 · Safe governance
> "Even if one signer's key leaks, funds stay put. Attestations
> flow through the agent — fast path. Config moves need two
> signatures — slow path. Live **Safe v1.4.1** on Kite."

### Slide 14 · Verifiability 1/2 · Activity feed
> "Dashboard reads `QueryAttested` events **directly off the
> AttributionLedger**. Goldsky is optional, never the trust path.
> **The chain is the source of truth.**"

### Slide 15 · Verifiability 2/2 · Research history
> "Every past run persisted to Vercel Blob — query, synthesis,
> **keccak256 digest**, payouts. Survives cold starts. **Trail of
> evidence, not just a UI.**"

### Slide 16 · Ecosystem 1/4 · Reverse x402
> "Other agents pay Kutip via x402 to cite a summary — that flows
> back to the authors. Humans get paid **forever, not just once**.
> Recursive royalties."

### Slide 17 · Ecosystem 2/4 · BountyMarket
> "Anyone funds a topic with USDC. Kutip earns the bounty on a
> matching citation — extra payout on top of the user fee."

### Slide 18 · Ecosystem 3/4 · MCP server
> "Three tools any LLM client calls natively — Claude Desktop,
> Cursor, Cline. Every external call still pays cited authors
> on-chain. **Infrastructure, not just an app.**"

### Slide 19 · Ecosystem 4/4 · Fuji mirror
> "Every Kite attestation replicates to `CitationMirror` on
> **Avalanche Fuji** within seconds. LayerZero-pattern. Cross-chain
> proof today, DVN-attested when Kite exposes its endpoint."

---

# ⏱️ Cheat sheet · waktu per slide

```
0:00 ──┬─ Slide 1  Hook              15s
0:15 ──┼─ Slide 2  Flow + clip       25s
0:40 ──┼─ Slide 3  Payout + clip     25s
1:05 ──┼─ Slide 4  Three moats       45s  ← bagian terpadat
1:50 ──┼─ Slide 5  Verify + clip     20s
2:10 ──┼─ Slide 6  Scale             15s
2:25 ──┴─ Slide 7  Close             15s
2:40    ============ 20s buffer 🎯
3:00    HARD CAP
```

## 🚨 Kalau drift waktu

| Posisi | Action |
|--------|--------|
| Slide 4 di 1:50, kelelahan kata | Drop moat #2 (gasless), langsung ke #3 (digest). −15 dtk. |
| Slide 5 sudah 2:20 | Potong: *"Recompute the hash. Anyone can audit."* |
| Slide 6 sudah 2:40 | Skip: *"Live on testnet. Twelve contracts. Two chains."* |
| Sudah 2:50, slide 7 belum | Langsung close: *"Kite hackathon, Novel track. Thank you."* |

## 🎬 Tips delivery

- **Jeda 1–2 dtk** sebelum kata **bold** — itu yang ditangkap juri
- **Eye contact** ke kamera, BUKAN ke slide — biarkan klip jalan sendiri
- **Suara turun** di akhir kalimat — jangan questioning intonation
- **Nafas dalam** sebelum slide 4 (45 dtk) dan slide 7 (close)
- **Diam 2 dtk** setelah "Thank you" — kasih ruang buat aplaus

## Yang dirangkum dari versi lama

| Slide | Hemat |
|-------|-------|
| 1 | "writes / recommends / summarizes" → "cites" |
| 2 | Buang "by contribution" + "on-chain. atomically. moment it answers" (sudah di slide 1) |
| 3 | Buang "Not a press release" line |
| 4 | Moat #1 buang "Passport delegation within a cryptographic cap" |
| 5 | Buang "Full receipt ships in one click" |
| 6 | "56 Foundry + 149 Vitest" → "Two hundred tests" |
| 7 | "Built this solo, in seven weeks, on Kite" → "Solo. Seven weeks. On Kite." |

**Total dipangkas: ~110 kata. Buffer 20 dtk lebih lega di stage.**
