# Kutip — Testing Guide

> **Last updated:** 2026-05-04 · 50 Foundry tests passing · 7 Vitest test files written

---

## TL;DR

| Layer | Tests | Coverage |
|---|---|---|
| **Solidity (Foundry)** | **50 passing** (12 unit + 7 fuzz × 256 runs + 9 escrow + 9 escrow-fuzz + 13 others) | Constructor invariants + bps math + dust + conservation |
| **TypeScript (Vitest)** | **7 files** ready (~150 test cases) | 80% lines / 100% branches on financial modules (target) |
| **Integration** | 6 scenarios for `/api/claim` (real handler + nock + ethers) | Full flow happy + 5 negative paths |
| **CI** | GitHub Actions workflow | Both jobs gated on PR |

---

## Convention

```
describe("methodName", () => {
  describe("positive", () => {
    it("does the happy thing", () => { ... });
  });
  describe("negative", () => {
    it("rejects malformed input", () => { ... });
  });
  describe("edge cases", () => {
    it("handles boundary X", () => { ... });
  });
});
```

**Negative tests cover all validation logic.** Financial functions get **property-based tests via `fast-check`** plus hand-crafted boundary cases. Unit tests are **isolated London-school** (mock collaborators with `vi.mock`). Integration tests use real subsystems where cheap (ethers Wallet, in-memory cache) + nock-mocked external HTTP.

---

## Run

### Foundry (works now)

```bash
cd contracts
forge test               # all 50 tests
forge test -vvv          # with traces
forge test --match-test testFuzz_      # only fuzz suites
forge coverage           # coverage report
```

### Vitest (after install)

If you hit pnpm symlink issues on Windows (we did), nuke + reinstall:
```bash
cd web
rm -rf node_modules pnpm-lock.yaml
pnpm install
pnpm test              # both unit + integration
pnpm test:unit         # only fast unit tests
pnpm test:integration  # mid-scope flows (slower)
pnpm test:coverage     # with HTML coverage report
```

Output goes to `web/coverage/index.html`.

---

## Test Files

### Foundry (`contracts/test/`)

| File | Suite | Tests | Highlights |
|---|---|---|---|
| `AttributionLedger.t.sol` | `AttributionLedgerTest` | 5 | Split correctness, dup query revert, weight mismatch, empty cites, stats |
| `AttributionLedger.fuzz.t.sol` | `AttributionLedgerFuzzTest` | 7 + 2×256 fuzz | **Conservation property** · two-author split fuzz · dust payment · weight boundary 9999/10001 · constructor InvalidSplit · zero-weight allowed |
| `UnclaimedYieldEscrow.t.sol` | `UnclaimedYieldEscrowTest` | 8 | Existing |
| `UnclaimedYieldEscrow.fuzz.t.sol` | `UnclaimedYieldEscrowFuzzTest` | 7 + 2×256 fuzz | **Yield linearity** fuzz · dust principal yield=0 · 1 USDC × 5% yields exactly 5e16 wei · post-claim freeze · double-claim revert · operator gating |
| `BountyMarket.t.sol` | `BountyMarketTest` | 7 | Existing |
| `AgentReputation.t.sol` | `AgentReputationTest` | 7 | Existing |
| `AgentRegistry8004.t.sol` | `AgentRegistry8004Test` | 6 | Existing |

### Vitest (`web/test/unit/` + `web/test/integration/`)

