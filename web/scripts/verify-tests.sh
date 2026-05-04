#!/usr/bin/env bash
# verify-tests.sh — runs the full Kutip test stack and prints a summary.
# Used as a post-install smoke check + before-commit gate.

set -e

cd "$(dirname "$0")/.."

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  Kutip · Full Test Stack Verification"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# ── 1. TypeScript ─────────────────────────────────────────────────────
echo "▸ TypeScript typecheck"
pnpm typecheck
echo "  ✓ typecheck passed"
echo ""

# ── 2. Vitest unit ────────────────────────────────────────────────────
echo "▸ Vitest unit tests"
pnpm test:unit
echo ""

# ── 3. Vitest integration ─────────────────────────────────────────────
echo "▸ Vitest integration tests"
pnpm test:integration
echo ""

# ── 4. Foundry ────────────────────────────────────────────────────────
echo "▸ Foundry contract tests"
cd ../contracts
forge test
cd ../web
echo ""

# ── 5. Coverage ───────────────────────────────────────────────────────
echo "▸ Vitest coverage (gates: 80% lines, 100% branches on financial)"
pnpm test:coverage
echo ""

echo "═══════════════════════════════════════════════════════════════"
echo "  ALL GREEN ✓"
echo "═══════════════════════════════════════════════════════════════"
