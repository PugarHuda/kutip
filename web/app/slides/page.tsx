"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BrandMark, ArrowRightIcon } from "@/components/icons";

/**
 * /slides — a self-contained pitch deck for judges. Keyboard (←/→/Space),
 * on-screen controls, and dot navigation. Each slide is one viewport.
 * Content mirrors docs/submission-copy.md so the story stays in sync.
 */

interface Slide {
  kicker: string;
  title: string;
  body: React.ReactNode;
}

const LEDGER = "0xbC4eeC2f75a0DCf61509842e1c18Abff7236A338";

const SLIDES: Slide[] = [
  {
    kicker: "Kite AI Global Hackathon 2026 · Novel track",
    title: "Kutip — the research agent that pays its sources.",
    body: (
      <p className="t-body ink-2 max-w-[560px]">
        An autonomous AI research agent that attests every citation on-chain
        and splits USDT back to the cited authors, in real time, on the first
        AI-payments blockchain. <em>Kutip</em> (koo-teep) is Indonesian for{" "}
        <em>cite</em>.
      </p>
    )
  },
  {
    kicker: "The problem",
    title: "AI reads humanity's research and pays the authors nothing.",
    body: (
      <ul className="deck-list">
        <li>Every LLM answer stands on millions of uncredited papers.</li>
        <li>Citations are invisible — no link from &ldquo;used&rdquo; to &ldquo;paid&rdquo;.</li>
        <li>
          Authors fund the knowledge AI monetises and capture none of it.
        </li>
      </ul>
    )
  },
  {
    kicker: "The solution",
    title: "Turn the act of citing into a payment rail.",
    body: (
      <p className="t-body ink-2 max-w-[560px]">
        Ask Kutip a research question. It pays for source papers via x402,
        reads them with an LLM, then submits one on-chain attestation that
        splits the query fee across every cited author — verifiable, atomic,
        fail-closed. No citation, no payment; no payment, no answer.
      </p>
    )
  },
  {
    kicker: "How it works",
    title: "Five steps, one transaction.",
    body: (
      <div className="deck-steps">
        {[
          ["Search", "Discover real papers (OpenAlex / Semantic Scholar)"],
          ["Purchase", "Settle per-paper access via the x402 spec"],
          ["Read", "LLM synthesises an answer, ranks citation weights"],
          ["Attribute", "Build the per-author citation ledger"],
          ["Settle", "attestAndSplit() on Kite — pays authors atomically"]
        ].map(([t, d], i) => (
          <div key={t} className="deck-step">
            <span className="deck-step__n">{i + 1}</span>
            <div>
              <div className="font-semibold">{t}</div>
              <div className="t-small ink-3">{d}</div>
            </div>
          </div>
        ))}
      </div>
    )
  },
  {
    kicker: "The economics",
    title: "Authors-majority by design — 80 / 15 / 5.",
    body: (
      <div className="deck-split">
        {[
          ["80%", "Cited authors", "var(--emerald-600)"],
          ["15%", "Operator (sustains the agent)", "var(--kite-700)"],
          ["5%", "Kite ecosystem fund", "var(--ink-3)"]
        ].map(([pct, label, color]) => (
          <div key={label} className="deck-split__row">
            <span
              className="deck-split__pct"
              style={{ color: color as string }}
            >
              {pct}
            </span>
            <span className="t-body">{label}</span>
          </div>
        ))}
        <p className="t-small ink-3 mt-2">
          Baked immutably into AttributionLedger. The pitch and the contract
          agree: the humans take the largest cut.
        </p>
      </div>
    )
  },
  {
    kicker: "Built on Kite",
    title: "A real agent, with a real wallet, paying real money.",
    body: (
      <ul className="deck-list">
        <li>
          <strong>EIP-4337 smart account</strong> — the agent has its own
          on-chain identity (Researcher AA) and sub-agent (Summarizer AA).
        </li>
        <li>
          <strong>x402 payments</strong> — pay-per-paper settlement via the
          Pieverse facilitator.
        </li>
        <li>
          <strong>Kite Passport</strong> — the user signs one EIP-712
          delegation; spending is capped per-query and per-day.
        </li>
        <li>
          <strong>Gasless</strong> — paymaster sponsors gas; the user never
          signs a transaction and never holds a KITE token.
        </li>
      </ul>
    )
  },
  {
    kicker: "Not a mock",
    title: "Every number on this site is on-chain.",
    body: (
      <ul className="deck-list">
        <li>
          AttributionLedger live on Kite testnet —{" "}
          <span className="t-mono-sm">{LEDGER}</span>
        </li>
        <li>109 real author wallets · 32 example papers attested on-chain.</li>
        <li>
          Every receipt mirrored to Avalanche Fuji (LayerZero-pattern) for
          portable proof.
        </li>
        <li>
          55 Foundry tests · 144 Vitest tests · CI coverage gates on the
          financial modules.
        </li>
      </ul>
    )
  },
  {
    kicker: "Infrastructure, not just an app",
    title: "Any agent can cite-and-pay through Kutip.",
    body: (
      <p className="t-body ink-2 max-w-[560px]">
        Kutip ships an MCP server and a public REST endpoint. Drop it into
        Claude Desktop, an autonomous agent, or a backend — call one tool,
        and cited authors get paid on-chain. Kutip is a payment rail for
        human knowledge that other builders plug into.
      </p>
    )
  },
  {
    kicker: "Try it",
    title: "Ask a question. Pay the humans you learn from.",
    body: (
      <div className="flex flex-col gap-3">
        <p className="t-body ink-2 max-w-[520px]">
          The live agent, the contracts, and the docs are all open.
        </p>
        <div className="flex flex-wrap gap-2.5">
          <Link href="/research" className="btn btn--primary">
            Run the agent <ArrowRightIcon size={14} />
          </Link>
          <Link href="/docs" className="btn btn--ghost">
            Read the docs
          </Link>
          <a
            href="https://github.com/PugarHuda/kutip"
            target="_blank"
            rel="noreferrer"
            className="btn btn--ghost"
          >
            GitHub ↗
          </a>
        </div>
      </div>
    )
  }
];

