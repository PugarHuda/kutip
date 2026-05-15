"use client";

import { useEffect, useState } from "react";

export interface AutoDemoAuthor {
  name: string;
  amt: string;
}

const DEFAULT_AUTHORS: AutoDemoAuthor[] = [
  { name: "Mahdi Fasihi", amt: "0.0200" },
  { name: "Christian Breyer", amt: "0.0200" },
  { name: "Olga Efimova", amt: "0.0000" },
  { name: "Colin D. Bailie", amt: "0.0000" }
];

/**
 * Self-running visual demo that cycles through Kutip's main flow:
 *   typing → paying → searching → reading → ledger → settled → receipt → reset.
 *
 * Pure presentational — no real wallet, no real backend. Lives on the landing
 * page so judges see the UX without needing wallet connect or ORCID OAuth.
 *
 * Timeline (16s total):
 *   0.0s  idle
 *   0.5s  typing query
 *   3.5s  paying (button morphs)
 *   4.5s  step 1 (search)
 *   6.0s  step 2 (purchase)
 *   7.5s  step 3 (read)
 *   9.0s  step 4 (attribute)
 *  10.5s  step 5 (settle, tx hash appears)
 *  12.0s  receipt fades in
 *  16.0s  reset
 */

const QUERY = "What are the top carbon capture methods in 2024?";
const STEP_NAMES = [
  "Searching Semantic Scholar",
  "Purchasing papers via x402",
  "Reading with z-ai glm 4.5 air",
  "Building attribution ledger",
  "Settled via agent smart account"
];

interface DemoState {
  typed: string;          // characters revealed in the query input
  paying: boolean;        // pay button morphed
  stepsDone: number;      // 0..5
  receiptVisible: boolean;
}

const TOTAL_MS = 16_000;

function stateAt(elapsed: number): DemoState {
  // Reveal one char per 60ms during the typing window.
  const typingMs = elapsed - 500;
  const typedCount =
    typingMs <= 0 ? 0 : Math.min(QUERY.length, Math.floor(typingMs / 60));
  return {
    typed: QUERY.slice(0, typedCount),
    paying: elapsed >= 3500 && elapsed < 4500,
    stepsDone: Math.max(
      0,
      Math.min(5, Math.floor((elapsed - 4500) / 1500) + (elapsed >= 4500 ? 1 : 0))
    ),
    receiptVisible: elapsed >= 12_000
  };
}

