/**
 * Unit tests for lib/session — EIP-712 verify + spending cap enforcement.
 *
 * London-school: ethers Wallet provides real signatures (cheap to use,
 * no I/O). recoverTypedDataAddress verifies — kita test contract that
 * tampering / expiry / cap-overshoot all reject.
 */

import { describe, it, expect } from "vitest";
import { ethers } from "ethers";
import {
  SESSION_DOMAIN,
  SESSION_TYPES,
  checkSpendStateless,
  type SpendingIntent,
  type SessionEnvelope,
  verifyIntent
} from "@/lib/session";
import type { Address, Hex } from "viem";

const NOW_SEC = () => BigInt(Math.floor(Date.now() / 1000));
const usdc = (n: number) => BigInt(Math.round(n * 100)) * 10n ** 16n;

async function freshIntent(opts?: {
  dailyCap?: bigint;
  perQueryCap?: bigint;
  ttlSec?: bigint;
}): Promise<{ wallet: ethers.Wallet; intent: SpendingIntent; signature: Hex }> {
  const wallet = ethers.Wallet.createRandom();
  const intent: SpendingIntent = {
    user: wallet.address as Address,
    agent: "0x4da7f4cFd443084027a39cc0f7c41466d9511776" as Address,
    maxPerQueryUSDC: opts?.perQueryCap ?? usdc(2),
    dailyCapUSDC: opts?.dailyCap ?? usdc(10),
    validUntil: NOW_SEC() + (opts?.ttlSec ?? 3600n),
    nonce: BigInt(Date.now()),
    purpose: "test"
  };

  const signature = (await wallet.signTypedData(
    SESSION_DOMAIN,
    SESSION_TYPES,
    intent as unknown as Record<string, unknown>
  )) as Hex;

  return { wallet, intent, signature };
}

describe("verifyIntent", () => {
  describe("positive", () => {
    it("recovers signer and returns delegation when signature valid + future expiry", async () => {
      const { wallet, intent, signature } = await freshIntent();
      const result = await verifyIntent(intent, signature);
      expect(result.intent.user.toLowerCase()).toBe(
        wallet.address.toLowerCase()
      );
      expect(result.intent.maxPerQueryUSDC).toBe(intent.maxPerQueryUSDC);
      expect(result.intent.dailyCapUSDC).toBe(intent.dailyCapUSDC);
    });

    it("produces stable session id from same intent + signature", async () => {
      const { intent, signature } = await freshIntent();
      const a = await verifyIntent(intent, signature);
      const b = await verifyIntent(intent, signature);
      expect(a.id).toBe(b.id);
    });
  });

  describe("negative", () => {
    it("throws when signature was made by a different wallet", async () => {
      const { intent, signature } = await freshIntent();
      const tampered: SpendingIntent = {
        ...intent,
        user: ethers.Wallet.createRandom().address as Address
      };
      await expect(verifyIntent(tampered, signature)).rejects.toThrow(
        /does not match/i
      );
    });

    it("throws when intent is expired (validUntil < now)", async () => {
      const { wallet } = await freshIntent();
      const intent: SpendingIntent = {
        user: wallet.address as Address,
        agent: "0x4da7f4cFd443084027a39cc0f7c41466d9511776" as Address,
        maxPerQueryUSDC: usdc(2),
        dailyCapUSDC: usdc(10),
        validUntil: NOW_SEC() - 1n,
        nonce: 1n,
        purpose: "test"
      };
      const signature = (await wallet.signTypedData(
        SESSION_DOMAIN,
        SESSION_TYPES,
        intent as unknown as Record<string, unknown>
      )) as Hex;
      await expect(verifyIntent(intent, signature)).rejects.toThrow(/expired/i);
    });

    it("throws when intent budget field is mutated post-sign", async () => {
      const { intent, signature } = await freshIntent();
      const tampered: SpendingIntent = { ...intent, maxPerQueryUSDC: usdc(1000) };
      await expect(verifyIntent(tampered, signature)).rejects.toThrow();
    });
  });

  describe("edge cases", () => {
    it("accepts validUntil exactly 1 second in the future", async () => {
      const { wallet } = await freshIntent();
      const intent: SpendingIntent = {
        user: wallet.address as Address,
        agent: "0x4da7f4cFd443084027a39cc0f7c41466d9511776" as Address,
        maxPerQueryUSDC: usdc(2),
        dailyCapUSDC: usdc(10),
        validUntil: NOW_SEC() + 2n,
        nonce: 1n,
        purpose: "edge"
      };
      const signature = (await wallet.signTypedData(
        SESSION_DOMAIN,
        SESSION_TYPES,
        intent as unknown as Record<string, unknown>
      )) as Hex;
      await expect(verifyIntent(intent, signature)).resolves.toMatchObject({
        intent: { user: wallet.address }
      });
    });
  });
});