| File | Subject | Test count |
|---|---|---|
| `unit/orcid-oauth.test.ts` | HMAC cookie sign/verify, OAuth URL builder, `isOrcidOauthEnabled`, `redirectUrl` | 30+ |
| `unit/x402.test.ts` | Payment header decode (5 negative cases), `buildPaymentRequired`, nock-mocked `settleWithFacilitator`, `isDemoMode` | 20+ |
| `unit/session.test.ts` | Real ethers Wallet + `verifyIntent` + `checkSpendStateless` cap enforcement | 15+ |
| `unit/kitepass.test.ts` | `buildKutipRules` shape, `KITEPASS_ADDRESSES`, uint160 boundary | 12+ |
| `unit/agent.financial.test.ts` ★ | `evenWeights`, `normalize`, `flattenCitationsForContract`, `buildCitations` — **fast-check property tests** asserting weight conservation invariant (sum=10000) | 25+ |
| `unit/claim-registry.test.ts` | ORCID normalisation, claim message determinism, `orcidHash` collision-resistance, cache lifecycle | 20+ |
| `integration/api-claim.test.ts` | Full `/api/claim` POST flow with real handler + nock ORCID + ethers signing + signed OAuth cookie | 6 |

---

## Coverage Gates

Defined in `web/vitest.config.ts`:

```ts
coverage: {
  thresholds: {
    lines: 80,
    branches: 80,
    functions: 80,
    statements: 80,
    "lib/agent.ts": { branches: 100 }   // financial precision
  }
}
```

CI fails if coverage drops below these.

---

## Property-Based Testing

Financial code uses `fast-check`:

```ts
fc.assert(
  fc.property(
    fc.array(fc.integer({ min: 1, max: 10_000_000 }), { minLength: 1, maxLength: 10 }),
    (weights) => {
      const out = normalize(input, papers);
      const sum = Array.from(out.values()).reduce((a, b) => a + b, 0);
      return sum === 10000; // INVARIANT
    }
  )
);
```

By default `fast-check` runs 100 random inputs per property. Override with `fc.assert(prop, { numRuns: 1000 })` for high-stakes invariants.

---

## Mocking Strategy

| Collaborator | Strategy | Why |
|---|---|---|
| OpenRouter LLM | `vi.mock` returning canned response | Deterministic tests |
| ORCID API | `nock("https://pub.orcid.org")` | HTTP boundary |
| Pieverse facilitator | `nock("https://facilitator.pieverse.io")` | HTTP boundary |
| Kite RPC | `vi.mock("@/lib/ledger")` getPublicClient | Pure code path testing |
| Bundler | `nock("https://bundler-service.staging.gokite.ai")` | HTTP boundary, no local stub |
| Goldsky subgraph | `nock` GraphQL endpoint | HTTP boundary |
| ethers Wallet | **Real** (deterministic) | Cheap; tests would mock too much auth |
| EIP-712 signing | **Real** | Crypto primitives — mocking invites false-pass |

---

## CI

`.github/workflows/test.yml`:

- **`foundry` job** — installs Foundry stable + OZ + std + runs `forge test -vvv` + `forge coverage`
- **`vitest` job** — pnpm install with frozen lock, typecheck, unit + coverage, integration
- Coverage uploaded as artifact for review

Failure on either job blocks merge to `main` (when branch protection is on).

---

## Adding New Tests

When you add a function to `lib/`:

1. Decide: pure function or has side-effects? Pure → unit. Side-effects on subsystem → integration.
2. Decide: financial (handles money, bps, share splits) → property + boundary. Logic-only → standard pos/neg/edge.
3. Use the convention: `describe(method) → describe(pos|neg|edge) → it`.
4. **Negative tests must cover every validation branch.** Run `pnpm test:coverage` and check the HTML report for missed branches before committing.

---

## Known Gotchas

- **pnpm symlink errors on Windows**: nuke `node_modules/.pnpm/` and `node_modules/`, then `pnpm install`. If still fails, delete `pnpm-lock.yaml` and retry.
- **Vitest globals off by default**: we use explicit imports (`import { describe, it, expect } from "vitest"`) for clarity. Don't enable `globals: true` — defeats purpose of London-school isolation.
- **Test isolation**: each test file runs in its own worker. Module-level state (e.g. `claim-registry`'s `globalThis.__KUTIP_CLAIMS__`) **must** be cleared in `beforeEach` — see `claim-registry.test.ts` for pattern.
- **Foundry fuzz seed**: change runs in `foundry.toml` to reproduce a flake (`fuzz.runs = 1024`). Default 256 catches most bugs in <2s.
