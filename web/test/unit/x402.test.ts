/**
 * Unit tests for lib/x402 — payment header decode + facilitator settle.
 *
 * Settlement integrity = financial. We need negative coverage of every
 * malformed-input path so a bad header can never silently coerce into a
 * payment.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import nock from "nock";
import {
  buildPaymentRequired,
  decodePaymentHeader,
  isDemoMode,
  settleWithFacilitator
} from "@/lib/x402";

describe("buildPaymentRequired", () => {
  describe("positive", () => {
    it("returns 402 with x402Version=1 and a single accepts entry", () => {
      const out = buildPaymentRequired({
        priceUSDC: 100_000,
        resource: "https://kutip.test/api/foo",
        payTo: "0x5C91B851D9Aa20172e6067d9236920A6CBabf40c",
        description: "test",
        merchantName: "Kutip"
      });
      expect(out.status).toBe(402);
      expect(out.body.x402Version).toBe(1);
      expect(out.body.accepts).toHaveLength(1);
      expect(out.body.accepts[0].scheme).toBe("gokite-aa");
      expect(out.body.accepts[0].network).toBe("kite-testnet");
      expect(out.body.accepts[0].maxAmountRequired).toBe("100000");
      expect(out.body.accepts[0].maxTimeoutSeconds).toBe(300);
    });

    it("stamps the Test USD asset address as the settlement token", () => {
      const out = buildPaymentRequired({
        priceUSDC: 1,
        resource: "r",
        payTo: "p",
        description: "d",
        merchantName: "m"
      });
      expect(out.body.accepts[0].asset).toBe(
        "0x0fF5393387ad2f9f691FD6Fd28e07E3969e27e63"
      );
    });
  });

  describe("edge cases", () => {
    it("stringifies very large priceUSDC without scientific notation", () => {
      // Number.MAX_SAFE_INTEGER stringified as decimal, not 9.007e+15
      const out = buildPaymentRequired({
        priceUSDC: 9007199254740991,
        resource: "r",
        payTo: "p",
        description: "d",
        merchantName: "m"
      });
      expect(out.body.accepts[0].maxAmountRequired).toBe("9007199254740991");
    });

    it("preserves zero price (free tier sentinel)", () => {
      const out = buildPaymentRequired({
        priceUSDC: 0,
        resource: "r",
        payTo: "p",
        description: "d",
        merchantName: "m"
      });
      expect(out.body.accepts[0].maxAmountRequired).toBe("0");
    });
  });
});

describe("decodePaymentHeader", () => {
  describe("positive", () => {
    it("decodes valid base64-encoded JSON envelope", () => {
      const envelope = {
        signature: "0xabc",
        authorization: { from: "0x1", to: "0x2", value: "1000" }
      };
      const header = Buffer.from(JSON.stringify(envelope)).toString("base64");
      expect(decodePaymentHeader(header)).toEqual(envelope);
    });
  });

  describe("negative", () => {
    it("returns null for null input", () => {
      expect(decodePaymentHeader(null)).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(decodePaymentHeader("")).toBeNull();
    });

    it("returns null when base64 decodes to non-JSON", () => {
      const bad = Buffer.from("not json").toString("base64");
      expect(decodePaymentHeader(bad)).toBeNull();
    });

    it("returns null when input is not valid base64", () => {
      // base64 in node is liberal — provide truly malformed input
      // (Buffer.from will silently coerce, so we test the JSON layer)
      expect(decodePaymentHeader("@@@not-base64@@@")).toBeNull();
    });

    it("returns null when JSON is malformed", () => {
      const bad = Buffer.from('{"signature":').toString("base64");
      expect(decodePaymentHeader(bad)).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("decodes JSON with unicode and special characters", () => {
      const envelope = {
        signature: "0x" + "ff".repeat(65),
        authorization: { memo: "café · résumé · 你好" }
      };
      const header = Buffer.from(JSON.stringify(envelope)).toString("base64");
      expect(decodePaymentHeader(header)).toEqual(envelope);
    });

    it("does not throw on extremely long input (1MB)", () => {
      const big = Buffer.from("x".repeat(1024 * 1024)).toString("base64");
      expect(() => decodePaymentHeader(big)).not.toThrow();
      // (returns null because content isn't JSON)
      expect(decodePaymentHeader(big)).toBeNull();
    });
  });
});

describe("settleWithFacilitator", () => {
  beforeEach(() => {
    nock.disableNetConnect();
  });
  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });

  describe("positive", () => {
    it("returns success + txHash on 200 with txHash payload", async () => {
      nock("https://facilitator.pieverse.io")
        .post("/v2/settle")
        .reply(200, { txHash: "0xdeadbeef" });

      const r = await settleWithFacilitator({
        authorization: {},
        signature: "0xsig",
        network: "kite-testnet"
      });
      expect(r).toEqual({ success: true, txHash: "0xdeadbeef" });
    });

    it("returns success even when facilitator omits txHash (still 200)", async () => {
      nock("https://facilitator.pieverse.io").post("/v2/settle").reply(200, {});
      const r = await settleWithFacilitator({
        authorization: {},
        signature: "0xsig",
        network: "kite-testnet"
      });
      expect(r.success).toBe(true);
      expect(r.txHash).toBeUndefined();
    });
  });

  describe("negative", () => {
    it("returns failure on 4xx response", async () => {
      nock("https://facilitator.pieverse.io").post("/v2/settle").reply(400, {});
      const r = await settleWithFacilitator({
        authorization: {},
        signature: "0xsig",
        network: "kite-testnet"
      });
      expect(r.success).toBe(false);
      expect(r.error).toContain("400");
    });

    it("returns failure on 5xx response", async () => {
      nock("https://facilitator.pieverse.io").post("/v2/settle").reply(503, {});
      const r = await settleWithFacilitator({
        authorization: {},
        signature: "0xsig",
        network: "kite-testnet"
      });
      expect(r.success).toBe(false);
      expect(r.error).toContain("503");
    });
  });

  describe("edge cases", () => {
    it("propagates network errors as rejected promise", async () => {
      // No nock interceptor set + nock disables network → fetch rejects
      nock("https://facilitator.pieverse.io").post("/v2/settle").replyWithError(
        "ETIMEDOUT"
      );
      await expect(
        settleWithFacilitator({
          authorization: {},
          signature: "0xsig",
          network: "kite-testnet"
        })
      ).rejects.toThrow();
    });
  });
});

describe("isDemoMode", () => {
  describe("positive", () => {
    it("returns true when KUTIP_DEMO_MODE='1'", () => {
      const orig = process.env.KUTIP_DEMO_MODE;
      process.env.KUTIP_DEMO_MODE = "1";
      expect(isDemoMode()).toBe(true);
      process.env.KUTIP_DEMO_MODE = orig;
    });
  });

  describe("negative", () => {
    it("returns false when env unset", () => {
      const orig = process.env.KUTIP_DEMO_MODE;
      delete process.env.KUTIP_DEMO_MODE;
      expect(isDemoMode()).toBe(false);
      process.env.KUTIP_DEMO_MODE = orig;
    });

    it("returns false for any value other than exact '1'", () => {
      const orig = process.env.KUTIP_DEMO_MODE;
      for (const v of ["true", "yes", "on", "0", "01", " 1"]) {
        process.env.KUTIP_DEMO_MODE = v;
        expect(isDemoMode()).toBe(false);
      }
      process.env.KUTIP_DEMO_MODE = orig;
    });
  });
});
