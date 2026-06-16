# 📖 NARASI · BACA INI · KUTIP FINALE PITCH

3 menit untuk 11 slide. Tidak ada Q&A backup — semua fitur masuk
main pitch (Slide 9 + 10). Total ~430 kata = ~145 wpm = mendarat
**3:00 di latihan**, **3:10 di stage** (over hard cap ~10 dtk — lihat
section drift di bawah).

Ucapkan natural, jeda 1-2 dtk sebelum kata **bold**. Klip auto-play
3× speed → mata juri menangkap visual selagi kamu narasikan.

---

### Slide 1 · HOOK · 0:00 – 0:12

> "AI cites human research. The humans? **Get nothing.**
>
> I'm Huda. I built **Kutip** — an AI agent that **pays the humans it
> learns from**."

*[12 dtk · jeda di "nothing"]*

---

### Slide 2 · PROBLEM · 0:12 – 0:32

> "Common Crawl — the corpus most LLMs train on — paid creators
> **zero**. Scholar indexes 400 million-plus papers.
>
> Citations are everywhere. **Payments — nowhere.**
>
> The people who fund knowledge with their careers earn **zero of
> what AI extracts from it**."

*[20 dtk · pelan, biarkan beratnya tertangkap]*

---

### Slide 3 · SOLUTION · 0:32 – 0:55

> "Kutip flips that.
>
> **Every citation IS a payment.** On-chain. Atomic. The moment it
> lands.
>
> And when another agent cites that summary, **more payment flows
> back to the original authors**. Humans get paid forever — not
> just once."

*[23 dtk · Reverse x402 loop story sebagai closer — naikkan suara di
"forever, not just once"]*

---

### Slide 4 · FLOW (clip auto-play) · 0:50 – 1:12

> "Ask a research question.
>
> The agent searches papers. Pays via **x402**. Reads with an LLM.
> Weights citations.
>
> Settles USDC — **one atomic transaction on Kite**."

*[22 dtk · biarkan klip jalan]*

---

### Slide 5 · PAYOUT (clip auto-play) · 1:12 – 1:32

> "**Eighty percent** to authors. Fifteen operator. Five ecosystem.
>
> Baked into the contract. Not a promise."

*[20 dtk]*

---

### Slide 6 · THREE MOATS · 1:32 – 2:12

> "Three things you won't find anywhere else.
>
> **One** — multi-agent on Kite's AA stack. Researcher and
> Summarizer are separate smart accounts via `gokite-aa-sdk`. One
> **Kite Passport** delegation → full autonomy within a cap.
>
> **Two** — truly gasless. **Kite paymaster** pulls USDC `postOp`.
> User pays **zero gas, any currency**.
>
> **Three** — verifiable, not visible. Real **x402 spec** on Kite.
> Every synthesis **keccak256-digested**. The whole proof exports."

*[40 dtk · stabil, jangan buru-buru — bagian terpadat]*

---

### Slide 7 · VERIFY (clip auto-play) · 2:12 – 2:30

> "Recompute the hash. Catch any tampering.
>
> **Anyone can audit a query.**"

*[18 dtk · beri ruang]*

---

### Slide 8 · SCALE · 2:30 – 2:52

> "Live on testnet today — **already in use**.
>
> **One hundred nine** author wallets paid. **Two hundred
> twenty-six** citations attested.
>
> Twelve contracts. Two chains. Two hundred tests.
>
> **Real money. Real authors. On-chain.**"

*[22 dtk · last line sebagai mic-drop — drop suara di akhir]*

---

### Slide 9 · INFRASTRUCTURE · 2:52 – 3:14

*[Tiga klip mini auto-play — sebut tag, biarkan visual jelaskan]*

> "This isn't a demo — it's **infrastructure**.
>
> Real ORCID OAuth — **not just typing a number**. Authors sign in
> at orcid.org, bind their wallet on-chain.
>
> A **five-percent APY escrow** for un-bound authors.
>
> An **MCP server** — Claude, Cursor, Cline call Kutip natively.
> Every external call still pays the humans."

