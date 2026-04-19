# Kutip Deployment Log

Tracks on-chain deployments as they happen.

## Kite Testnet

| Component | Address | TX | Block | Date |
|---|---|---|---|---|
| AttributionLedger | [`0x99359DaF4f2504dF3da042cd38B8d01B8589E5Fa`](https://testnet.kitescan.ai/address/0x99359DaF4f2504dF3da042cd38B8d01B8589E5Fa) | [`0x4ab9bcc2…1c4d9a`](https://testnet.kitescan.ai/tx/0x4ab9bcc2c6928a7212d535252c4ff775c7e7a6ec9087b5da46737df2bd1c4d9a) | 20944832 | 2026-04-19 |
| Deployer EOA | [`0x5C91B851…bF40c`](https://testnet.kitescan.ai/address/0x5C91B851D9Aa20172e6067d9236920A6CBabf40c) | — | — | — |
| Agent AA | [`0x4da7f4cF…1776`](https://testnet.kitescan.ai/address/0x4da7f4cFd443084027a39cc0f7c41466d9511776) | pending first UserOp | — | — |

### Gas used (actual)

| Action | Gas | KITE cost @ 0.002 gwei |
|---|---|---|
| Deploy AttributionLedger | 710,763 | ~0.0000014 KITE |

## Deploy Steps

### 1. Fund wallets

1. Create (or reuse) a dev wallet in MetaMask.
2. Add Kite testnet network:
   - RPC: `https://rpc-testnet.gokite.ai/`
   - Chain ID: `2368`
   - Currency: `KITE`
   - Explorer: `https://testnet.kitescan.ai/`
3. Visit `https://faucet.gokite.ai` → claim KITE (gas).
4. Acquire mock USDC (address `0x0fF5393387ad2f9f691FD6Fd28e07E3969e27e63`). Options:
   - Mint via the contract's public mint on KiteScan (if exposed).
   - Ask in Kite Discord `#testnet-support` for a drip.
   You need roughly `DEFAULT_QUERY_PRICE × demo queries ≈ 10 USDC` for the service wallet.

### 2. Fill `Kutip/.env`

From `Kutip/` root:

```bash
# Already gitignored — just edit in place
notepad .env        # Windows
# or: nano .env
```

Required keys:

| Key | Value |
|---|---|
| `PRIVATE_KEY` | Deployer EOA, `0x` + 64 hex chars |
| `NEXT_PUBLIC_AGENT_OPERATOR_ADDRESS` | Wallet that receives 50% of each query |
| `NEXT_PUBLIC_ECOSYSTEM_FUND_ADDRESS` | Wallet that receives 10% of each query |
| `OPENROUTER_API_KEY` | LLM access (free tier OK for hackathon) |
| `OPENROUTER_MODEL` | e.g. `z-ai/glm-4.5-air:free` (primary) |
| `OPENROUTER_FALLBACK_MODEL` | e.g. `openai/gpt-oss-120b:free` (retry) |

For a solo hackathon demo it's fine to use the same address for deployer + operator + ecosystem fund.

### 3. Deploy contract

```bash
# From Kutip/contracts
forge script script/Deploy.s.sol:Deploy \
  --rpc-url $KITE_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast -vvv
```

On Windows PowerShell, `$KITE_RPC_URL` expands only if you source `.env` first. Easiest:

```powershell
Get-Content ..\.env | ForEach-Object {
  if ($_ -match '^([A-Z_]+)=(.*)$') { Set-Item -Path "env:$($Matches[1])" -Value $Matches[2] }
}
forge script script/Deploy.s.sol:Deploy --rpc-url $env:KITE_RPC_URL --private-key $env:PRIVATE_KEY --broadcast -vvv
```

The script logs `AttributionLedger deployed at: 0x...`. Copy that address.

### 4. Wire address back into env

In `Kutip/.env`:

```
NEXT_PUBLIC_ATTRIBUTION_LEDGER=0x<address from step 3>
ATTRIBUTION_LEDGER_ADDRESS=0x<address from step 3>
```

Sync into the web app:

```bash
# From Kutip/
pnpm run env:sync
```

### 5. Fund the ledger's operator with USDC

The service wallet (= `PRIVATE_KEY`) must hold enough mock USDC to cover each query's
`totalPaid`. Every `attestAndSplit` call:

1. `transfer` the full query fee to the ledger.
2. Ledger fans out 50 / 40 / 10 to operator / authors / ecosystem.

For a 2-USDC query the service wallet spends 2 USDC and receives 1 USDC back (operator share),
so budget at least `~5 × queries × 2 USDC` to run a smooth demo.

### 6. Verify on KiteScan

Visit `https://testnet.kitescan.ai/address/<ledger>` — you should see the constructor
values (`paymentToken = KITE_TESTNET_USDC`, `operator = ...`, etc.).

### 7. Run the web app

```bash
cd web
pnpm dev
```

Visit `http://localhost:3000/research` → run a sample query → watch the 5-step agent
progress → confirm step 5 lands a real tx on KiteScan.

## Wallets

| Role | Address | Purpose |
|---|---|---|
| Deployer | — | Deploys contracts, holds initial KITE |
| Operator | — | Receives 50% of each query revenue |
| Ecosystem Fund | — | Receives 10% of each query revenue |

Fill these in after step 2.

## Gas Estimates

| Action | Estimated gas | KITE cost |
|---|---|---|
| Deploy AttributionLedger | ~1.2M | ~0.002 |
| attestAndSplit (5 citations) | ~180K | ~0.0004 |
| attestAndSplit (1 citation) | ~80K | ~0.0002 |

## Troubleshooting

- **`InvalidSplit` revert at deploy** — `OPERATOR_BPS + AUTHORS_BPS + ECOSYSTEM_BPS` must equal `10000`.
- **`WeightMismatch` revert at attestAndSplit** — agent sends malformed citation weights. Check `flattenCitationsForContract` output sums to `10000`.
- **`ERC20: insufficient balance`** — service wallet hasn't been pre-funded with mock USDC (step 5).
- **Frontend says "not deployed"** — `NEXT_PUBLIC_ATTRIBUTION_LEDGER` empty in `web/.env.local`. Run `pnpm run env:sync` after editing root `.env`.
