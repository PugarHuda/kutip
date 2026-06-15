# 📖 NARASI · BACA INI · KUTIP FINALE PITCH

3 menit ketat untuk pitch utama (slide 1–7). Slide 8–19 hanya kalau
juri tanya. Ucapkan natural, pelan di kalimat kunci yang **bold**.
Total ~430 kata = ~145 wpm = mendarat di 2:55.

---

## 🎯 PITCH UTAMA · 3 MENIT (slide 1–7)

### Slide 1 · HOOK · 0:00 – 0:15

> "AI now writes papers / recommends papers / summarizes papers.
>
> The humans who **actually wrote those papers**? They get nothing.
>
> I'm Huda. I built **Kutip** — an AI research agent that **pays the
> humans it learns from**.
>
> On-chain. Atomically. The moment it answers."

*[15 dtk · jeda dramatis sebelum kata "nothing"]*

---

### Slide 2 · FLOW (clip auto-play) · 0:15 – 0:45

> "Ask Kutip a research question.
>
> The agent searches academic papers. Pays for them with a real **x402
> handshake**. Reads them with an LLM. Weights each citation by
> contribution.
>
> Then settles USDC to every cited author — on Kite, in **one atomic
> transaction**."

*[30 dtk · biarkan klip jalan, tunjuk dengan mata]*

---

### Slide 3 · PAYOUT (clip auto-play) · 0:45 – 1:15

> "**Eighty percent** to authors. Fifteen to operator. Five to the
> Kite ecosystem.
>
> The split is **baked into the contract**. Not a promise.
>
> Every payment is a verifiable on-chain transfer. Not a press
> release.
>
> And every receipt **mirrors to Avalanche Fuji** within seconds —
> cross-chain proof, same atomic settle."

*[30 dtk]*

---

### Slide 4 · THREE MOATS · 1:15 – 2:00

> "Three things you won't find anywhere else.
>
> **One** — multi-agent on EIP-4337. Researcher and Summarizer are
> **separate smart accounts**. The sub-agent earns its own
> five-percent fee atomically. The user signs one Passport delegation
> — and the agent runs autonomously within a cryptographic cap.
>
> **Two** — truly gasless. Kite's paymaster fronts gas in USDC. The
> agent never holds KITE. The user pays **zero gas in any currency**.
>
> **Three** — verifiable, not just visible. Every synthesis is
> **keccak256-digested**. One endpoint exports a portable JSON proof
> — attestation, payouts, synthesis. Together."

*[45 dtk · ini bagian terpadat, ucapkan stabil]*

---

### Slide 5 · VERIFY (clip auto-play) · 2:00 – 2:25

> "Recompute the hash and you'd catch any tampering instantly.
>
> The full receipt ships in one click.
>
> **Anyone can audit a query.**"

*[25 dtk · biarkan klip mengisi sisanya, beri ruang]*

---

### Slide 6 · SCALE · 2:25 – 2:45

> "Live on testnet right now.
>
> Twelve Solidity contracts. Two chains. Fifty-six Foundry tests
> including fuzz and invariants. One hundred forty-nine Vitest cases.
> CI green on every push."

*[20 dtk · ucapkan angka pelan dan tegas]*

---

### Slide 7 · CLOSE · 2:45 – 3:00

> "AI agents will only grow.
>
> The question is whether they **extract** from humans — or **pay**
> them.
>
> Kutip shows the second model is real, deployable, **and live
> today**.
>
> I built this solo, in seven weeks, on Kite. Thank you."

*[15 dtk · slow down di kalimat terakhir, lalu diam]*

---

# 🎙️ Q&A · DEEP DIVES (slide 8–19, hanya kalau ditanya)

Tiap baris ~10–15 detik. Klip auto-play, kamu narasikan di atasnya.

### Slide 8 · Authors 1/3 · ORCID OAuth + NameRegistry
> "Real ORCID OAuth — not just typing the number. Sign in at
> orcid.org. Then sign an EIP-712 claim that binds
> **ORCID-to-wallet** in our on-chain NameRegistry. Future citations
> route automatically."

### Slide 9 · Authors 2/3 · UnclaimedYieldEscrow
> "Citations for authors without a bound wallet park in an escrow at
> a **five-percent APY target**. When they verify their ORCID,
> principal plus accrued yield ship to their wallet. **No
> use-it-or-lose-it.**"

