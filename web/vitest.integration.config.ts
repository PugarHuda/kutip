import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

/**
 * Integration test config — slower, less isolation, real subsystems
 * (ethers Wallet for signatures, in-memory claim store, server-side
 * route handlers).
 *
 * Runs SEPARATELY from unit tests:
 *   pnpm test:integration   →  uses this config
 *   pnpm test:unit          →  vitest.config.ts (faster, parallel)
 *
 * No coverage requirement — coverage is enforced on the unit suite
 * which is the canonical proof of correctness. Integration tests
 * verify wiring + flow, not branches.
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
    include: ["test/integration/**/*.{test,spec}.ts"],
    exclude: ["test/integration/helpers/**"],
    setupFiles: ["test/setup.ts"],
    testTimeout: 30_000, // generous — real signing + nock teardown
    pool: "forks", // each test runs isolated — clean global state per spec
    poolOptions: {
      forks: { singleFork: true }
    }
  }
});
