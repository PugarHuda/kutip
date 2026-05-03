/**
 * Financial unit tests for lib/agent — bps normalization + flatten citations.
 *
 * 100% branch coverage target. Property-based via fast-check for invariants
 * + hand-crafted boundary cases for known-tricky inputs.
 */

import { describe, it, expect, vi } from "vitest";
import fc from "fast-check";
import {
  buildCitations,
  evenWeights,
  flattenCitationsForContract,
  normalize
} from "@/lib/agent";
import type { Paper } from "@/lib/papers";

// Lightweight Paper factory — mirrors data/papers.json shape but no I/O
function paper(id: string, authors: string[], opts?: Partial<Paper>): Paper {
  return {
    id,
    doi: `10.test/${id}`,
    title: `Paper ${id}`,
    authors,
    year: 2024,
    journal: "Test Journal",
    abstract: "abstract",
    keywords: [],
    priceUSDC: 100_000,
    ...opts
  };
}

// Author lookup mock — returns wallets with the test pattern
vi.mock("@/lib/papers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/papers")>();
  return {
    ...actual,
    getAuthor: (id: string) => {
      // Authors a001..a020 → distinct wallets
      const idx = parseInt(id.replace(/^a/, ""), 10);
      if (Number.isNaN(idx)) return undefined;
      return {
        id,
        name: `Author ${id}`,
        affiliation: "Test U",
        wallet: ("0x" + idx.toString(16).padStart(40, "0")) as `0x${string}`,
        orcid: `0000-0001-0000-${id.padStart(4, "0")}`
      };
    },
    listAuthors: () => []
  };
});

// ──────────────────────────────────────────────────────────────────────
// evenWeights — divide 10000 evenly across N papers
// ──────────────────────────────────────────────────────────────────────
describe("evenWeights", () => {
  describe("positive", () => {
    it("assigns identical weight when N divides 10000 evenly", () => {
      const papers = [paper("a", ["a001"]), paper("b", ["a002"])];
      const m = new Map<string, number>();
      evenWeights(papers, m);
      expect(m.get("a")).toBe(5000);
      expect(m.get("b")).toBe(5000);
    });

    it("absorbs rounding remainder into the LAST entry", () => {
      const papers = [
        paper("a", ["a001"]),
        paper("b", ["a002"]),
        paper("c", ["a003"])
      ];
      const m = new Map<string, number>();
      evenWeights(papers, m);
      expect(m.get("a")).toBe(3333);
      expect(m.get("b")).toBe(3333);
      expect(m.get("c")).toBe(3334); // remainder
    });
  });

  describe("edge cases", () => {
    it("single paper gets full 10000", () => {
      const m = new Map<string, number>();
      evenWeights([paper("a", ["a001"])], m);
      expect(m.get("a")).toBe(10000);
    });

    it("three papers always sum to 10000 (idempotent invariant)", () => {
      const m = new Map<string, number>();
      evenWeights(
        [paper("a", ["a1"]), paper("b", ["a2"]), paper("c", ["a3"])],
        m
      );
      const sum = Array.from(m.values()).reduce((a, b) => a + b, 0);
      expect(sum).toBe(10000);
    });
  });

  describe("property-based", () => {
    it("any N-paper input always sums to exactly 10000", () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 20 }), (n) => {
          const papers = Array.from({ length: n }, (_, i) =>
            paper(String.fromCharCode(97 + i), [`a${i + 1}`])
          );
          const m = new Map<string, number>();
          evenWeights(papers, m);
          const sum = Array.from(m.values()).reduce((a, b) => a + b, 0);
          return sum === 10000;
        })
      );
    });

    it("non-last entries are equal (within 1)", () => {
      fc.assert(
        fc.property(fc.integer({ min: 2, max: 20 }), (n) => {
          const papers = Array.from({ length: n }, (_, i) =>
            paper(String.fromCharCode(97 + i), [`a${i + 1}`])
          );
          const m = new Map<string, number>();
          evenWeights(papers, m);
          const values = Array.from(m.values());
          const non_last = values.slice(0, -1);
          // All non-last should be Math.floor(10000/n)
          const expected = Math.floor(10000 / n);
          return non_last.every((v) => v === expected);
        })
      );
    });
  });
});

