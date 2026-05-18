# Using Kutip

How to use the Kutip web app — from a one-click anonymous query to
signing a spending session and claiming author earnings.

Live app: <https://kutip-zeta.vercel.app>

---

## What you need

| To do this | You need |
|---|---|
| Run a quick query (budget ≤ 0.5 USDC) | Nothing — anonymous queries work out of the box |
| Run larger queries (up to 2 USDC/query) | A wallet (MetaMask) + one signed session delegation |
| Claim author earnings | A wallet + an ORCID iD |

You never need KITE for gas and you never need to hold USDC yourself —
the agent's smart account funds every query. The wallet is only used to
**sign** a spending delegation and to **prove** wallet ownership when
claiming. No transaction is ever sent from your wallet.

The app runs on **Kite testnet (chain 2368)**. Add it to MetaMask if
prompted — RPC `https://rpc-testnet.gokite.ai/`, explorer
`https://testnet.kitescan.ai/`.

---

## 1. Run a research query

1. Open **`/research`**.
2. Type a question — any language, any discipline. Kutip normalises it
   to English academic keywords before searching.
3. Pick a **budget**. A bigger budget funds a broader literature review
   and a larger payout pool for the cited authors:

   | Budget | Papers cited (approx.) |
   |---|---|
   | 0.1 USDC | 3 |
   | 0.5 USDC | 5 |
   | 1 USDC | 10 |
   | 2 USDC | 20 |

   The sidebar shows a live "≈ N papers · X USDC to authors" estimate.
4. *(Optional)* Set a **publication-year window** — `From` / `To`.
   Either side can be left blank: `From 2020` means 2020-onward.
5. Click **Pay & research**. The agent runs five steps live:
   **Search → Purchase → Read → Attribute → Settle**.

Anonymous queries are capped at **0.5 USDC**. To go higher, connect a
wallet and sign a session (next section).

## 2. Connect a wallet + sign a session

For budgets above 0.5 USDC, Kutip uses a **Kite-Passport-style session
delegation**:

1. Click **Connect wallet** (top right) and approve in MetaMask.
2. In the research sidebar, open **Agent Passport** and sign the
   `SpendingIntent` — one EIP-712 signature that authorises the agent to
   spend **up to a per-query cap and a daily cap**, with an expiry.
3. That's it — every subsequent query runs against those caps. The
   signature is not a transaction; you pay no gas.

You can **Revoke** the session at any time from the same panel.

## 3. Read the result

When the agent finishes you get:

- **Summary** — a synthesis with inline citation pills. Hover a pill to
  see the paper title + journal; click it to open the source.
- **Attribution receipt** — the query fee split **80% authors / 15%
  operator / 5% ecosystem**, one row per paid author with wallet + amount.
- **Tx hash** on KiteScan (authoritative) and an Avalanche Fuji mirror.
- **Bibliography** — every paper cited, with DOI links.

The header reads "*N papers cited · M authors paid*" — one paper is one
citation; each paper usually carries several authors, so M ≥ N.

Attestation is **fail-closed**: if the on-chain settlement reverts, you
get an error instead of a summary. No citation lands without payment.

## 4. Claim author earnings (for cited authors)

If you are one of the cited authors, your share is held against a
deterministic placeholder wallet until you claim it:

1. Open **`/claim`**.
2. Enter your **ORCID iD** and connect the wallet you want paid.
3. Sign the claim message — this binds `ORCID → wallet` in the on-chain
   `NameRegistry`.
4. Future attestations resolve to your real wallet. Unclaimed shares
   accrue **5% APY** in the `UnclaimedYieldEscrow` until claimed.

> Demo note: ORCID *identity* verification is mocked in the hackathon
> build (real ORCID OAuth needs production approval). The wallet
> signature and the on-chain binding are fully real.

## 5. Verify any attestation

Anyone can audit a query without trusting the UI:

- **`/verify`** — paste a `queryId` to see the on-chain citation ledger,
  the per-author payout split, the full research synthesis, and its
  **keccak256 digest**. The digest is tamper-evidence: recompute it from
  the synthesis text and any edit shows up as a mismatch.
- **Download JSON receipt** — one button bundles the on-chain attestation,
  every payout, the synthesis, and the digest into a portable artifact.
- Or open the KiteScan tx directly from any receipt.
- The dashboard activity feed, earnings, and agent stats all read live
  `QueryAttested` events on-chain — no database required in the path.

## 6. Browse research history

**`/dashboard/history`** lists every research run Kutip has done —
query, a synthesis preview, USDC paid, citation count, and the digest.
Click any row to open its full `/verify` page. Summaries are persisted
(Vercel Blob), so the history survives server restarts.

---

## Where to go next

- [Architecture](architecture.md) — how the five steps work under the hood.
- [Integrate with Kutip](integrate.md) — call the agent from your own app or an MCP client.
- [Security model](security.md) — what's enforced on-chain and why.
