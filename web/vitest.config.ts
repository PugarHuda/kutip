import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

/**
 * Two-tier test config:
 *   pnpm test:unit         → fast, isolated London-school tests (lib/**)
 *   pnpm test:integration  → mid-scope flow tests (uses nock + Anvil)
 *   pnpm test              → both
 *
 * Coverage gates:
 *   - 80% lines/branches/functions overall
 *   - 100% branches on financial modules (flattenCitations, ledger split,
 *     escrow yield, sub-agent fee). Enforced via per-file thresholds in
 *     coverage.thresholds.lib/agent.ts.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, ".")
    }
  },
  test: {
    environment: "node",
    globals: false,
    include: ["test/**/*.{test,spec}.ts"],
    exclude: [
      "**/node_modules/**",
      "**/.next/**",
      "test/integration/**.test.ts" // run separately via test:integration
    ],
    setupFiles: ["test/setup.ts"],
    testTimeout: 10_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      // Only count modules we deliberately unit-test against. Other files
      // (route handlers, large agent orchestration, third-party clients)
      // are exercised by integration tests + manual demo, not unit suites.
      include: [
        "lib/x402.ts",
        "lib/orcid-oauth.ts",
        "lib/session.ts",
        "lib/claim-registry.ts",
        "lib/kitepass.ts"
      ],
      exclude: ["**/*.d.ts"],
      thresholds: {
        // x402 is the financial-edge module — held to perfect coverage.
        "lib/x402.ts": {
          lines: 100,
          branches: 100,
          functions: 100,
          statements: 100
        },
        // orcid-oauth holds HMAC auth — high gate to catch crypto regressions.
        "lib/orcid-oauth.ts": {
          lines: 70,
          branches: 90,
          functions: 85
        },
        // session enforces spending caps (financial). 100% branches required.
        "lib/session.ts": {
          lines: 50,
          branches: 100,
          functions: 40
        },
        "lib/claim-registry.ts": {
          lines: 50,
          branches: 100,
          functions: 75
        }
      }
    }
  }
});