export function AutoDemo({
  authors = DEFAULT_AUTHORS
}: {
  authors?: AutoDemoAuthor[];
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = () => {
      const now = performance.now();
      setElapsed(((now - start) % TOTAL_MS) | 0);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const s = stateAt(elapsed);
  const progress = elapsed / TOTAL_MS;

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        fontFamily: "var(--font-inter)"
      }}
      aria-label="Auto-playing demo of a Kutip query: typing, paying, settling, receipt"
    >
      {/* fake browser chrome */}
      <div
        className="px-3 py-2 flex items-center gap-2"
        style={{
          borderBottom: "1px solid var(--border)",
          background: "color-mix(in srgb, var(--ink) 4%, transparent)"
        }}
      >
        <div className="flex gap-1.5">
          <span style={{ width: 8, height: 8, borderRadius: 8, background: "#f87171" }} />
          <span style={{ width: 8, height: 8, borderRadius: 8, background: "#fbbf24" }} />
          <span style={{ width: 8, height: 8, borderRadius: 8, background: "#34d399" }} />
        </div>
        <span className="t-mono-sm ink-3 ml-2">kutip-zeta.vercel.app/dashboard</span>
        <span className="ml-auto chip chip--success" style={{ fontSize: 10 }}>
          <span
            className="status-dot status-dot--done"
            style={{ width: 6, height: 6 }}
          />
          live
        </span>
      </div>

      {/* canvas */}
      <div className="px-4 py-4 flex flex-col gap-3" style={{ minHeight: 380 }}>
        <div>
          <div className="t-caption">Your question</div>
          <div
            className="card mt-1.5 p-2.5 text-sm font-mono"
            style={{
              minHeight: 38,
              background: "color-mix(in srgb, var(--ink) 3%, transparent)"
            }}
          >
            {s.typed}
            {s.typed.length < QUERY.length && (
              <span className="animate-pulse" style={{ color: "var(--kite-500)" }}>
                |
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          disabled
          className="btn btn--primary mt-1"
          style={{
            justifyContent: "center",
            transition: "background 200ms",
            background: s.paying ? "var(--kite-700)" : undefined
          }}
        >
          {s.paying ? "Paying 0.10 USDC…" : "Pay 0.10 USDC & research →"}
        </button>

        {s.stepsDone > 0 && (
          <div className="card p-3 mt-1 flex flex-col gap-1.5">
            <div className="t-caption mb-0.5">
              {s.stepsDone < 5 ? "Streaming…" : "Done · 5 steps complete"}
            </div>
            {STEP_NAMES.map((name, i) => {
              const done = i < s.stepsDone;
              const active = i === s.stepsDone - 1 && s.stepsDone < 5;
              return (
                <div
                  key={name}
                  className="flex items-center gap-2 text-sm"
                  style={{ opacity: done || active ? 1 : 0.35 }}
                >
                  <span
                    className="status-dot"
                    style={{
                      width: 7,
                      height: 7,
                      background: done && !active
                        ? "var(--emerald-500)"
                        : active
                        ? "var(--kite-500)"
                        : "var(--ink-3)"
                    }}
                  />
                  <span style={{ color: done ? "var(--ink)" : "var(--ink-2)" }}>
                    {name}
                  </span>
                  {active && <span className="t-mono-sm ink-3 ml-auto">…</span>}
                  {done && !active && (
                    <span className="t-mono-sm ml-auto" style={{ color: "var(--emerald-700)" }}>
                      done
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {s.receiptVisible && (
          <div
            className="card p-3"
            style={{
              animation: "fadeUp 400ms ease-out",
              borderColor: "var(--emerald-500)",
              background: "color-mix(in srgb, var(--emerald-500) 4%, transparent)"
            }}
          >
            <div className="flex items-baseline justify-between">
              <span className="t-caption">Attribution receipt</span>
              <span
                className="t-mono-sm"
                style={{ color: "var(--emerald-700)", fontWeight: 600 }}
              >
                0.10 USDC paid
              </span>
            </div>
            <div className="mt-2 flex flex-col gap-1 text-sm">
              {authors.slice(0, 4).map((a, i) => (
                <ReceiptRow
                  key={a.name}
                  name={a.name}
                  amt={a.amt}
                  delay={`${40 + i * 80}ms`}
                />
              ))}
            </div>
            <div className="mt-2.5 flex gap-1.5 flex-wrap">
              <span className="chip chip--success" style={{ fontSize: 10 }}>
                Kite Passport ✓
              </span>
              <span className="chip" style={{ fontSize: 10 }}>
                Mirrored on Avalanche Fuji
              </span>
            </div>
          </div>
        )}
      </div>

      {/* progress bar */}
      <div
        style={{
          height: 2,
          background: "color-mix(in srgb, var(--ink) 6%, transparent)"
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${progress * 100}%`,
            background: "var(--kite-500)",
            transition: "width 60ms linear"
          }}
        />
      </div>

      <style jsx>{`
        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

function ReceiptRow({
  name,
  amt,
  delay
}: {
  name: string;
  amt: string;
  delay: string;
}) {
  return (
    <div
      className="flex items-baseline justify-between"
      style={{ animation: `fadeUp 400ms ease-out ${delay} both` }}
    >
      <span style={{ fontFamily: "var(--font-newsreader)", fontStyle: "italic" }}>
        {name}
      </span>
      <span className="t-mono-sm" style={{ color: "var(--emerald-700)" }}>
        + {amt} USDC
      </span>
    </div>
  );
}
