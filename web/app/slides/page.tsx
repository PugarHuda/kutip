"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BrandMark, ArrowRightIcon } from "@/components/icons";

/**
 * /slides — finale pitch deck, 3-minute hard cap.
 *
 * Structure: 7 slides, one beat each, 3 of them carry a pre-recorded
 * clip the presenter narrates over (no live demos by Encode's rule).
 * Clip files live under `/public/clips/` — until they're recorded the
 * slot shows a placeholder with the exact shot list so the deck is
 * usable for dry-runs before footage exists.
 *
 * Keyboard: ←/→/Space to navigate, Home/End to jump.
 */

interface ClipSpec {
  src: string;
  label: string;
  shot: string;
  duration: string;
}

interface Slide {
  kicker: string;
  title: string;
  body?: React.ReactNode;
  clip?: ClipSpec;
}

const SLIDES: Slide[] = [
  {
    kicker: "Kite AI Hackathon · Novel Track",
    title: "AI cites humans. Humans get nothing.",
    body: (
      <div className="flex flex-col gap-4">
        <p className="t-body ink-2 max-w-[620px]">
          I'm Pugar. I built <strong>Kutip</strong> — an AI research agent
          that pays the humans it learns from. On-chain. Atomically. The
          moment it answers.
        </p>
        {/* Small live-product anchor — landing reel on the side so the
            hook line keeps focus while judges see this is shipped. */}
        <div className="deck-clip" style={{ maxWidth: 520 }}>
          <video autoPlay muted loop playsInline preload="metadata">
            <source src="/clips/landing.webm" type="video/webm" />
            <source src="/clips/landing.mp4" type="video/mp4" />
          </video>
          <div className="deck-clip__caption">kutip-zeta.vercel.app</div>
        </div>
      </div>
    )
  },
  {
    kicker: "What it does",
    title: "Five steps. One transaction. Real authors paid.",
    clip: {
      src: "/clips/flow.mp4",
      label: "Clip 1 · Agent flow",
      shot:
        "Type a query → click Pay → 5-step progress runs end-to-end → receipt appears.",
      duration: "≈ 15 s"
    },
    body: (
      <ul className="deck-list mt-1">
        <li>Search real papers (OpenAlex / Semantic Scholar)</li>
        <li>Pay each via a real HTTP-402 x402 handshake on Kite</li>
        <li>Synthesize with an LLM, weight every citation</li>
        <li>
          Settle <code className="t-mono-sm">attestAndSplit</code> in one
          atomic UserOp
        </li>
      </ul>
    )
  },
  {
    kicker: "Where the money goes",
    title: "80% to authors. Verifiable, not promised.",
    clip: {
      src: "/clips/payout.mp4",
      label: "Clip 2 · Payout proof",
      shot:
        "Receipt 'Authors paid' table → click tx hash → KiteScan opens, Transfer events visible.",
      duration: "≈ 12 s"
    },
    body: (
      <div className="flex flex-col gap-3">
        <div className="deck-split">
          {[
            ["80%", "Cited authors", "var(--emerald-600)"],
            ["15%", "Operator", "var(--kite-700)"],
            ["5%", "Kite ecosystem", "var(--ink-3)"]
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
        </div>
        <p className="t-small ink-3 max-w-[520px]">
          Every receipt also mirrors to Avalanche Fuji within seconds —
          cross-chain proof, same atomic settle.
        </p>
      </div>
    )
  },
  {
    kicker: "Three things you won't find anywhere else",
    title: "Unfair advantages.",
    body: (
      <div className="deck-moats">
        <div className="deck-moat">
          <div className="deck-moat__n">01</div>
          <div className="deck-moat__title">Multi-agent on EIP-4337</div>
          <div className="deck-moat__body">
            Researcher + Summarizer = two separate smart accounts. The
            Summarizer earns its own 5% sub-agent fee, atomically. One
            EIP-712 Passport delegation → full autonomy within a cap.
          </div>
        </div>
        <div className="deck-moat">
          <div className="deck-moat__n">02</div>
          <div className="deck-moat__title">Truly gasless</div>
          <div className="deck-moat__body">
            Kite paymaster fronts gas in USDC. Agent never holds KITE.
            User pays zero gas in any currency. Not "abstracted" —
            actually zero.
          </div>
        </div>
        <div className="deck-moat">
          <div className="deck-moat__n">03</div>
          <div className="deck-moat__title">Verifiable, not just visible</div>
          <div className="deck-moat__body">
            Every synthesis is <code>keccak256</code>-digested and
            persisted. One endpoint exports a portable JSON proof — the
            attestation, the payouts, and the synthesis text together.
          </div>
        </div>
      </div>
    )
  },
  {
    kicker: "Anyone can audit",
    title: "Every summary hashed. Every payout exportable.",
    clip: {
      src: "/clips/verify.mp4",
      label: "Clip 3 · Verify & history",
      shot:
        "/dashboard/history list → click a row → /verify page → 'Summary digest · keccak256' → Download JSON button.",
      duration: "≈ 12 s"
    },
    body: (
      <p className="t-body ink-2 max-w-[620px] mt-1">
        Recompute the keccak256 from the synthesis text — any edit shows
        up as a mismatch. The full receipt JSON ships in one click.
      </p>
    )
  },
  {
    kicker: "Live on testnet today",
    title: "Real, deployable, not a sketch.",
    body: (
      <div className="deck-numbers">
        <div className="deck-number">
          <div className="deck-number__v">12</div>
          <div className="deck-number__l">Solidity contracts</div>
        </div>
        <div className="deck-number">
          <div className="deck-number__v">2</div>
          <div className="deck-number__l">chains (Kite + Fuji)</div>
        </div>
        <div className="deck-number">
          <div className="deck-number__v">56</div>
          <div className="deck-number__l">Foundry tests + fuzz</div>
        </div>
        <div className="deck-number">
          <div className="deck-number__v">149</div>
          <div className="deck-number__l">Vitest cases</div>
        </div>
        <div className="deck-number">
          <div className="deck-number__v">80 / 15 / 5</div>
          <div className="deck-number__l">on-chain split</div>
        </div>
        <div className="deck-number">
          <div className="deck-number__v">ORCID</div>
          <div className="deck-number__l">real OAuth + binding</div>
        </div>
        <div className="deck-number">
          <div className="deck-number__v">Safe</div>
          <div className="deck-number__l">2-of-3 governance</div>
        </div>
        <div className="deck-number">
          <div className="deck-number__v">CI</div>
          <div className="deck-number__l">green on every push</div>
        </div>
      </div>
    )
  },
  {
    kicker: "Kutip",
    title: "The research agent that pays its sources.",
    body: (
      <div className="flex flex-col gap-3">
        <p className="t-body ink-2 max-w-[560px]">
          AI agents will only grow. The question is whether they extract
          from humans or pay them. Kutip shows the second model is real
          — and live today.
        </p>
        <div className="flex flex-wrap gap-2.5 mt-1">
          <Link href="/research" className="btn btn--primary">
            kutip-zeta.vercel.app <ArrowRightIcon size={14} />
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
  },
  // Backup slide — NOT part of the 3-minute pitch. Kept here so the
  // presenter can press `End` to jump to it during Q&A and answer
  // "but does it also do X?" without scrambling between tabs. Each
  // card has its own silent looping clip; visual support pre-loaded.
  {
    kicker: "Backup · Q&A only",
    title: "Everything else Kutip does.",
    body: (
      <div className="deck-moats">
        <BackupCard
          tag="Fuji mirror"
          src="/clips/qa-mirror.webm"
          title="Cross-chain receipt"
          body={
            <>
              Every Kite attestation replicates to{" "}
              <code>CitationMirror</code> on Avalanche Fuji within
              seconds. LayerZero-pattern.
            </>
          }
        />
        <BackupCard
          tag="ERC-8004 + 6551"
          src="/clips/qa-agents.webm"
          title="Agents with NFT identities"
          body={
            <>
              Each agent holds a reputation NFT (ERC-721) with a
              token-bound account (ERC-6551). Portable identity.
            </>
          }
        />
        <BackupCard
          tag="Reverse x402"
          src="/clips/qa-reverse-x402.webm"
          title="Agents pay Kutip back"
          body={
            <>
              Other agents pay Kutip via x402 to cite a persisted
              summary — that flows back to the original authors.
            </>
          }
        />
        <BackupCard
          tag="Escrow + yield"
          src="/clips/qa-escrow.webm"
          title="Unclaimed shares earn"
          body={
            <>
              Citations to un-bound authors accrue in{" "}
              <code>UnclaimedYieldEscrow</code> at a 5% APY target
              until ORCID is verified.
            </>
          }
        />
        <BackupCard
          tag="BountyMarket"
          src="/clips/qa-bounties.webm"
          title="Sponsored research"
          body={
            <>
              Anyone funds a bounty for a topic; Kutip earns it on a
              matching citation — extra payout on top of the user fee.
            </>
          }
        />
        <BackupCard
          tag="MCP server"
          src="/clips/qa-mcp.webm"
          title="Drop-in for any LLM client"
          body={
            <>
              <code>kutip.research</code>, <code>kutip.summary</code>,{" "}
              <code>kutip.authors</code> — Claude Desktop / Cursor /
              Cline call Kutip natively.
            </>
          }
        />
      </div>
    )
  }
];

function BackupCard({
  tag,
  src,
  title,
  body
}: {
  tag: string;
  src: string;
  title: string;
  body: React.ReactNode;
}) {
  return (
    <div className="deck-moat">
      <div className="deck-moat__clip">
        <video autoPlay muted loop playsInline preload="metadata">
          <source src={src} type="video/webm" />
          <source src={src.replace(/\.webm$/, ".mp4")} type="video/mp4" />
        </video>
        <div className="deck-moat__clip-tag">{tag}</div>
      </div>
      <div className="deck-moat__title">{title}</div>
      <div className="deck-moat__body">{body}</div>
    </div>
  );
}

function ClipSlot({ clip }: { clip: ClipSpec }) {
  const [loaded, setLoaded] = useState(false);
  // Try .webm first (what Playwright recordings produce), fall back to
  // .mp4 (what manual Win+G recordings produce). Browser picks the
  // first source it can load; the placeholder stays visible if neither
  // file exists yet.
  const webmSrc = clip.src.replace(/\.mp4$/, ".webm");
  return (
    <div className="deck-clip">
      <video
        key={clip.src}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        onLoadedData={() => setLoaded(true)}
      >
        <source src={webmSrc} type="video/webm" />
        <source src={clip.src} type="video/mp4" />
      </video>
      {!loaded && (
        <div className="deck-clip__placeholder">
          <div className="t-caption">{clip.label}</div>
          <div className="t-h3 mt-1">Record this clip — drop at {clip.src}</div>
          <div className="t-small ink-3 max-w-[540px] mt-2">{clip.shot}</div>
        </div>
      )}
      <div className="deck-clip__caption">{clip.duration}</div>
    </div>
  );
}

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
        <div className="deck__body">
          {slide.clip && <ClipSlot clip={slide.clip} />}
          {slide.body}
        </div>
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
        ← → or Space to navigate · drop clips at /public/clips/
      </div>
    </main>
  );
}
