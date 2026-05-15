# Security model

Three audit rounds shaped the current state. This chapter documents
both the threat model and the specific mitigations that landed.

> If you're a judge: jump to **[What we fixed](#what-we-fixed)** for the
> short list. The [audit lineage](#audit-lineage) below is the proof
> work — every finding has its commit + lock-in test.

---

## Threat model

Three classes of attacker:

1. **Anonymous web attacker** — anyone hitting `kutip-zeta.vercel.app`
   without a wallet. Can call public API routes, observe responses,
   replay payloads. Cannot sign as a real user.
2. **Wallet-holding attacker** — has their own EOA + funds. Can sign,
   pay x402, hold sessions. The most realistic adversary.
3. **Operator key compromise** — somebody steals the operator EOA's
   private key. Documented as an explicit failure mode; mitigations
   reduce blast radius even in this case.

We explicitly *don't* defend against:
- A malicious Vercel runtime stealing client cookies (deployment trust).
- A malicious browser extension intercepting wallet RPC.
- Quantum-broken ECDSA in 2040.

---

## Defence in depth

| Surface | Layer 1 | Layer 2 | Layer 3 |
|---|---|---|---|
| `/api/auth/orcid/demo-verify` | `KUTIP_ALLOW_DEMO_VERIFY` env flag | hardcoded allowlist (Josiah + synthetic `0000-0001-XXXX`) | `lookupOrcid` rejects real orcid.org records |
| `/api/claim` | OAuth-cookie ORCID match | EIP-191 sig recovers to wallet | On-chain `NameRegistry` already-bound conflict check (409) |
| `/api/session` (DELETE) | Caller address parsed | Signature recovers to caller | `validUntil` window (10 min) prevents replay |
| `/api/query` | Origin allowlist | `KUTIP_API_KEY` for non-browser callers | Anonymous budget cap (0.5 USDC) |
| `AttributionLedger.attestAndSplit` | `onlyOperator` modifier | CEI ordering in citation loop | Dust forwarding to ecosystem (conservation invariant) |
| `UnclaimedYieldEscrow.claim` | `onlyOperator` modifier | `NameRegistry.walletOf == claimer` gate | First-write-wins on `Deposit.claimer` |
| LLM citation weights | XML tag extraction | Schema validation | `Number.isFinite` + range + paper-id whitelist |

Each layer is independent — a single compromised layer doesn't open
the door. This is the explicit design philosophy: never trust a single
check.

---

## Claim message format (v1)

Every author who claims their ORCID signs this exact message via EIP-191
(`personal_sign`):

```
Kutip claim
v1

I verify that I, ORCID 0000-0002-1825-0097, own wallet 0x...

chainId: 2368
validUntil: 1734567890

This binding controls future USDC payouts from the Kutip attribution ledger.
```

Why each line matters:

- `chainId: 2368` — pins the signature to Kite testnet. Reuse on a
  clone deployment of Kutip (different chainId) is invalid.
- `validUntil: <unix>` — 10-minute window from signing. Leaked old
  signature can't be replayed forever.
- ORCID + wallet — the actual binding.

Server reconstructs this string from the submitted `validUntil` and
checks: signature recovers to wallet, validUntil is within 15s past
to 1h future, and ORCID matches the OAuth cookie.

---

## What we fixed

Three rounds. Each round is a single commit batch + a regression test.

### Round 1 (commit `34e851e`)

| # | Severity | Fix |
|---|---|---|
| C1 | Critical | demo-verify allowlist (Josiah + synthetic 0000-0001) |
| C2 | Critical | Server-side spend tracking — client `spentToday` is floor-only hint |
| C3 | Critical | Origin allowlist + anonymous 0.5 USDC cap on `/api/query` |
| H2 | High | OAuth callback compares `token.orcid` against `expectedOrcid` |
| H4 | High | LLM weight bounds check (`Number.isFinite`, range, paper-id whitelist) |
| M5 | Medium | Strip signature bytes from public `/api/claim` GET |
| M8 | Medium | Read on-chain before `recordClaim`; 409 on conflict |
| M4 | Medium | `queryId` regex (`/^0x[0-9a-f]{64}$/`) on `/api/summaries/[queryId]` |
| L1 | Low | `decodePaymentHeader` 4096-byte cap |

### Round 2 (commit `4d9c0f8`)

| # | Severity | Fix |
|---|---|---|
| H1 | High | Claim message v1 — `chainId` + `validUntil` required |
| H5 | High | Sign-to-revoke `/api/session` DELETE (recovers signature to caller) |
| H6 | High | `UnclaimedYieldEscrow.claim` gated by `NameRegistry.walletOf` |
| M1 | Medium | `/api/papers/[id]` verifies decoded amount ≥ price + payTo === merchant |
| M3 | Medium | Optional `X-Kutip-API-Key` for non-browser callers on `/api/query` |

### Round 3 (commit `fc78de2`)

The agent that re-audited the contracts caught a **critical** one
the first round missed:

| # | Severity | Fix |
|---|---|---|
| C1 | Critical | **`AttributionLedger.attestAndSplit` is now `onlyOperator`.** Was unauthenticated — any attacker could call with attacker-controlled citations and drain the full authors share of any pre-funded balance. The fix is one modifier; the regression is locked in by `test_RevertOnNonOperator`. |
| H1 | High | CEI ordering in citation loop — bookkeeping before transfer |
| H2 | High | Author-side dust forwarded to ecosystem (conservation invariant tightens) |
| H3 | High | Bounty-side dust forwarded to first author |
| H4 | High | `AgentRegistry8004.register` requires `msg.sender == agent` |
| L1 | Low | Zero-address checks in `AttributionLedger` ctor |

---

## Audit lineage

```
                                      ┌── Round 3 ──┐
                                      │   contracts  │
                                      │  + 5 fixes   │
                              ┌── Round 2 ──┐       │
                              │   API + tx   │      │
                              │  + 5 fixes   │      │
                      ┌── Round 1 ──┐       │       │
                      │   API+UX     │      │       │
                      │  + 9 fixes   │      │       │
                      │              │      │       │
   pre-audit          │ commit       │      │       │
   state ────────────▶│ 34e851e ────▶│ 4d9c…│ ────▶ │ fc78… ──▶ now
                                            │              ▲
                                            │              │
                                            └── + 3 a11y    │
                                                fixes  ─────┘
                                                (05960e1)
```

Each round's commit is reviewable on its own. Together they close
14 findings ranked Critical / High / Medium and a handful of Low.

---

## Things NOT fixed (intentionally)

| Finding | Reason |
|---|---|
| Operator key compromise (cross-cutting) | Documented in NatSpec. Mitigated for escrow (H6) but cannot fully prevent. Production deployment would use a 2-of-3 multisig as operator. |
| MCP server has no rate limit | Optional `KUTIP_API_KEY` provides a soft gate. Real rate limiting requires KV/Redis, out of hackathon scope. |
| In-memory caches reset on serverless cold starts | Accepted. Authoritative state is on-chain (`NameRegistry`, `AttributionLedger`). Cache is hot-path only. |
| `pino-pretty` build warning | Peer dep of WalletConnect logger. Cosmetic. |

---

## How to verify

Every fix has a corresponding test:

```bash
# Contract gates
cd contracts && forge test --match-test "test_RevertOnNonOperator|test_RevertOnNonAgent|test_RevertWhenClaimerNotBound|test_RevertWhenClaimerDoesntMatchBinding"

# Cookie + claim format
cd web && pnpm test --testNamePattern "verifyCookie|buildClaimMessage|isDemoVerifyAllowed"

# Full suite — every guard rail
cd contracts && forge test       # 55 tests, 4 fuzz suites × 256 runs
cd ../web && pnpm test           # 138 unit + 6 integration
```

If any of those fail on `main`, a security guarantee broke.

---

## Reporting issues

If you find a real exploit before the deadline: open an issue at
<https://github.com/PugarHuda/kutip/issues> with a `security:` prefix.
After the deadline: same path.

We commit to a same-week patch for real exploits, hackathon-prize
relevant or not.
