# Gasless implementation vs Kite's official patterns

## What Kutip uses

The Researcher AA batches every attestation as a single UserOperation:

1. `USDC.approve(paymaster, MAX_UINT)` — idempotent, one-time in practice
2. `USDC.transfer(summarizerAA, subFee)` — 5% sub-agent cut
3. `USDC.transfer(ledger, totalPaid)` — authors + ecosystem share
4. `AttributionLedger.attestAndSplit(queryId, totalPaid, citations)` — distributes

The Kite paymaster pre-approves in `validatePaymasterUserOp`, then in
`postOp` pulls USDC from the AA via `transferFrom` to reimburse itself
for the KITE it spent on gas. The approval in step (1) is what lets
step `postOp` not revert with `ERC20InsufficientAllowance`.

## Kite's two published gasless patterns

### 1. Stablecoin Gasless Transfer (EIP-3009)
Source: https://docs.gokite.ai/kite-chain/stablecoin-gasless-transfer

User signs an EIP-3009 `TransferWithAuthorization` off-chain. A backend
relayer submits the authorization on-chain, paying KITE gas on the
user's behalf. The signature is single-use (nonce-bound).

**Use case:** A user who holds USDC but no KITE wants to send USDC to
another wallet. They sign, the relayer submits.

### 2. Account Abstraction SDK (EIP-4337)
Source: https://docs.gokite.ai/kite-chain/account-abstraction-sdk

Higher-level primitive. The AA wallet itself is the msg.sender of
transactions, and a paymaster covers gas. Kutip uses this pattern —
the `gokite-aa-sdk` wraps `sendUserOperationAndWait` with paymaster
sponsorship.

## Why Kutip uses AA, not EIP-3009

| Scenario | EIP-3009 | AA + Paymaster (us) |
|---|---|---|
| One-shot user transfer | ✅ simpler | ❌ overkill |
| Agent submits many tx per session | ❌ re-sign each | ✅ one sign, many ops |
| Sub-agent fees bundled atomic | ❌ separate tx | ✅ one UserOp |
| Session delegation (Passport-style) | ❌ not supported | ✅ native |
| Custom attestation + split logic | ⚠️ external contract | ✅ inline in calldata |

Our agent runs 3+ token ops plus an attestation per query, all of which
must settle atomically. EIP-3009 would force 3-4 separate tx each with
its own signing ceremony. The AA pattern collapses it to one UserOp.

## Compatibility

- Kutip's paymaster (`0x9Adc…e92d`) is Kite's official ERC-4337 paymaster.
- The `approve + transferFrom` round-trip in `postOp` is how
  Biconomy-style token paymasters settle gas across the ecosystem.
- Our pattern works with any Kite-deployed ERC-4337 paymaster.

## Could we add EIP-3009?

Yes, but as a separate feature:
- A "user tops up agent" flow where a user who has USDC but no KITE
  funds the Researcher AA with a single EIP-3009 signature.
- Useful for the first-time user experience (agent gets funded without
  the user needing KITE from a faucet).

Roadmap item. Not blocking.