*[22 dtk · jeda dramatic di "not just typing a number" — itu yang
puncture skeptisisme juri tentang demo authors]*

---

### Slide 10 · ALSO SHIPPING · 3:08 – 3:25

*[Empat klip mini auto-play paralel — sebut nama saja]*

> "Four more things, live on-chain.
>
> **ERC-8004 agent identity**. **Reverse x402** — other agents pay
> Kutip. **BountyMarket** — sponsored research. **Fuji mirror** —
> cross-chain receipt.
>
> All live. All verifiable."

*[17 dtk · drumroll, biarkan klip menjelaskan]*

---

### Slide 11 · THANK YOU · 3:25 – 3:35

> "Solo. Seven weeks. On Kite.
>
> **Scott** — happy to walk you through any contract internals.
> **Stephen** — would love to discuss ORCID-Kite credentialing.
>
> Thank you."

*[10 dtk · slow down, diam 2 dtk]*

---

# ⏱️ Cheat sheet · waktu per slide

```
0:00 ──┬─ 1  Hook                12s
0:12 ──┼─ 2  Problem             20s
0:32 ──┼─ 3  Solution            23s  ← +5: Reverse x402 callback
0:55 ──┼─ 4  Flow + clip         22s
1:17 ──┼─ 5  Payout + clip       20s
1:37 ──┼─ 6  Three moats         40s  ← bagian terpadat
2:17 ──┼─ 7  Verify + clip       18s
2:35 ──┼─ 8  Scale               22s  ← +4: "real money, real authors, on-chain"
2:57 ──┼─ 9  Infrastructure      22s  ← +2: "not just typing a number"
3:19 ──┼─ 10 Also shipping       17s
3:36 ──┴─ 11 Thank you           10s
3:46    ============ over by 46s — MUST drop content to fit

Total tambahan dari 3 boost: +11 dtk. Kalau ingin landing ≤3:00,
ikuti drift section di bawah — drop Slide 6 moat #2 (gasless) →
−12 dtk → balance.
```

## 🚨 Kalau drift waktu

| Posisi | Action |
|--------|--------|
| Slide 2/3 di 0:55 | Compress Problem: *"AI cites human papers. The authors get nothing. We have a problem."* |
| Slide 6 di 2:20 | Drop moat #2 (gasless). −12 dtk. Atau drop moat #1 sub-detail tentang Researcher/Summarizer. |
| Slide 7 di 2:40 | Potong: *"Recompute the hash. Anyone can audit."* |
| Slide 8 di 2:55 | Skip body: *"Live on testnet. 109 authors paid. 226 citations."* |
| Slide 9 di 3:15 | Sebut nama saja: *"ORCID OAuth. Escrow yield. MCP server. Infrastructure."* −10 dtk. |
| Slide 10 di 3:25 | Drop: *"Four more — Reverse x402, Bounties, MCP, Fuji. All on-chain."* |

## 🎬 Tips delivery

- **Jeda 1–2 dtk** sebelum kata **bold** — itu yang ditangkap juri
- **Eye contact** ke kamera, BUKAN ke slide
- **Suara turun** di akhir kalimat — bukan questioning
- **Nafas dalam** sebelum slide 6 (40 dtk, padat) dan slide 11 (close)
- **Diam 2 dtk** setelah "Thank you" — kasih ruang aplaus

---

## 🥊 Pivot lines · pakai kalau pesaing menonjol sebelum kamu

Format positive statement yang implisit counter pesaing — JANGAN pernah
sebut nama mereka. Swap-in natural di slide tertentu.

### 🟦 Anti-NEXUS (kalau pitch "agent economy" / "agents pay each other")

> "This isn't just agent-to-agent payment. **It's agents paying
> humans.** The loop only closes when the people who made the
> knowledge get paid."

**Sisipkan di Slide 3 (Solution)** sebagai kalimat ke-3, atau jadikan
penutup Slide 9 (Infrastructure).

Mengapa: Nexus framing "agents pay each other" = abstract loop.
Kutip framing "agents pay humans" = puncture abstraction. Stephen
(BD) akan ingat karena konstituen manusia konkret.

