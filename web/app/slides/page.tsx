"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  small?: boolean;
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
          I'm Huda. I built <strong>Kutip</strong> — an AI research agent
          that pays the humans it learns from. On-chain. Atomically. The
          moment it answers.
        </p>
        <ClipSlot
          clip={{
            src: "/clips/landing.mp4",
            label: "Landing reel",
            shot: "Auto-scroll over the live landing page.",
            duration: "kutip-zeta.vercel.app",
            small: true
          }}
        />
      </div>
    )
  },
  {
    kicker: "The problem",
    title: "Citations are everywhere. Payments — nowhere.",
    body: (
      <div className="flex flex-col gap-3 max-w-[640px] mt-1">
        <p className="t-body ink-2">
          Common Crawl — the corpus most LLMs train on — paid creators{" "}
          <strong>zero</strong>. Scholar indexes 400 million-plus papers.
          Every LLM answer rests on millions of human-authored works.
        </p>
        <p className="t-body ink-2">
          The people who fund knowledge with their careers earn{" "}
          <strong>zero of what AI extracts from it</strong>. Attribution
          exists. Payment doesn't.
        </p>
      </div>
    )
  },
  {
    kicker: "The solution",
    title: "Every citation IS a payment.",
    body: (
      <div className="flex flex-col gap-3 max-w-[640px] mt-1">
        <p className="t-body ink-2">
          Kutip flips that.{" "}
          <strong>On-chain. Atomic. The moment the citation lands.</strong>
        </p>
        <p className="t-body ink-2">
          An AI research agent that runs autonomously inside a
          cryptographic spending cap, performs paid actions via x402,
          and settles USDC to every cited author — verifiable on Kite.
        </p>
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
          <div className="deck-moat__title">Multi-agent on Kite's AA stack</div>
          <div className="deck-moat__body">
            Researcher + Summarizer — two smart accounts via{" "}
            <code>gokite-aa-sdk</code>. Sub-agent earns its own fee
            atomically. One <strong>Kite Passport</strong> EIP-712
            delegation → full autonomy within a spending cap.
          </div>
        </div>
        <div className="deck-moat">
          <div className="deck-moat__n">02</div>
          <div className="deck-moat__title">Truly gasless via Kite paymaster</div>
          <div className="deck-moat__body">
            Kite paymaster fronts gas in native KITE, pulls cost back
            in USDC <code>postOp</code> from the agent AA — same UserOp,
            atomic. User pays <strong>zero gas, any currency</strong>.
          </div>
        </div>
        <div className="deck-moat">
          <div className="deck-moat__n">03</div>
          <div className="deck-moat__title">Verifiable, not visible</div>
          <div className="deck-moat__body">
            Real <strong>x402 spec</strong> on Kite settlement. Every
            synthesis <code>keccak256</code>-digested. One endpoint
            exports the whole proof — attestation, payouts, synthesis.
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
    kicker: "Live on testnet today — already in use",
    title: "Real, deployable, not a sketch.",
    body: (
      <div className="deck-numbers">
        {/* Traction first — bukti pemakaian aktual, paling kuat untuk
            axis "Real-World Applicability". Swap two weakest static
            tiles (Safe + CI) with on-chain usage numbers. */}
        <div className="deck-number">
          <div className="deck-number__v">109</div>
          <div className="deck-number__l">author wallets paid</div>
        </div>
        <div className="deck-number">
          <div className="deck-number__v">226</div>
          <div className="deck-number__l">citations attested</div>
        </div>
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
      </div>
    )
  },
  {
    kicker: "This isn't a demo — it's infrastructure",
    title: "ORCID. Escrow. MCP.",
    body: (
      <div className="flex flex-col gap-3">
        <div
          className="deck-moats"
          style={{ gridTemplateColumns: "repeat(3, 1fr)" }}
        >
          <div className="deck-moat">
            <div className="deck-moat__n">ORCID</div>
            <div className="deck-moat__title">Real OAuth + on-chain bind</div>
            <div className="deck-moat__body">
              Authors prove identity at orcid.org, then sign EIP-712 to
              bind their wallet in NameRegistry. Future citations route
              automatically.
            </div>
          </div>
          <div className="deck-moat">
            <div className="deck-moat__n">5% APY</div>
            <div className="deck-moat__title">Yield-bearing escrow</div>
            <div className="deck-moat__body">
              Citations for un-bound authors don't get burned — they
              accrue in <code>UnclaimedYieldEscrow</code> until claimed.
              No use-it-or-lose-it.
            </div>
          </div>
          <div className="deck-moat">
            <div className="deck-moat__n">MCP</div>
            <div className="deck-moat__title">Any LLM client, natively</div>
            <div className="deck-moat__body">
              Claude Desktop, Cursor, Cline call{" "}
              <code>kutip.research</code> directly.{" "}
              <strong>External calls still pay authors on-chain.</strong>
            </div>
          </div>
        </div>
        <p className="t-small ink-3 max-w-[700px] mt-1">
          Every Kutip query — and every external MCP call —{" "}
          <strong>adds load to Kite's payment surface</strong>. Kutip
          grows Kite's transaction volume by doing what it's built to do.
        </p>
      </div>
    )
  },
  {
    kicker: "Kutip · the research agent that pays its sources",
    title: "Thank you.",
    body: (
      <div className="flex flex-col gap-4 mt-1">
        <p className="t-body ink-2 max-w-[560px]">
          Solo. Seven weeks. On Kite.
        </p>
        <ul className="deck-list">
          <li>
            <strong>Scott</strong> — happy to walk you through any
            contract internals or paymaster integration.
          </li>
          <li>
            <strong>Stephen</strong> — would love to discuss
            ORCID-Kite credentialing partnerships and ecosystem
            growth.
          </li>
        </ul>
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
  // Deep-dive slides — ORCID/Escrow/MCP got promoted to the main
  // pitch's Infrastructure slide. What's left here is everything that
  // didn't quite fit the 3-minute story but still answers a likely
  // judge question.
  {
    kicker: "Deep dive · agent identity",
    title: "Agents that own NFTs and wallets.",
    clip: {
      src: "/clips/qa-agents.mp4",
      label: "ERC-8004 + ERC-6551",
      shot: "Agents page · Researcher + Summarizer NFT cards.",
      duration: "≈ 8 s"
    },
    body: (
      <p className="t-body ink-2 max-w-[620px] mt-1">
        Each agent holds an ERC-8004 reputation NFT with a token-bound
        account (ERC-6551). Portable identity, future DAO governance —
        Kutip is one of the few real ERC-8004 deployments on testnet.
      </p>
    )
  },
  {
    kicker: "Deep dive · recursive royalties",
    title: "Other agents pay Kutip. Kutip pays authors.",
    clip: {
      src: "/clips/qa-reverse-x402.mp4",
      label: "Reverse x402",
      shot: "Verify page · paywalled summary endpoint card.",
      duration: "≈ 7 s"
    },
    body: (
      <p className="t-body ink-2 max-w-[620px] mt-1">
        When another agent cites a Kutip summary, they pay Kutip via
        x402 — and that flows back to the original authors. The loop
        closes: humans get paid forever, not just once.
      </p>
    )
  },
  {
    kicker: "Deep dive · sponsored research",
    title: "Anyone can fund a question.",
    clip: {
      src: "/clips/qa-bounties.mp4",
      label: "BountyMarket",
      shot: "Bounties page · active + settled bounties.",
      duration: "≈ 8 s"
    },
    body: (
      <p className="t-body ink-2 max-w-[620px] mt-1">
        Sponsor a topic with USDC; Kutip earns the bounty on a matching
        citation, paying it on top of the user fee. Researchers earn
        even when the asker doesn't know the paper exists.
      </p>
    )
  },
  {
    kicker: "Deep dive · cross-chain proof",
    title: "Every receipt mirrors to Avalanche Fuji.",
    clip: {
      src: "/clips/qa-mirror.mp4",
      label: "Cross-chain mirror",
      shot: "Verify page → tx hash chip · LayerZero-pattern replication.",
      duration: "≈ 7 s"
    },
    body: (
      <p className="t-body ink-2 max-w-[620px] mt-1">
        Same atomic attestation, replicated to <code>CitationMirror</code>{" "}
        on Fuji within seconds. Cross-chain proof. Swaps to DVN-attested
        the moment Kite exposes its LZ endpoint.
      </p>
    )
  }
];

const SPEEDS = [1, 1.5, 2, 3] as const;
// Default playback rate. 3× gives judges a brisk-but-readable
// fast-forward through each demo without having to touch the speed
// buttons — clips of 8-15 s become 3-5 s of visual support behind the
// narration. Override per-clip by tapping a speed pill.
const DEFAULT_SPEED = 3;

function ClipSlot({ clip }: { clip: ClipSpec }) {
  const [loaded, setLoaded] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<number>(DEFAULT_SPEED);
  const [current, setCurrent] = useState(0);
  const [total, setTotal] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  // Try .webm first (Playwright output), fall back to .mp4 (manual
  // captures). Same name with .jpg suffix is the poster — ffmpeg
  // generates it at 0.5s into the trimmed clip, killing the black
  // pre-decode flash.
  const webmSrc = clip.src.replace(/\.mp4$/, ".webm");
  const posterSrc = clip.src.replace(/\.(mp4|webm)$/, ".jpg");

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  }
  function changeSpeed(s: number) {
    const v = videoRef.current;
    if (v) v.playbackRate = s;
    setSpeed(s);
  }
  function scrub(t: number) {
    const v = videoRef.current;
    if (v && Number.isFinite(t)) {
      v.currentTime = t;
      setCurrent(t);
    }
  }

  return (
    <div className={`deck-clip${clip.small ? " deck-clip--small" : ""}`}>
      <video
        ref={videoRef}
        key={clip.src}
        poster={posterSrc}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        onLoadedData={(e) => {
          setLoaded(true);
          // playbackRate must be applied to the live element after it
          // exists — initial useState doesn't propagate to the DOM
          // node. Without this the clip starts at 1× until user
          // touches a speed pill.
          e.currentTarget.playbackRate = DEFAULT_SPEED;
        }}
        onLoadedMetadata={(e) => setTotal(e.currentTarget.duration || 0)}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      >
        <source src={webmSrc} type="video/webm" />
        <source src={clip.src} type="video/mp4" />
      </video>
      {!loaded && (
        <div className="deck-clip__placeholder">
          <div className="t-caption">{clip.label}</div>
          <div className="t-h3 mt-1">Loading — drop at {clip.src}</div>
          <div className="t-small ink-3 max-w-[540px] mt-2">{clip.shot}</div>
        </div>
      )}
      <div className="deck-clip__controls">
        <button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? "Pause" : "Play"}
          className="deck-clip__btn"
        >
          {playing ? "⏸" : "▶"}
        </button>
        <input
          type="range"
          min={0}
          max={total || 1}
          step={0.05}
          value={current}
          onChange={(e) => scrub(parseFloat(e.target.value))}
          className="deck-clip__scrub"
          aria-label="Scrub"
        />
        <div className="deck-clip__speeds">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => changeSpeed(s)}
              className="deck-clip__btn deck-clip__btn--speed"
              data-active={speed === s}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>
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
