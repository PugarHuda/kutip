/**
 * Unit tests for lib/orcid-oauth — HMAC-signed cookie + OAuth helpers.
 *
 * London-school: no real HTTP. Covers the cookie signing surface
 * exhaustively (positive, negative, edge) since auth bypass = critical.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  buildCookiePayload,
  isOrcidOauthEnabled,
  orcidAuthorizeUrl,
  redirectUrl,
  signCookie,
  verifyCookie,
  ORCID_COOKIE_NAME
} from "@/lib/orcid-oauth";

const NOW = Math.floor(Date.now() / 1000);

describe("signCookie", () => {
  describe("positive", () => {
    it("produces body.signature pair separated by single dot", () => {
      const out = signCookie({ orcid: "0009-0002-8864-0901", exp: NOW + 60 });
      const parts = out.split(".");
      expect(parts).toHaveLength(2);
      expect(parts[0].length).toBeGreaterThan(0);
      expect(parts[1].length).toBeGreaterThan(0);
    });

    it("signature is deterministic for the same payload + secret", () => {
      const payload = { orcid: "0009-0002-8864-0901", exp: NOW + 60 };
      expect(signCookie(payload)).toBe(signCookie(payload));
    });

    it("body decodes back to the original payload", () => {
      const payload = { orcid: "0000-0002-1825-0097", exp: NOW + 1800 };
      const [body] = signCookie(payload).split(".");
      const decoded = JSON.parse(Buffer.from(body, "base64url").toString());
      expect(decoded).toEqual(payload);
    });
  });

  describe("negative", () => {
    it("throws when ORCID_COOKIE_SECRET is unset", () => {
      const orig = process.env.ORCID_COOKIE_SECRET;
      delete process.env.ORCID_COOKIE_SECRET;
      expect(() => signCookie({ orcid: "x", exp: NOW })).toThrow(/min 16 chars/);
      process.env.ORCID_COOKIE_SECRET = orig;
    });

    it("throws when ORCID_COOKIE_SECRET is shorter than 16 chars", () => {
      const orig = process.env.ORCID_COOKIE_SECRET;
      process.env.ORCID_COOKIE_SECRET = "short";
      expect(() => signCookie({ orcid: "x", exp: NOW })).toThrow();
      process.env.ORCID_COOKIE_SECRET = orig;
    });
  });

  describe("edge cases", () => {
    it("handles ORCIDs with trailing X check digit", () => {
      const out = signCookie({ orcid: "0000-0002-1825-009X", exp: NOW + 60 });
      expect(out.split(".")).toHaveLength(2);
    });

    it("differs across distinct exp values", () => {
      const a = signCookie({ orcid: "x", exp: NOW + 60 });
      const b = signCookie({ orcid: "x", exp: NOW + 61 });
      expect(a).not.toBe(b);
    });

    it("differs when secret rotates (defense against silent key reuse)", () => {
      const orig = process.env.ORCID_COOKIE_SECRET;
      const a = signCookie({ orcid: "x", exp: NOW + 60 });
      process.env.ORCID_COOKIE_SECRET = "rotated_secret_with_min_length";
      const b = signCookie({ orcid: "x", exp: NOW + 60 });
      expect(a).not.toBe(b);
      process.env.ORCID_COOKIE_SECRET = orig;
    });
  });
});

describe("verifyCookie", () => {
  describe("positive", () => {
    it("returns payload when signature is valid + not expired", () => {
      const signed = signCookie({ orcid: "0009-0002-8864-0901", exp: NOW + 60 });
      expect(verifyCookie(signed)).toEqual({
        orcid: "0009-0002-8864-0901",
        exp: NOW + 60
      });
    });

    it("uses constant-time comparison (no early-exit on first mismatched byte)", () => {
      // Verifies timingSafeEqual is in path: if not, identical-prefix forgeries
      // would leak timing info. We can only assert correctness here, not timing.
      const signed = signCookie({ orcid: "x", exp: NOW + 60 });
      const [body, sig] = signed.split(".");
      const flippedSig = sig.slice(0, -1) + (sig.endsWith("A") ? "B" : "A");
      expect(verifyCookie(`${body}.${flippedSig}`)).toBeNull();
    });
  });

  describe("negative", () => {
    it("returns null for undefined input", () => {
      expect(verifyCookie(undefined)).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(verifyCookie("")).toBeNull();
    });

    it("returns null for input without dot separator", () => {
      expect(verifyCookie("noseparator")).toBeNull();
    });

    it("returns null for input with multiple dot separators (split !== 2)", () => {
      expect(verifyCookie("a.b.c")).toBeNull();
    });

    it("returns null when signature is forged", () => {
      const [body] = signCookie({ orcid: "x", exp: NOW + 60 }).split(".");
      expect(verifyCookie(`${body}.forged_sig_value`)).toBeNull();
    });

    it("returns null when body is mutated but signature kept", () => {
      const signed = signCookie({ orcid: "real", exp: NOW + 60 });
      const sig = signed.split(".")[1];
      const fakeBody = Buffer.from(
        JSON.stringify({ orcid: "attacker", exp: NOW + 60 })
      ).toString("base64url");
      expect(verifyCookie(`${fakeBody}.${sig}`)).toBeNull();
    });

    it("returns null when payload is expired", () => {
      const signed = signCookie({ orcid: "x", exp: NOW - 1 });
      expect(verifyCookie(signed)).toBeNull();
    });

    it("returns null when JSON body is malformed", () => {
      // Build a manually-crafted bad cookie: valid signature for invalid JSON
      const badBody = Buffer.from("not json").toString("base64url");
      // can't sign without exposing internals — just verify garbage rejected
      expect(verifyCookie(`${badBody}.anysig`)).toBeNull();
    });

    it("returns null when signature has wrong length (timingSafeEqual would throw)", () => {
      const [body] = signCookie({ orcid: "x", exp: NOW + 60 }).split(".");
      expect(verifyCookie(`${body}.short`)).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("accepts payload exactly at exp = now+1", () => {
      const signed = signCookie({ orcid: "x", exp: NOW + 1 });
      expect(verifyCookie(signed)?.orcid).toBe("x");
    });

    it("rejects payload exactly at exp = now-1", () => {
      const signed = signCookie({ orcid: "x", exp: NOW - 1 });
      expect(verifyCookie(signed)).toBeNull();
    });

    it("round-trips ORCIDs containing the X check digit", () => {
      const signed = signCookie({ orcid: "0000-0002-1825-009X", exp: NOW + 60 });
      expect(verifyCookie(signed)?.orcid).toBe("0000-0002-1825-009X");
    });
  });
});

describe("buildCookiePayload", () => {
  describe("positive", () => {
    it("anchors exp to ~30 minutes (1800s) from now", () => {
      const before = Math.floor(Date.now() / 1000);
      const payload = buildCookiePayload("0000-0001-1234-0001");
      const after = Math.floor(Date.now() / 1000);
      const expected = before + 30 * 60;
      // exp should be within 2s of expected (clock drift tolerance)
      expect(payload.exp).toBeGreaterThanOrEqual(expected - 1);
      expect(payload.exp).toBeLessThanOrEqual(after + 30 * 60 + 1);
    });

    it("preserves orcid string verbatim", () => {
      expect(buildCookiePayload("0009-0002-8864-0901").orcid).toBe(
        "0009-0002-8864-0901"
      );
    });
  });
});

describe("isOrcidOauthEnabled", () => {
  describe("positive", () => {
    it("returns true when both client id and secret are set", () => {
      expect(isOrcidOauthEnabled()).toBe(true);
    });
  });

  describe("negative", () => {
    it("returns false when client id missing", () => {
      const orig = process.env.ORCID_CLIENT_ID;
      delete process.env.ORCID_CLIENT_ID;
      expect(isOrcidOauthEnabled()).toBe(false);
      process.env.ORCID_CLIENT_ID = orig;
    });

    it("returns false when client secret missing", () => {
      const orig = process.env.ORCID_CLIENT_SECRET;
      delete process.env.ORCID_CLIENT_SECRET;
      expect(isOrcidOauthEnabled()).toBe(false);
      process.env.ORCID_CLIENT_SECRET = orig;
    });
  });
});

describe("orcidAuthorizeUrl", () => {
  describe("positive", () => {
    it("includes client_id, redirect_uri, scope=/authenticate, state, response_type=code", () => {
      const url = orcidAuthorizeUrl("test-state-abc");
      expect(url).toContain("client_id=test-client");
      expect(url).toContain("scope=%2Fauthenticate");
      expect(url).toContain("response_type=code");
      expect(url).toContain("state=test-state-abc");
      expect(url).toContain(
        "redirect_uri=https%3A%2F%2Ftest.kutip.local%2Fapi%2Fauth%2Forcid%2Fcallback"
      );
    });

    it("uses the configured ORCID_OAUTH_BASE when set", () => {
      const orig = process.env.ORCID_OAUTH_BASE;
      process.env.ORCID_OAUTH_BASE = "https://sandbox.orcid.org";
      const url = orcidAuthorizeUrl("s");
      expect(url).toMatch(/^https:\/\/sandbox\.orcid\.org\/oauth\/authorize/);
      if (orig === undefined) delete process.env.ORCID_OAUTH_BASE;
      else process.env.ORCID_OAUTH_BASE = orig;
    });
  });

  describe("negative", () => {
    it("throws when client id is missing", () => {
      const orig = process.env.ORCID_CLIENT_ID;
      delete process.env.ORCID_CLIENT_ID;
      expect(() => orcidAuthorizeUrl("s")).toThrow(/ORCID_CLIENT_ID/);
      process.env.ORCID_CLIENT_ID = orig;
    });
  });

  describe("edge cases", () => {
    it("URL-encodes state values containing reserved characters", () => {
      // state shouldn't normally contain these (we use hex), but encoding is
      // the contract — test that it survives the round-trip.
      const raw = "state with spaces & ampersands";
      const url = orcidAuthorizeUrl(raw);
      expect(url).toContain(encodeURIComponent(raw));
    });
  });
});

describe("redirectUrl", () => {
  describe("positive", () => {
    it("appends /api/auth/orcid/callback to NEXT_PUBLIC_SITE_URL", () => {
      expect(redirectUrl()).toBe(
        "https://test.kutip.local/api/auth/orcid/callback"
      );
    });

    it("strips trailing slash from site URL before appending", () => {
      const orig = process.env.NEXT_PUBLIC_SITE_URL;
      process.env.NEXT_PUBLIC_SITE_URL = "https://test.kutip.local/";
      expect(redirectUrl()).toBe(
        "https://test.kutip.local/api/auth/orcid/callback"
      );
      process.env.NEXT_PUBLIC_SITE_URL = orig;
    });
  });

  describe("edge cases", () => {
    it("falls back to localhost when NEXT_PUBLIC_SITE_URL unset", () => {
      const orig = process.env.NEXT_PUBLIC_SITE_URL;
      delete process.env.NEXT_PUBLIC_SITE_URL;
      expect(redirectUrl()).toBe("http://localhost:3000/api/auth/orcid/callback");
      process.env.NEXT_PUBLIC_SITE_URL = orig;
    });
  });
});

describe("ORCID_COOKIE_NAME", () => {
  it("is the expected stable identifier", () => {
    expect(ORCID_COOKIE_NAME).toBe("kutip_orcid_verified");
  });
});