// ──────────────────────────────────────────────────────────────────────
// normalize — rescale weights to sum exactly 10000
// ──────────────────────────────────────────────────────────────────────
describe("normalize", () => {
  describe("positive", () => {
    it("preserves already-normalized input within tolerance", () => {
      const papers = [paper("a", ["a1"]), paper("b", ["a2"])];
      const input = new Map([
        ["a", 6000],
        ["b", 4000]
      ]);
      const out = normalize(input, papers);
      const sum = Array.from(out.values()).reduce((a, b) => a + b, 0);
      expect(sum).toBe(10000);
    });

    it("rescales partial-coverage weights to fill 10000", () => {
      const papers = [paper("a", ["a1"]), paper("b", ["a2"])];
      const input = new Map([
        ["a", 30],
        ["b", 70]
      ]); // sums to 100 but should rescale to 10000
      const out = normalize(input, papers);
      const sum = Array.from(out.values()).reduce((a, b) => a + b, 0);
      expect(sum).toBe(10000);
      // Ratios preserved (within rounding)
      expect(out.get("a")).toBeCloseTo(3000, -2);
      expect(out.get("b")).toBeCloseTo(7000, -2);
    });
  });

  describe("edge cases", () => {
    it("falls back to evenWeights when input map is empty", () => {
      const papers = [paper("a", ["a1"]), paper("b", ["a2"])];
      const out = normalize(new Map(), papers);
      const sum = Array.from(out.values()).reduce((a, b) => a + b, 0);
      expect(sum).toBe(10000);
    });

    it("falls back to evenWeights when all input weights are 0", () => {
      const papers = [paper("a", ["a1"]), paper("b", ["a2"])];
      const out = normalize(
        new Map([
          ["a", 0],
          ["b", 0]
        ]),
        papers
      );
      const sum = Array.from(out.values()).reduce((a, b) => a + b, 0);
      expect(sum).toBe(10000);
    });

    it("filters out papers not in the input map", () => {
      const papers = [paper("a", ["a1"]), paper("b", ["a2"])];
      const out = normalize(new Map([["a", 100]]), papers);
      const sum = Array.from(out.values()).reduce((a, b) => a + b, 0);
      expect(sum).toBe(10000);
      expect(out.has("b")).toBe(false);
    });
  });

  describe("property-based — financial invariant", () => {
    it("output ALWAYS sums to exactly 10000 for any non-zero weight input", () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer({ min: 1, max: 10_000_000 }), {
            minLength: 1,
            maxLength: 10
          }),
          (weights) => {
            const papers = weights.map((_, i) =>
              paper(String.fromCharCode(97 + i), [`a${i + 1}`])
            );
            const input = new Map(
              weights.map((w, i) => [String.fromCharCode(97 + i), w])
            );
            const out = normalize(input, papers);
            const sum = Array.from(out.values()).reduce((a, b) => a + b, 0);
            return sum === 10000;
          }
        )
      );
    });

    it("preserves relative ordering: bigger input weight → bigger output", () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc.integer({ min: 1, max: 1000 }),
            fc.integer({ min: 1, max: 1000 })
          ),
          ([wa, wb]) => {
            if (wa === wb) return true; // skip ties
            const papers = [paper("a", ["a1"]), paper("b", ["a2"])];
            const out = normalize(
              new Map([
                ["a", wa],
                ["b", wb]
              ]),
              papers
            );
            const oa = out.get("a") ?? 0;
            const ob = out.get("b") ?? 0;
            // Bigger input → ≥ bigger output (≥ because last-entry rounding
            // can swap order by 1bp). For larger gaps, strict.
            if (Math.abs(wa - wb) > 1) {
              return wa > wb ? oa >= ob : ob >= oa;
            }
            return true;
          }
        )
      );
    });
  });
});