### Slide 10 · Authors 3/3 · Earnings dashboard
> "**One hundred nine author wallets paid** across attested queries.
> Podium, ranked list, sub-cent precision. Click any author for their
> on-chain history. Numbers from the ledger — not a spreadsheet."

### Slide 11 · Agents 1/3 · ERC-8004 + ERC-6551
> "Each agent — Researcher and Summarizer — holds an **ERC-8004
> reputation NFT** with a token-bound account. Portable identity.
> Auditable history. Ready for DAO governance."

### Slide 12 · Agents 2/3 · Gasless paymaster
> "Kite's paymaster fronts gas in native KITE. Pulls its cost back in
> USDC from the agent's smart account inside the same UserOp.
> **Atomically.** The user never signs. The agent never holds KITE."

### Slide 13 · Agents 3/3 · 2-of-3 Safe governance
> "Even if one signer's key leaks, funds stay put. Attestations keep
> flowing through the agent — fast path. Config and ecosystem moves
> require two signatures — slow path. Live **Safe v1.4.1** on Kite."

### Slide 14 · Verifiability 1/2 · Activity feed
> "The dashboard reads `QueryAttested` events **directly off the
> AttributionLedger**. Goldsky is an optional fast path, never the
> trust path. **The chain is the source of truth.**"

### Slide 15 · Verifiability 2/2 · Research history
> "Every past run is persisted to Vercel Blob — query, full
> synthesis, **keccak256 digest**, payout count. Survives serverless
> cold starts. **Trail of evidence, not just a UI.**"

### Slide 16 · Ecosystem 1/4 · Reverse x402
> "When another agent cites a Kutip summary, they pay Kutip via x402
> — and that flows back to the original authors. Humans get paid
> **forever, not just once**. Recursive royalties."

### Slide 17 · Ecosystem 2/4 · BountyMarket
> "Anyone funds a topic with USDC. When Kutip cites a matching paper,
> the bounty releases — extra payout on top of the user fee.
> Researchers earn even when the asker doesn't know the paper
> exists."

### Slide 18 · Ecosystem 3/4 · MCP server
> "Kutip ships an MCP server — three tools any LLM client calls
> natively. Claude Desktop. Cursor. Cline. Every external call still
> pays cited authors on-chain. **Infrastructure, not just an app.**"

### Slide 19 · Ecosystem 4/4 · Cross-chain Fuji mirror
> "Every Kite attestation replicates to a `CitationMirror` contract
> on **Avalanche Fuji** within seconds — LayerZero-pattern relay.
> Cross-chain proof today, DVN-attested the moment Kite exposes its
> endpoint."

---

# ⏱️ Cheat sheet · waktu per slide

```
0:00 ──┬─ Slide 1  Hook              15s
0:15 ──┼─ Slide 2  Flow + clip       30s
0:45 ──┼─ Slide 3  Payout + clip     30s
1:15 ──┼─ Slide 4  Three moats       45s  ← bagian terpadat
2:00 ──┼─ Slide 5  Verify + clip     25s
2:25 ──┼─ Slide 6  Scale             20s
2:45 ──┴─ Slide 7  Close             15s
3:00     ====================== HARD CAP
```

## 🚨 Kalau drift waktu

| Posisi | Action |
|--------|--------|
| Slide 4 di 2:00, kelelahan kata | Drop moat #2 (gasless), langsung ke #3 (digest). −15 dtk. |
| Slide 5 sudah 2:30 | Potong: *"Recompute the hash, catch tampering. Anyone can audit."* |
| Slide 6 sudah 2:50 | Skip angka: *"Live on testnet. Twelve contracts. Two chains. Fully tested."* |
| Sudah 2:55, slide 7 belum | Langsung close: *"Kite AI hackathon, Novel track. Thank you."* |

## 🎬 Tips delivery

- **Jeda 1–2 dtk** sebelum kata **bold** — itu yang ditangkap juri
- **Eye contact** ke kamera, BUKAN ke slide — biarkan klip jalan sendiri
- **Suara turun** di akhir kalimat — jangan questioning intonation
- **Nafas dalam** sebelum slide 4 (45 dtk) dan slide 7 (close)
- **Diam 2 dtk** setelah "Thank you" — kasih ruang buat aplaus
