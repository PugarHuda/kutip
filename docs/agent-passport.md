# Agent Identity — Kite Agent Passport Integration

## Why this matters

Kite's thesis is that AI agents should be **first-class economic actors** with their own on-chain identity, separate from the humans who operate them. The judging rubric weighs "Agent Autonomy" heavily — an agent that pays from its user's EOA is a script; an agent that pays from its **own smart account** is an agent.

## Architecture

```
┌──────────────────────────────┐
│  User (EOA, master identity) │  ← 0x5C91B851…Bf40c
│  - holds KITE for gas        │
│  - approves agent budgets    │
└──────────────┬───────────────┘
               │ signs Standing Intent
               ▼
┌──────────────────────────────┐
│  Agent (AA Smart Account)    │  ← derived via gokite-aa-sdk
│  - holds USDC operating cap. │     EIP-4337 entry point:
│  - executes UserOperations   │     0x4337…Ff108
│  - this is what KiteScan     │
│    shows as "payer"          │
└──────────────┬───────────────┘
               │ signs Delegation Token (each payment)
               ▼
┌──────────────────────────────┐
│  Session (ephemeral, 60s TTL)│  ← once Passport invite lands
│  - single tx signature scope │
│  - budget & merchant-scoped  │
└──────────────────────────────┘
```

## Current implementation status (D2, 2026-04-19)

| Layer | Status | Implementation |
|---|---|---|
| User EOA | ✅ Live | `PRIVATE_KEY` env; funded via Kite faucet |
| Agent AA account | ✅ Live | `gokite-aa-sdk` v1.0.15; derived address via `sdk.getAccountAddress(eoa)` |
| EIP-4337 bundler | ✅ Reachable | `https://bundler-service.staging.gokite.ai/rpc/` (chain 2368, EntryPoint `0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108`) |
| Batched UserOps | ✅ Live | Attestation bundles USDC transfer + `attestAndSplit` in a single UserOperation |
| Kite Passport signup | ⏳ Awaiting invite | Testnet is invitation-only; request submitted to Kite Discord `#testnet-support` |
| Standing Intent → Delegation Token → Session Signature chain | ⏳ Awaiting invite | Adapter stubbed in `lib/agent-passport.ts`, drop-in once signup completes |
| MCP integration | ⏳ Future | Not required for hackathon judging |

## How the integration is structured

### 1. Environment toggle

```bash
# In Kutip/.env
KUTIP_USE_AA=1
```

When `KUTIP_USE_AA=1`:
- Attestation is submitted via the AA account (agent's own identity).
- KiteScan shows the AA address as the payer.
- Gas is paid by the AA account (bundler routes via EntryPoint).

When `KUTIP_USE_AA=0` (or unset):
- Attestation falls back to direct EOA tx.
- Same functional outcome; lower-fidelity identity story.

Both paths produce identical `QueryRecord` on-chain. This lets the dev-mode path stay fast (no bundler round-trip) while production runs the full agent-identity story.

### 2. Code surface

- `web/lib/agent-passport.ts` — thin wrapper around `gokite-aa-sdk`.
  - `getAAAddress()` — returns the agent's smart account address.
  - `sendBatchUserOp(calls)` — submits a batched UserOperation, waits for the underlying tx, returns `{userOpHash, txHash, aaAddress}`.
  - `isAAEnabled()` — cheap boolean gate for call sites.
- `web/lib/ledger.ts::submitAttestation()` — prefers AA path when enabled. On bundler error, surfaces the error to the agent step 5 emit (fail-closed per CLAUDE.md) — does NOT silently fall back mid-flow, because that would hide the AA path failure from the operator.

### 3. Fail modes & operator guidance

| Symptom | Likely cause | Fix |
|---|---|---|
| `AA context unavailable` | `KUTIP_USE_AA=0` or no `PRIVATE_KEY` | Expected in dev; set both to enable |
| `insufficient funds for gas` | AA account has no KITE | Send 0.05 KITE from EOA to AA address |
| `AA2X sender not deployed` | AA account not yet counterfactual-deployed | First UserOp automatically deploys it; subsequent ops cheaper |
| `ERC20: transfer amount exceeds balance` on attest | AA account has no USDC | Send USDC from EOA to AA address (see funding below) |
| Bundler 5xx | Staging bundler transient | Retry once; if persistent, switch `KUTIP_USE_AA=0` and document in submission note |

### 4. Funding the AA account

The AA account is a **separate wallet** from the EOA. It needs:
- **KITE** for gas on each UserOperation (~0.0005 KITE per op)
- **USDC** to cover `totalPaid` on each attestation (split internally)

Funding steps:
1. Run `pnpm dev`, visit `http://localhost:3000` — landing page shows the agent address.
2. From MetaMask (EOA), send ~0.1 KITE and ~10 USDC to the AA address.
3. The next research query from `/research` will execute via AA automatically.

## Requesting the Kite Passport invitation

From Kite docs:

> Kite Agent Passport is currently invitation-only during testnet, and if you don't have an invitation, you may not be able to complete all steps.

Request channel: **Kite Discord → `#testnet-support`** with:
- Wallet address (EOA): `0x5C91B851D9Aa20172e6067d9236920A6CBabf40c`
- Project name: Kutip
- Track: Novel
- Use case: autonomous research agent with cryptographic citation receipts
- Expected volume: ~50 paid queries across demo + stress test

## Upgrade path when invite arrives

Zero code change required in the agent/contract layer. Only additions in `lib/agent-passport.ts`:

```typescript
// Added under a single new function, no existing call-site change
export async function createSpendingSession(opts: {
  taskSummary: string;
  maxAmountPerTx: bigint;
  maxTotalAmount: bigint;
  ttlSeconds: number;
}) {
  // Calls kpass agent:session create equivalent — either via the CLI
  // wrapper or direct REST once published.
  // Returns the session id and signed Standing Intent.
}
```

The `submitAttestation` path picks up the session automatically via a new
`X-Session-Id` header attached to the UserOp metadata.

## References

- Gokite AA SDK: <https://www.npmjs.com/package/gokite-aa-sdk>
- Kite Passport intro: <https://docs.gokite.ai/kite-agent-passport/kite-agent-passport>
- EIP-4337 EntryPoint (Kite testnet): `0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108`
- Staging bundler: `https://bundler-service.staging.gokite.ai/rpc/`
- ERC-8004 context: <https://github.com/sudeepb02/awesome-erc8004>