// ──────────────────────────────────────────────────────────────────────
// flattenCitationsForContract — split per-paper weight to per-author rows
// + route unclaimed to escrow when configured
// ──────────────────────────────────────────────────────────────────────
describe("flattenCitationsForContract", () => {
  describe("positive", () => {
    it("expands single-paper single-author to one row with full weight", () => {
      const papers = [paper("p1", ["a001"])];
      const weights = new Map([["p1", 10000]]);
      const { citations, escrowDeposits } = flattenCitationsForContract(
        papers,
        weights,
        10n ** 18n
      );
      expect(citations).toHaveLength(1);
      expect(citations[0].weightBps).toBe(10000);
      expect(escrowDeposits).toHaveLength(0);
    });

    it("splits single-paper N-authors evenly with last absorbing remainder", () => {
      const papers = [paper("p1", ["a001", "a002", "a003"])];
      const weights = new Map([["p1", 10000]]);
      const { citations } = flattenCitationsForContract(
        papers,
        weights,
        10n ** 18n
      );
      expect(citations).toHaveLength(3);
      // 10000/3 = 3333, last gets 10000 - 2*3333 = 3334
      expect(citations[0].weightBps).toBe(3333);
      expect(citations[1].weightBps).toBe(3333);
      expect(citations[2].weightBps).toBe(3334);
    });
  });

  describe("negative", () => {
    it("skips papers with zero weight", () => {
      const papers = [paper("p1", ["a001"]), paper("p2", ["a002"])];
      const weights = new Map([
        ["p1", 0],
        ["p2", 10000]
      ]);
      const { citations } = flattenCitationsForContract(
        papers,
        weights,
        10n ** 18n
      );
      expect(citations).toHaveLength(1);
      expect(citations[0].weightBps).toBe(10000);
    });

    it("skips papers entirely missing from weights map", () => {
      const papers = [paper("p1", ["a001"]), paper("p2", ["a002"])];
      const weights = new Map([["p1", 10000]]); // p2 missing
      const { citations } = flattenCitationsForContract(
        papers,
        weights,
        10n ** 18n
      );
      expect(citations).toHaveLength(1);
    });
  });

  describe("edge cases — financial precision", () => {
    it("ALWAYS produces citations with weightBps summing to exactly 10000", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 5 }), // num papers
          fc.integer({ min: 1, max: 5 }), // authors per paper
          (numPapers, authorsPer) => {
            const papers = Array.from({ length: numPapers }, (_, i) =>
              paper(
                `p${i}`,
                Array.from({ length: authorsPer }, (_, j) => `a${i * 10 + j + 1}`)
              )
            );
            const weights = new Map<string, number>();
            // Even split for simplicity, normalize will fix
            const per = Math.floor(10000 / numPapers);
            for (let i = 0; i < numPapers; i++) {
              weights.set(
                `p${i}`,
                i === numPapers - 1 ? 10000 - per * (numPapers - 1) : per
              );
            }
            const { citations } = flattenCitationsForContract(
              papers,
              weights,
              10n ** 18n
            );
            const sum = citations.reduce((s, c) => s + c.weightBps, 0);
            return sum === 10000;
          }
        )
      );
    });

    it("never produces a citation row with weightBps = 0", () => {
      // Per-author share could round to 0 if paperWeight < authors. Code
      // skips those.
      const papers = [paper("p1", ["a001", "a002", "a003"])];
      const weights = new Map([["p1", 1]]); // 1bps shared by 3
      const { citations } = flattenCitationsForContract(
        papers,
        weights,
        10n ** 18n
      );
      // Math.floor(1/3) = 0 → first 2 skipped. Last gets 1 (remainder).
      expect(citations.every((c) => c.weightBps > 0)).toBe(true);
    });

    it("totalPaid = 1 wei does not corrupt downstream split", () => {
      const papers = [paper("p1", ["a001"])];
      const weights = new Map([["p1", 10000]]);
      const { citations } = flattenCitationsForContract(papers, weights, 1n);
      expect(citations).toHaveLength(1);
      expect(citations[0].weightBps).toBe(10000);
    });
  });

  describe("property: weight conservation under arbitrary inputs", () => {
    it("for any valid normalize-output, flatten preserves total bps", () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.tuple(
              fc.integer({ min: 1, max: 5 }), // authors per paper
              fc.integer({ min: 1, max: 5000 })  // paper weight (pre-normalize)
            ),
            { minLength: 1, maxLength: 6 }
          ),
          (papersConfig) => {
            const papers = papersConfig.map(([authorsPer], i) =>
              paper(
                `p${i}`,
                Array.from({ length: authorsPer }, (_, j) => `a${i * 100 + j + 1}`)
              )
            );
            const inputW = new Map(
              papersConfig.map(([_, w], i) => [`p${i}`, w])
            );
            const normalized = normalize(inputW, papers);
            const { citations } = flattenCitationsForContract(
              papers,
              normalized,
              10n ** 18n
            );
            const sum = citations.reduce((s, c) => s + c.weightBps, 0);
            return sum === 10000;
          }
        )
      );
    });
  });
});

// ──────────────────────────────────────────────────────────────────────
// buildCitations — paper → frontend Citation shape
// ──────────────────────────────────────────────────────────────────────
describe("buildCitations", () => {
  describe("positive", () => {
    it("includes paperId, authorWallets, weightBps", () => {
      const papers = [paper("p1", ["a001", "a002"])];
      const weights = new Map([["p1", 5000]]);
      const cites = buildCitations(papers, weights);
      expect(cites).toHaveLength(1);
      expect(cites[0].paperId).toBe("p1");
      expect(cites[0].weightBps).toBe(5000);
      expect(cites[0].authorWallets).toHaveLength(2);
    });
  });

  describe("negative", () => {
    it("excludes papers with weight 0", () => {
      const papers = [paper("p1", ["a001"])];
      const weights = new Map([["p1", 0]]);
      expect(buildCitations(papers, weights)).toHaveLength(0);
    });

    it("excludes papers missing from weights map", () => {
      const papers = [paper("p1", ["a001"])];
      expect(buildCitations(papers, new Map())).toHaveLength(0);
    });
  });
});
