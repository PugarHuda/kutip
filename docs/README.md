# Kutip Documentation

> An autonomous AI research agent that pays cited authors in USDC, attested on Kite chain.

Welcome. These pages cover everything from "click this and run a query" to "audit the on-chain conservation invariants in our fuzz suite."

---

## Pick your entry point

### I want to use Kutip

**[Quickstart →](#quickstart)** · Run the demo flow in under 5 minutes. No setup, no wallet required for the first query.

**[Live deployment](https://kutip-zeta.vercel.app)** · Production on Kite testnet, real attestations, real authors getting paid.

### I want to integrate with Kutip

**[Integration overview](../README.md#integrate-with-kutip)** · Three paths — MCP for LLM agents, HTTP API for backends, on-chain reads for indexers.

**[MCP server](../mcp/README.md)** · Plug Kutip into Claude Desktop / Cursor / Cline as a research tool.

### I want to understand the system

**[Architecture](architecture.md)** · Identities, contracts, money flow, attestation lifecycle.

**[Agent Passport](agent-passport.md)** · How EIP-712 session delegation + Kite Passport vault gate agent spending.

**[Gasless flow](gasless-alignment.md)** · Why end users sign once and never pay gas after.

### I want to verify Kutip is safe

**[Security model](security.md)** · Threat model, mitigations, four rounds of audit findings + fixes.

**[Testing guide](testing.md)** · 56 Foundry tests (4 fuzz suites at 256 runs each) + 143 Vitest unit + 6 integration. Conventions for adding new tests.

### I'm shipping a fork or my own deployment

**[Deployment](deployment.md)** · Contract deploy order, env vars, Vercel setup, the "what each address controls" map.

**[QA checklist](qa-checklist.md)** · Pre-submission verification matrix — every demo path, every chain, every failure mode.

---

## Quickstart

```bash
# Prereqs: Node 20+, pnpm, Foundry, a wallet (MetaMask recommended)

# 1. Clone + install
git clone https://github.com/PugarHuda/kutip.git
cd kutip/web && pnpm install

# 2. Copy env template + fill in essentials
cp ../.env.example ../.env
# Minimum required:
#   PRIVATE_KEY=<your dev wallet, funded on Kite testnet>
#   OPENROUTER_API_KEY=<free at openrouter.ai>

# 3. (Optional) Deploy your own contracts
cd ../contracts && forge install && forge build
forge script script/DeployAttribution.s.sol --broadcast --rpc-url https://rpc-testnet.gokite.ai/

# 4. Run the web app
cd ../web && pnpm dev
# → http://localhost:3000

# 5. Run a query (no wallet needed for demo budgets)
open http://localhost:3000/dashboard
```

Need real funds on Kite testnet? Use the [Kite faucet](https://faucet.gokite.ai).

---

## Other guides

- **[Demo script](demo-script.md)** — the 90-second walkthrough used in the submission video
- **[Screenshot guide](screenshot-guide.md)** — captures judges see in the Encode form
- **[Submission copy](submission-copy.md)** — Encode-form-ready blurbs
- **[Plan & milestones](plan-10-days.md)** — sprint plan with completed milestones

---

## Where things live

| Path | What's there |
|---|---|
| `web/` | Next.js 14 app (App Router) — UI, API routes, agent orchestration |
| `contracts/` | Solidity 0.8.24 + Foundry — AttributionLedger, UnclaimedYieldEscrow, NameRegistry, BountyMarket, AgentRegistry8004, CitationMirror, SimpleYieldVault |
| `mcp/` | Stdio MCP server bridging Kutip to Claude Desktop / Cursor |
| `docs/` | This documentation |

---

## Questions, bugs, contributions

- Report bugs: <https://github.com/PugarHuda/kutip/issues>
- Hackathon entry: Kite AI Global Hackathon 2026 · Novel track · deadline 2026-05-18

Built for the agentic economy, where citation is currency.