export default function SlidesPage() {
  const [i, setI] = useState(0);
  const total = SLIDES.length;

  const go = useCallback(
    (delta: number) => setI((p) => Math.min(total - 1, Math.max(0, p + delta))),
    [total]
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        go(1);
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        go(-1);
      } else if (e.key === "Home") setI(0);
      else if (e.key === "End") setI(total - 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, total]);

  const slide = SLIDES[i];

  return (
    <main className="deck">
      <div className="deck__top">
        <Link href="/" className="flex items-center gap-2 no-underline text-inherit">
          <BrandMark size={20} />
          <span className="font-display text-[16px] font-bold">Kutip</span>
        </Link>
        <span className="t-mono-sm ink-3">
          {String(i + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
        </span>
      </div>

      <section key={i} className="deck__slide animate-fade-up">
        <div className="deck__kicker">{slide.kicker}</div>
        <h1 className="deck__title">{slide.title}</h1>
        <div className="deck__body">{slide.body}</div>
      </section>

      <div className="deck__nav">
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => go(-1)}
          disabled={i === 0}
        >
          ← Prev
        </button>
        <div className="deck__dots">
          {SLIDES.map((_, idx) => (
            <button
              key={idx}
              type="button"
              aria-label={`Go to slide ${idx + 1}`}
              onClick={() => setI(idx)}
              className="deck__dot"
              data-active={idx === i}
            />
          ))}
        </div>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => go(1)}
          disabled={i === total - 1}
        >
          Next →
        </button>
      </div>

      <div className="t-mono-sm ink-3 deck__hint">
        ← → or Space to navigate
      </div>
    </main>
  );
}
