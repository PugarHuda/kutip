/**
 * Integration test: /api/claim full flow.
 *
 * Mid scope:
 *   - Real Next.js route handler
 *   - Real ethers Wallet for signature
 *   - nock mocks ORCID public API + bundler RPC
 *   - In-memory claim cache (no Anvil needed for this route — it uses
 *     server-side claim store + Map fallback when on-chain not configured)
 *
 * Verifies:
 *   - Happy path: ORCID OAuth cookie + sig + valid ORCID → 200 ok
 *   - 401 if OAuth cookie missing
 *   - 403 if claimed ORCID ≠ cookie ORCID
 *   - 400 if signature regex fails
 *   - 401 if signature does not recover wallet
 *   - 404 if ORCID neither in pub.orcid.org nor catalog
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import nock from "nock";
import { ethers } from "ethers";
import {
  buildClaimMessage,
  signCookieFor
} from "./helpers/claim-helpers";
import { POST } from "@/app/api/claim/route";

// We can't easily spin a real Next request — use a NextRequest builder
import { NextRequest } from "next/server";

const ORCID_REAL = "0009-0002-8864-0901";
const ORCID_NOT_FOUND = "9999-9999-9999-9999";

// Force on-chain claim disabled so we hit the in-memory path
beforeEach(() => {
  delete process.env.NEXT_PUBLIC_NAME_REGISTRY;
  delete process.env.KUTIP_NAME_REGISTRY;
  nock.disableNetConnect();
  nock.enableNetConnect("127.0.0.1");
});

afterEach(() => {
  nock.cleanAll();
  nock.enableNetConnect();
});

function mockOrcidApi(orcid: string, response: unknown, status = 200) {
  nock("https://pub.orcid.org")
    .get(`/v3.0/${orcid}`)
    .reply(status, response);
}

async function buildRequest(opts: {
  orcid: string;
  wallet: string;
  signature: string;
  cookie?: string;
}): Promise<NextRequest> {
  const headers = new Headers();
  if (opts.cookie) {
    headers.set("cookie", `kutip_orcid_verified=${opts.cookie}`);
  }
  headers.set("content-type", "application/json");
  return new NextRequest("https://test.kutip.local/api/claim", {
    method: "POST",
    headers,
    body: JSON.stringify({
      orcid: opts.orcid,
      wallet: opts.wallet,
      signature: opts.signature
    })
  });
}

describe("POST /api/claim", () => {
  describe("positive", () => {
    it("returns 200 with bound author when OAuth + sig + ORCID all valid", async () => {
      mockOrcidApi(ORCID_REAL, {
        "orcid-identifier": { path: ORCID_REAL },
        person: {
          name: { "given-names": { value: "Test" }, "family-name": { value: "Author" } }
        }
      });

      const wallet = ethers.Wallet.createRandom();
      const message = buildClaimMessage(ORCID_REAL, wallet.address);
      const signature = await wallet.signMessage(message);
      const cookie = await signCookieFor(ORCID_REAL);

      const req = await buildRequest({
        orcid: ORCID_REAL,
        wallet: wallet.address,
        signature,
        cookie
      });

      const res = await POST(req);
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.bound.orcid).toBe(ORCID_REAL);
      expect(body.bound.wallet.toLowerCase()).toBe(wallet.address.toLowerCase());
    });
  });

  describe("negative", () => {
    it("returns 401 when OAuth cookie is missing (and OAuth enabled)", async () => {
      mockOrcidApi(ORCID_REAL, {
        "orcid-identifier": { path: ORCID_REAL },
        person: { name: { "given-names": { value: "T" }, "family-name": { value: "A" } } }
      });

      const wallet = ethers.Wallet.createRandom();
      const sig = await wallet.signMessage(buildClaimMessage(ORCID_REAL, wallet.address));

      const req = await buildRequest({
        orcid: ORCID_REAL,
        wallet: wallet.address,
        signature: sig
        // no cookie
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it("returns 403 when claimed ORCID doesn't match OAuth cookie ORCID", async () => {
      mockOrcidApi(ORCID_REAL, {
        "orcid-identifier": { path: ORCID_REAL },
        person: { name: { "given-names": { value: "T" }, "family-name": { value: "A" } } }
      });

      const wallet = ethers.Wallet.createRandom();
      const sig = await wallet.signMessage(buildClaimMessage(ORCID_REAL, wallet.address));
      const cookie = await signCookieFor("0000-0001-0000-0000"); // mismatched

      const req = await buildRequest({
        orcid: ORCID_REAL,
        wallet: wallet.address,
        signature: sig,
        cookie
      });
      const res = await POST(req);
      expect(res.status).toBe(403);
    });

    it("returns 400 when signature is malformed", async () => {
      const wallet = ethers.Wallet.createRandom();
      const cookie = await signCookieFor(ORCID_REAL);

      const req = await buildRequest({
        orcid: ORCID_REAL,
        wallet: wallet.address,
        signature: "0xshort", // not 130 hex chars
        cookie
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("returns 401 when signature does not recover the claimed wallet", async () => {
      mockOrcidApi(ORCID_REAL, {
        "orcid-identifier": { path: ORCID_REAL },
        person: { name: { "given-names": { value: "T" }, "family-name": { value: "A" } } }
      });

      const wallet = ethers.Wallet.createRandom();
      const otherWallet = ethers.Wallet.createRandom();
      // Sign with wallet A but claim wallet B
      const sig = await wallet.signMessage(buildClaimMessage(ORCID_REAL, otherWallet.address));
      const cookie = await signCookieFor(ORCID_REAL);

      const req = await buildRequest({
        orcid: ORCID_REAL,
        wallet: otherWallet.address,
        signature: sig,
        cookie
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it("returns 404 when ORCID is unknown to both orcid.org and catalog", async () => {
      mockOrcidApi(ORCID_NOT_FOUND, { error: "not found" }, 404);

      const wallet = ethers.Wallet.createRandom();
      const sig = await wallet.signMessage(buildClaimMessage(ORCID_NOT_FOUND, wallet.address));
      const cookie = await signCookieFor(ORCID_NOT_FOUND);

      const req = await buildRequest({
        orcid: ORCID_NOT_FOUND,
        wallet: wallet.address,
        signature: sig,
        cookie
      });
      const res = await POST(req);
      expect(res.status).toBe(404);
    });
  });
});