describe("checkSpendStateless", () => {
  describe("positive", () => {
    it("allows spend within both per-query and daily caps", async () => {
      const { intent, signature } = await freshIntent();
      const env: SessionEnvelope = { intent, signature, spentToday: 0n };
      const r = await checkSpendStateless(env, usdc(1.5));
      expect(r.newSpentToday).toBe(usdc(1.5));
    });

    it("accumulates spentToday correctly across calls", async () => {
      const { intent, signature } = await freshIntent({ dailyCap: usdc(10) });
      const env1: SessionEnvelope = { intent, signature, spentToday: 0n };
      const r1 = await checkSpendStateless(env1, usdc(2));
      expect(r1.newSpentToday).toBe(usdc(2));

      const env2: SessionEnvelope = { intent, signature, spentToday: r1.newSpentToday };
      const r2 = await checkSpendStateless(env2, usdc(2));
      expect(r2.newSpentToday).toBe(usdc(4));
    });
  });

  describe("negative", () => {
    it("rejects spend exceeding per-query cap by 1 wei", async () => {
      const { intent, signature } = await freshIntent({
        perQueryCap: usdc(2)
      });
      const env: SessionEnvelope = { intent, signature, spentToday: 0n };
      await expect(checkSpendStateless(env, usdc(2) + 1n)).rejects.toThrow(
        /per-query cap/i
      );
    });

    it("rejects spend that would push spentToday over daily cap by 1 wei", async () => {
      const { intent, signature } = await freshIntent({
        dailyCap: usdc(10),
        perQueryCap: usdc(10)
      });
      const env: SessionEnvelope = {
        intent,
        signature,
        spentToday: usdc(9.9)
      };
      await expect(
        checkSpendStateless(env, usdc(0.10) + 1n)
      ).rejects.toThrow(/daily cap/i);
    });

    it("rejects when intent expired between sign and check", async () => {
      const { wallet } = await freshIntent();
      const intent: SpendingIntent = {
        user: wallet.address as Address,
        agent: "0x4da7f4cFd443084027a39cc0f7c41466d9511776" as Address,
        maxPerQueryUSDC: usdc(2),
        dailyCapUSDC: usdc(10),
        validUntil: NOW_SEC() - 1n,
        nonce: 1n,
        purpose: "expired"
      };
      const signature = (await wallet.signTypedData(
        SESSION_DOMAIN,
        SESSION_TYPES,
        intent as unknown as Record<string, unknown>
      )) as Hex;
      const env: SessionEnvelope = { intent, signature, spentToday: 0n };
      await expect(checkSpendStateless(env, usdc(0.5))).rejects.toThrow();
    });
  });

  describe("edge cases", () => {
    it("allows spend exactly equal to per-query cap (not <)", async () => {
      const { intent, signature } = await freshIntent({
        perQueryCap: usdc(2),
        dailyCap: usdc(10)
      });
      const env: SessionEnvelope = { intent, signature, spentToday: 0n };
      const r = await checkSpendStateless(env, usdc(2));
      expect(r.newSpentToday).toBe(usdc(2));
    });

    it("allows spend that lands exactly at daily cap", async () => {
      const { intent, signature } = await freshIntent({
        dailyCap: usdc(10),
        perQueryCap: usdc(10)
      });
      const env: SessionEnvelope = {
        intent,
        signature,
        spentToday: usdc(8)
      };
      const r = await checkSpendStateless(env, usdc(2));
      expect(r.newSpentToday).toBe(usdc(10));
    });

    it("treats spentToday=dailyCap+1 wei as already breached even with 1-wei spend", async () => {
      const { intent, signature } = await freshIntent({
        dailyCap: usdc(10),
        perQueryCap: usdc(10)
      });
      // Defensive case: spentToday somehow > cap (shouldn't happen but
      // server should reject not silently allow)
      const env: SessionEnvelope = {
        intent,
        signature,
        spentToday: usdc(10) + 1n
      };
      await expect(checkSpendStateless(env, 1n)).rejects.toThrow(/daily cap/i);
    });
  });
});

describe("financial precision", () => {
  it("preserves bigint arithmetic across cap arithmetic (no Number coercion)", async () => {
    const { intent, signature } = await freshIntent({
      dailyCap: usdc(1000), // 1e21 wei — outside Number.MAX_SAFE_INTEGER's safe domain
      perQueryCap: usdc(1000)
    });
    const env: SessionEnvelope = { intent, signature, spentToday: 0n };
    const r = await checkSpendStateless(env, usdc(999.99));
    expect(r.newSpentToday).toBe(usdc(999.99));
    // Critical: the output must be a bigint, not coerced to Number with loss
    expect(typeof r.newSpentToday).toBe("bigint");
  });
});