### 🟦 Anti-QUITTANCE (kalau pitch "x402 proof-of-delivery / escrow")

> "Kutip uses x402 in production today — **226 settled transfers on
> Kite**. Not a layer above x402; the spec running natively,
> on-chain, verifiable right now."

**Sisipkan di Slide 4 (Flow)** saat sebut "pays via x402," atau
Slide 6 (moat #3) sebagai bukti.

Mengapa: Quittance positions sebagai infrastruktur **untuk** x402.
Kutip menunjukkan x402 sudah ship dan **digunakan**. Builders-built
> builders-planned di mata Scott.

### 🟦 Anti-KITE GARDEN (kalau pitch "AI agent security / chaos theory")

> "Kutip is the kind of agent worth securing — an agent that moves
> USDC to real human wallets, with on-chain proof of every transfer."

**Sisipkan di Q&A only**, kalau juri tanya tentang security.

Mengapa: Implicit acknowledgment security matters, sambil framing
Kutip sebagai substrate yang lebih primer.

### Rules of pivot delivery

- **Jangan sebut nama pesaing.** Pernah disebut = pitch terasa
  defensive/cheap shot.
- **Ucapkan natural, tidak agitated.** Pivot line harus seamless di
  alur narasi normal.
- **Maksimal 1 pivot line per pitch.** Pilih yang paling relevan
  berdasarkan urutan pitch. Pakai semua = pitch jadi reactive.
- **Kalau tidak ada pesaing yang menonjol, jangan pakai.** Pivot lines
  hanya ammunition; aman kalau tidak ditembakkan.

---

## 🧑‍⚖️ Juri profile & strategi

**Scott Shi** — Co-Founder + CTO @ Kite AI. Dia *bikin* infrastrukturnya
— paymaster, AA stack, x402 wiring. Slide 6 namai primitives:
`gokite-aa-sdk`, Kite Passport, paymaster `postOp`, x402 spec.

**Stephen Allen** — Strategic Partnerships, Digital Assets & DeFi.
Cari market/ecosystem angle. Slide 11 ada ask spesifik tentang
ORCID-Kite credentialing partnership.

## 🎯 Q&A persiapan — antisipasi Scott (tech)

| Pertanyaan | Jawaban siap |
|------------|--------------|
| "How do you prevent x402 replay?" | "Each payment txHash logged on-chain; route rejects if seen before." |
| "Gas profile per attestation?" | "~180k for 5 citations, ~80k for 1 — paymaster pulls equivalent USDC postOp." |
| "Why ERC-8004 over a simpler reputation system?" | "Portable — the Researcher AA can graduate to a DAO-owned identity later without state migration." |
| "Why Vercel Blob over IPFS for summaries?" | "Same tamper-evidence via keccak256 hash, far faster cold-start. Easy to swap to IPFS later — the hash is the contract." |
| "What breaks at 10× scale?" | "AA nonce serialization — one userOp per signer at a time. Mitigation: round-robin sub-agents or batch attestations." |
| "Why not run the LLM on-chain?" | "Cost. Deterministic synthesis would burn ~$50/query in gas. Off-chain LLM + on-chain attestation = cheap + verifiable." |

## 🤝 Q&A persiapan — antisipasi Stephen (partnerships)

| Pertanyaan | Jawaban siap |
|------------|--------------|
| "Who's your first customer beyond hackathon?" | "Open-access journals — eLife, PLOS — already track citations; we add payment rail." |
| "How does this grow Kite's TVL?" | "Every attestation moves USDC through Kite. Every MCP-integrated agent multiplies that." |
| "ORCID partnership — what would it look like?" | "ORCID issues credentials; Kite verifies + binds on-chain. Authors authenticate once, get paid forever." |
| "Token model?" | "USDC-denominated, no native token. The 80/15/5 split is the model. Kite ecosystem fund earns 5% of every query." |
| "What if AI labs refuse to pay?" | "Reverse-x402 already paywalls summaries. They'll pay because the alternative is missing the latest research their competitors cite." |
