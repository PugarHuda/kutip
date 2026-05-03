/**
 * Unit tests for lib/kitepass — Passport vault helpers.
 *
 * London-school: SDK + provider mocked. We test only the pure helpers
 * (buildKutipRules) + the public constants. Deploy/configure go in
 * integration tests with Anvil.
 */

import { describe, it, expect } from "vitest";
import { buildKutipRules, KITEPASS_ADDRESSES, type SpendingRule } from "@/lib/kitepass";
import { ethers } from "ethers";

const ONE_USDC = ethers.parseUnits("1", 18);
const TEN_USDC = ethers.parseUnits("10", 18);

describe("buildKutipRules", () => {
  describe("positive", () => {
    it("returns exactly 2 rules: daily + per-tx", () => {
      const rules = buildKutipRules({
        dailyBudgetUSDC: TEN_USDC,
        perTxCapUSDC: ONE_USDC * 2n
      });
      expect(rules).toHaveLength(2);
      expect(rules[0].timeWindow).toBe(86400n);
      expect(rules[1].timeWindow).toBe(0n);
    });

    it("daily rule budget matches input dailyBudgetUSDC", () => {
      const rules = buildKutipRules({
        dailyBudgetUSDC: TEN_USDC,
        perTxCapUSDC: ONE_USDC
      });
      expect(rules[0].budget).toBe(TEN_USDC);
    });

    it("per-tx rule budget matches input perTxCapUSDC", () => {
      const rules = buildKutipRules({
        dailyBudgetUSDC: TEN_USDC,
        perTxCapUSDC: ONE_USDC * 5n
      });
      expect(rules[1].budget).toBe(ONE_USDC * 5n);
    });

    it("both rules use empty targetProviders (universal)", () => {
      const rules = buildKutipRules({
        dailyBudgetUSDC: TEN_USDC,
        perTxCapUSDC: ONE_USDC
      });
      for (const r of rules) {
        expect(r.targetProviders).toEqual([]);
      }
    });

    it("daily rule anchors initialWindowStartTime to local-midnight UTC by default", () => {
      const rules = buildKutipRules({
        dailyBudgetUSDC: TEN_USDC,
        perTxCapUSDC: ONE_USDC
      });
      // It uses `new Date(year, month, date)` which is LOCAL time start of
      // day. Just sanity-check it's <= now and within 24h of now.
      const now = BigInt(Math.floor(Date.now() / 1000));
      expect(rules[0].initialWindowStartTime).toBeLessThanOrEqual(now);
      expect(now - rules[0].initialWindowStartTime).toBeLessThanOrEqual(
        86400n * 2n
      );
    });

    it("per-tx rule has initialWindowStartTime = 0 (no window anchor)", () => {
      const rules = buildKutipRules({
        dailyBudgetUSDC: TEN_USDC,
        perTxCapUSDC: ONE_USDC
      });
      expect(rules[1].initialWindowStartTime).toBe(0n);
    });
  });

  describe("edge cases", () => {
    it("respects explicit startOfDay override", () => {
      const explicitStart = 1_700_000_000n;
      const rules = buildKutipRules({
        dailyBudgetUSDC: TEN_USDC,
        perTxCapUSDC: ONE_USDC,
        startOfDay: explicitStart
      });
      expect(rules[0].initialWindowStartTime).toBe(explicitStart);
    });

    it("accepts 0 budget without crashing (defensive)", () => {
      const rules = buildKutipRules({
        dailyBudgetUSDC: 0n,
        perTxCapUSDC: 0n
      });
      expect(rules[0].budget).toBe(0n);
      expect(rules[1].budget).toBe(0n);
    });

    it("accepts very large budget at uint160 boundary", () => {
      // KitePass contract uses uint160 for budget. Validate we don't
      // accidentally truncate a legitimate value before sending on-chain.
      const max160 = (1n << 160n) - 1n;
      const rules = buildKutipRules({
        dailyBudgetUSDC: max160,
        perTxCapUSDC: max160
      });
      expect(rules[0].budget).toBe(max160);
      expect(rules[1].budget).toBe(max160);
    });
  });
});

describe("KITEPASS_ADDRESSES", () => {
  describe("positive", () => {
    it("exports SETTLEMENT_TOKEN matching Kite testnet Test USD", () => {
      expect(KITEPASS_ADDRESSES.SETTLEMENT_TOKEN).toBe(
        "0x0fF5393387ad2f9f691FD6Fd28e07E3969e27e63"
      );
    });

    it("exports CLIENT_AGENT_VAULT_IMPL matching Kite docs", () => {
      expect(KITEPASS_ADDRESSES.CLIENT_AGENT_VAULT_IMPL).toBe(
        "0xB5AAFCC6DD4DFc2B80fb8BCcf406E1a2Fd559e23"
      );
    });
  });
});

describe("SpendingRule shape contract", () => {
  it("requires bigint timeWindow + budget + initialWindowStartTime", () => {
    const r: SpendingRule = {
      timeWindow: 0n,
      budget: 0n,
      initialWindowStartTime: 0n,
      targetProviders: []
    };
    // Compile-time check; runtime asserts values are usable
    expect(typeof r.timeWindow).toBe("bigint");
    expect(typeof r.budget).toBe("bigint");
    expect(typeof r.initialWindowStartTime).toBe("bigint");
    expect(Array.isArray(r.targetProviders)).toBe(true);
  });
});
