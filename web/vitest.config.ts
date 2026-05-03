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
      include: ["lib/**/*.ts", "app/api/**/*.ts"],
      exclude: [
        "lib/types.ts",
        "lib/abi.ts",
        "**/*.d.ts",
        "lib/wagmi.ts" // pure config
      ],
      thresholds: {
        lines: 80,
        branches: 80,
        functions: 80,
        statements: 80,
        // Financial modules — stricter
        "lib/agent.ts": {
          lines: 80,
          branches: 100,
          functions: 90
        }
      }
    }
  }
});
