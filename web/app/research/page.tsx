"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import type { AgentEvent, AgentStep, ResearchResult } from "@/lib/types";
import { ArrowRightIcon, CheckIcon, ChevronDownIcon, SearchIcon } from "@/components/icons";
import { Cite, PayoutRow } from "@/components/ui";
import {
  SessionManager,
  updateLocalSpent,
  type SessionEnvelope
} from "@/components/session-manager";
import { useAccount } from "wagmi";

interface WalletBalance {
  address: string;
  balance: string | null;
  label: string;
}

interface BalancesResponse {
  eoa: WalletBalance | null;
  researcher: WalletBalance | null;
  summarizer: WalletBalance | null;
  escrow: WalletBalance | null;
}

function formatBalance(raw: string | null | undefined): string {
  if (!raw) return "—";
  const v = BigInt(raw);
  const whole = v / 10n ** 18n;
  const frac = v % 10n ** 18n;
  return `${whole}.${frac.toString().padStart(18, "0").slice(0, 2)}`;
}

function useBalances() {
  const [data, setData] = useState<BalancesResponse | null>(null);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/balances", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as BalancesResponse;
        if (!cancelled) setData(json);
      } catch {}
    }
    load();
    const t = setInterval(load, 30000); // refresh every 30s
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);
  return data;
}

const SUGGESTIONS = [
  "Top carbon capture methods in 2024",
  "Latest progress on direct air capture cost reduction",
  "Compare mineralization vs biochar for long-term storage"
];

const STEP_OUTLINE = [
  ["Search", "Paper catalog retrieval"],
  ["Purchase", "x402 per-paper settlement"],
  ["Read", "LLM synthesis & citations"],
  ["Attribute", "Build citation ledger"],
  ["Settle", "Submit attestation on-chain"]
];

const KITESCAN_TX = "https://testnet.kitescan.ai/tx/";
const KITESCAN_ADDR = "https://testnet.kitescan.ai/address/";

type Phase = "idle" | "running" | "result";

export default function ResearchPage() {
  const [query, setQuery] = useState("");
  const [budget, setBudget] = useState(0.1);
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [expandLog, setExpandLog] = useState(false);
  const [session, setSession] = useState<SessionEnvelope | null>(null);
  const onSessionChange = useCallback((s: SessionEnvelope | null) => setSession(s), []);
  const { address } = useAccount();

  const phase: Phase = result ? "result" : running ? "running" : "idle";

  async function runQuery() {
    const q = query.trim();
    if (!q || running) return;
    setSteps([]);
    setResult(null);
    setError(null);
    setRunning(true);

    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: q,
          budgetUSDC: budget,
          session: session
            ? {
                intent: session.intent,
                signature: session.signature,
                spentToday: session.spentToday
              }
            : undefined
        })
      });
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const messages = buffer.split("\n\n");
        buffer = messages.pop() ?? "";

        for (const msg of messages) {
          if (!msg.startsWith("data: ")) continue;
          const event = JSON.parse(msg.slice(6)) as AgentEvent;
          handleEvent(event);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown");
    } finally {
      setRunning(false);
    }
  }

  function handleEvent(event: AgentEvent) {
    if (event.type === "step") {
      setSteps((prev) => {
        const existing = prev.findIndex((s) => s.step === event.step.step);
        if (existing >= 0) {
          const copy = [...prev];
          copy[existing] = event.step;
          return copy;
        }
        return [...prev, event.step];
      });
    } else if (event.type === "result") {
      setResult(event.result);
      if (address && event.result.sessionNewSpentToday) {
        updateLocalSpent(address, event.result.sessionNewSpentToday);
      }
    } else {
      setError(event.message);
    }
  }

  return (
    <main className="min-h-[calc(100vh-60px)] grid grid-cols-1 lg:grid-cols-[420px_1fr]">
      <ResearchSidebar
        phase={phase}
        query={query}
        setQuery={setQuery}
        budget={budget}
        setBudget={setBudget}
        onSubmit={runQuery}
        disabled={running || query.trim().length < 5}
        steps={steps}
        onSessionChange={onSessionChange}
      />
      <div className="px-6 lg:px-8 py-8 lg:py-10 lg:border-l border-token">
        {phase === "idle" && !error && <IdleView setQuery={setQuery} />}
        {phase === "running" && <RunningView steps={steps} />}
        {phase === "result" && result && (
          <ResultView result={result} steps={steps} expandLog={expandLog} setExpandLog={setExpandLog} />
        )}
        {error && (
          <div className="card p-5 bg-rose-50 border-rose-500 text-rose-700 text-sm">
            <strong>Error:</strong> {error}
          </div>
        )}
      </div>
    </main>
  );
}

const BUDGET_PRESETS = [0.1, 0.5, 1, 2] as const;

function ResearchSidebar({
  phase,
  query,
  setQuery,
  budget,
  setBudget,
  onSubmit,
  disabled,
  steps,
  onSessionChange
}: {
  phase: Phase;
  query: string;
  setQuery: (q: string) => void;
  budget: number;
  setBudget: (b: number) => void;
  onSubmit: () => void;
  disabled: boolean;
  steps: AgentStep[];
  onSessionChange: (s: SessionEnvelope | null) => void;
}) {
  const balances = useBalances();
  const researcherBal = balances?.researcher?.balance
    ? BigInt(balances.researcher.balance)
    : null;
  const requiredRaw = BigInt(Math.round(budget * 100)) * 10n ** 16n;
  const subAgentFee = requiredRaw / 20n; // 5%
  const requiredTotal = requiredRaw + subAgentFee;
  const insufficient = researcherBal !== null && researcherBal < requiredTotal;

  const isPreset = (BUDGET_PRESETS as readonly number[]).includes(budget);
  const [customMode, setCustomMode] = useState(!isPreset);
  const [customInput, setCustomInput] = useState(isPreset ? "" : String(budget));

  function applyCustom(value: string) {
    setCustomInput(value);
    const normalized = value.replace(",", ".");
    const n = parseFloat(normalized);
    if (!Number.isNaN(n) && n >= 0.1 && n <= 20) {
      setBudget(Math.round(n * 100) / 100);
    }
  }

  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (phase !== "running") {
      setElapsed(0);
      return;
    }
    const start = Date.now();
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 250);
    return () => clearInterval(t);
  }, [phase]);

  const runningStep = steps.find((s) => s.status === "running");
  const doneCount = steps.filter((s) => s.status === "done").length;
  const progressPct = Math.min(100, Math.round((doneCount / 5) * 100));

  return (
    <aside className="p-6 lg:p-7 lg:sticky lg:top-0 self-start">
      <div className="t-caption">Your question</div>
      <textarea
        className="card mt-2 p-3.5 min-h-[100px] w-full text-[15px] leading-[22px] resize-none bg-transparent focus:outline-none focus:border-kite-500 transition-colors"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="e.g., What are the top carbon capture methods in 2024?"
        maxLength={500}
        rows={3}
      />
      <div className="flex justify-end mt-1">
        <span className="t-mono-sm ink-3">{query.length} / 500</span>
      </div>

      {phase === "idle" && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              className="chip chip--mono cursor-pointer"
              style={{
                border: "1px solid var(--border)",
                background: "var(--surface-raised)"
              }}
              onClick={() => setQuery(s)}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="t-caption mt-6">Budget</div>
      <div className="flex gap-1.5 mt-2">
        {BUDGET_PRESETS.map((v) => {
          const selected = !customMode && budget === v;
          return (
            <button
              key={v}
              type="button"
              onClick={() => {
                setBudget(v);
                setCustomMode(false);
                setCustomInput("");
              }}
              className="flex-1 h-10 rounded-lg font-mono text-[13px] font-semibold transition-colors"
              style={
                selected
                  ? {
                      border: "1px solid var(--kite-500)",
                      background: "var(--kite-500)",
                      color: "#fff"
                    }
                  : {
                      border: "1px solid var(--border)",
                      background: "var(--surface)",
                      color: "var(--ink)"
                    }
              }
            >
              {v}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => {
            setCustomMode(true);
            if (!customInput) setCustomInput(String(budget));
          }}
          className="flex-1 h-10 rounded-lg text-[12px] font-semibold transition-colors"
          style={
            customMode
              ? {
                  border: "1px solid var(--kite-500)",
                  background: "var(--kite-500)",
                  color: "#fff"
                }
              : {
                  border: "1px solid var(--border)",
                  background: "var(--surface)",
                  color: "var(--ink)"
                }
          }
        >
          Custom
        </button>
      </div>
      {customMode && (
        <div className="mt-2 flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.1"
              max="20"
              value={customInput}
              onChange={(e) => applyCustom(e.target.value)}
              placeholder="0.10"
              className="card w-full h-10 px-3 pr-14 font-mono text-[13px] font-semibold bg-transparent focus:outline-none focus:border-kite-500 transition-colors"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 t-mono-sm ink-3 pointer-events-none">
              USDC
            </span>
          </div>
        </div>
      )}
      <div className="t-small ink-3 mt-2">
        {customMode
          ? "Between 0.10 and 20 USDC · paid by agent smart account"
          : "USDC · paid by agent smart account"}
      </div>

      <button
        type="button"
        className="btn btn--primary btn--lg w-full mt-5 justify-center"
        disabled={disabled || ((phase === "idle" || phase === "result") && insufficient)}
        onClick={onSubmit}
      >
        {phase === "idle" && insufficient && <>Insufficient balance</>}
        {phase === "idle" && !insufficient && (
          <>
            Pay {budget} USDC &amp; research <ArrowRightIcon />
          </>
        )}
        {phase === "running" && (
          <>
            Paying
            <DotPulse />
          </>
        )}
        {phase === "result" && !insufficient && (
          <>
            Ask a follow-up <ArrowRightIcon />
          </>
        )}
        {phase === "result" && insufficient && <>Insufficient balance</>}
      </button>

      {phase === "idle" && !query.trim() && (
        <div className="t-small ink-3 mt-2 text-center">
          Type a question above to continue →
        </div>
      )}
      {phase === "idle" && query.trim() && query.trim().length < 5 && (
        <div className="t-small text-rose-500 mt-2 text-center">
          Question must be at least 5 characters
        </div>
      )}

      {phase === "running" && (
        <div className="mt-3 p-3.5 rounded-[10px] border border-kite-500 animate-fade-up"
          style={{
            background: "color-mix(in srgb, var(--kite-500) 6%, transparent)"
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="status-dot status-dot--running animate-pulse-dot" style={{ width: 8, height: 8 }} />
              <span className="t-caption text-kite-700">
                Processing · step {Math.min(doneCount + 1, 5)} of 5
              </span>
            </div>
            <span className="t-mono-sm ink-3">{elapsed}s</span>
          </div>
          <div className="t-small font-semibold">
            {runningStep?.label ?? (doneCount === 5 ? "Finalizing" : "Starting…")}
          </div>
          {runningStep?.detail && (
            <div className="t-small ink-3 mt-0.5">{runningStep.detail}</div>
          )}
          <div
            className="mt-2.5 h-1 rounded-full overflow-hidden"
            style={{ background: "color-mix(in srgb, var(--kite-500) 15%, transparent)" }}
          >
            <div
              className="h-full bg-kite-500 transition-all duration-500 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="t-mono-sm ink-3 mt-1.5">
            Paying {budget} USDC · attestation fail-closed
          </div>
        </div>
      )}

      <div className="mt-5 p-3.5 surface-raised border border-token rounded-[10px]">
        <div className="flex justify-between items-center mb-2">
          <span className="t-caption">Agent wallets</span>
          {insufficient ? (
            <span
              className="status-dot status-dot--error"
              style={{ width: 8, height: 8 }}
              title="Insufficient balance"
            />
          ) : (
            <span className="status-dot status-dot--done" style={{ width: 8, height: 8 }} />
          )}
        </div>
        {balances?.researcher && (
          <div className="flex justify-between items-baseline">
            <span className="t-small ink-3">Researcher AA</span>
            <span
              className={`t-mono-sm font-semibold ${
                insufficient ? "text-rose-500" : ""
              }`}
            >
              {formatBalance(balances.researcher.balance)} USDC
            </span>
          </div>
        )}
        {balances?.summarizer && (
          <div className="flex justify-between items-baseline mt-1">
            <span className="t-small ink-3">Summarizer AA</span>
            <span className="t-mono-sm ink-2">
              {formatBalance(balances.summarizer.balance)}
            </span>
          </div>
        )}
        {insufficient && (
          <div className="mt-2.5 pt-2.5 border-t border-token">
            <div className="t-small text-rose-500 font-medium">
              Short by{" "}
              {formatBalance(
                (requiredTotal - (researcherBal ?? 0n)).toString()
              )}{" "}
              USDC
            </div>
            <div className="t-mono-sm ink-3 mt-1">
              Top up Researcher AA via MetaMask
            </div>
          </div>
        )}
      </div>

      <SessionManager onSessionChange={onSessionChange} />

      <div className="t-small ink-3 mt-4 pt-4 border-t border-token">
        Your USDC splits to authors only if citations land. Attestation is fail-closed.
      </div>
    </aside>
  );
}

function DotPulse() {
  return (
    <span className="inline-flex gap-1 ml-1">
      <span className="w-1 h-1 rounded-full bg-current animate-breathe" />
      <span
        className="w-1 h-1 rounded-full bg-current animate-breathe"
        style={{ animationDelay: "0.15s" }}
      />
      <span
        className="w-1 h-1 rounded-full bg-current animate-breathe"
        style={{ animationDelay: "0.3s" }}
      />
    </span>
  );
}

function IdleView({ setQuery }: { setQuery: (q: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[640px] text-center">
      <div className="w-14 h-14 rounded-2xl bg-kite-100 text-kite-500 flex items-center justify-center mb-5">
        <SearchIcon size={24} />
      </div>
      <h2 className="t-h2 max-w-[420px] m-0">Ask a question. Pay the authors you learn from.</h2>
      <p className="t-body ink-2 max-w-[440px] mt-2.5">
        Type your question on the left and set a USDC budget. We&apos;ll show the agent&apos;s work,
        live, and hand you a cryptographic receipt at the end.
      </p>
      <button
        type="button"
        className="btn btn--primary mt-5"
        onClick={() => setQuery("What are the top carbon capture methods in 2024?")}
      >
        Try the sample query <ArrowRightIcon />
      </button>

      <div className="mt-12 w-full max-w-[560px]">
        <div className="t-caption mb-3">How a query runs</div>
        <div className="grid grid-cols-5 gap-2">
          {STEP_OUTLINE.map(([label], i) => (
            <div
              key={label}
              className="p-3 rounded-lg text-left surface-raised border border-token"
            >
              <div className="t-mono-sm ink-3">{String(i + 1).padStart(2, "0")}</div>
              <div className="t-small font-semibold mt-1">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RunningView({ steps }: { steps: AgentStep[] }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, []);

  const [timings, setTimings] = useState<
    Record<number, { startedAt: number; endedAt?: number }>
  >({});
  useEffect(() => {
    setTimings((prev) => {
      const next = { ...prev };
      for (const s of steps) {
        const existing = next[s.step];
        if (s.status === "running" && !existing) {
          next[s.step] = { startedAt: Date.now() };
        } else if (s.status === "done" && existing && !existing.endedAt) {
          next[s.step] = { ...existing, endedAt: Date.now() };
        }
      }
      return next;
    });
  }, [steps]);

  const currentIdx = steps.findIndex((s) => s.status === "running");
  const doneCount = steps.filter((s) => s.status === "done").length;
  const progressPct = Math.round((doneCount / 5) * 100);

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <div className="t-caption flex items-center gap-2">
            <span
              className="inline-block rounded-full bg-kite-500 animate-pulse-dot"
              style={{ width: 8, height: 8 }}
            />
            Agent log · live
          </div>
          <h2 className="t-h2 mt-1 mb-0">Researching…</h2>
        </div>
        <span className="chip chip--pending">
          {doneCount} / 5 steps
        </span>
      </div>

      <div
        className="h-1 rounded-full overflow-hidden mb-4"
        style={{ background: "color-mix(in srgb, var(--kite-500) 15%, transparent)" }}
      >
        <div
          className="h-full bg-kite-500 transition-all duration-500 ease-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="card p-0 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => {
          const stepNum = i + 1;
          const s = steps.find((st) => st.step === stepNum);
          const optimisticRunning = steps.length === 0 && i === 0;
          const state: AgentStep["status"] =
            s?.status ?? (optimisticRunning ? "running" : "pending");
          const isRunning = state === "running";
          const isDone = state === "done";
          const isPending = state === "pending";
          const isNextPending = isPending && currentIdx === i - 1;
          const label = s?.label ?? STEP_OUTLINE[i]?.[0] ?? `Step ${stepNum}`;
          const detail = s?.detail ?? STEP_OUTLINE[i]?.[1] ?? "";

          const t = timings[stepNum];
          let timeText = "";
          if (isRunning && t) {
            const elapsed = (now - t.startedAt) / 1000;
            timeText = `${elapsed.toFixed(1)}s`;
          } else if (isDone && t && t.endedAt) {
            const dur = (t.endedAt - t.startedAt) / 1000;
            timeText = `${dur.toFixed(1)}s`;
          } else if (isNextPending) {
            timeText = "next";
          } else if (isPending) {
            timeText = "queued";
          }

          return (
            <div
              key={i}
              className="relative grid items-center gap-3.5 py-4 px-5 border-b border-token last:border-b-0 transition-all duration-300"
              style={{
                gridTemplateColumns: "44px 1fr 80px",
                borderLeft: isRunning
                  ? "3px solid var(--kite-500)"
                  : isDone
                  ? "3px solid var(--emerald-500, #10b981)"
                  : "3px solid transparent",
                background: isRunning
                  ? "color-mix(in srgb, var(--kite-500) 8%, transparent)"
                  : "transparent",
                opacity: isPending && !isNextPending ? 0.4 : 1
              }}
            >
              {isRunning && (
                <div
                  className="absolute top-0 left-0 h-[2px] animate-shimmer"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent, var(--kite-500), transparent)",
                    width: "40%"
                  }}
                />
              )}
              <div className="flex justify-center">
                <StepIcon state={state} n={stepNum} />
              </div>
              <div>
                <div
                  className="t-h3 text-[16px] font-semibold"
                  style={
                    isRunning
                      ? { color: "var(--kite-700, var(--kite-500))" }
                      : undefined
                  }
                >
                  {label}
                </div>
                <div className="t-small ink-2 mt-0.5">{detail}</div>
                {isRunning && (
                  <StepTicker
                    messages={STEP_THEMES[i]?.tickerMessages ?? []}
                    elapsedMs={t ? now - t.startedAt : 0}
                  />
                )}
              </div>
              <div
                className="t-mono-sm text-right font-semibold"
                style={{
                  color: isRunning
                    ? "var(--kite-500)"
                    : isDone
                    ? "var(--emerald-600, #059669)"
                    : isNextPending
                    ? "var(--ink-2)"
                    : "var(--ink-4)"
                }}
              >
                {timeText}
              </div>
            </div>
          );
        })}
      </div>

      <div className="t-small ink-3 mt-3.5">
        Log is kept after completion — it&apos;s evidence, not chrome.
      </div>
    </div>
  );
}

function StepTicker({
  messages,
  elapsedMs
}: {
  messages: string[];
  elapsedMs: number;
}) {
  if (messages.length === 0) return null;
  const idx = Math.min(
    messages.length - 1,
    Math.floor(elapsedMs / 1800)
  );
  return (
    <div className="t-mono-sm mt-1.5 flex items-center gap-1.5 text-kite-700 font-medium animate-fade-up" key={idx}>
      <span className="inline-flex gap-0.5">
        <span className="w-1 h-1 rounded-full bg-current animate-breathe" />
        <span className="w-1 h-1 rounded-full bg-current animate-breathe" style={{ animationDelay: "0.15s" }} />
        <span className="w-1 h-1 rounded-full bg-current animate-breathe" style={{ animationDelay: "0.3s" }} />
      </span>
      <span>{messages[idx]}</span>
    </div>
  );
}

const STEP_THEMES: {
  ringGradient: string;
  runningIcon: (props: { size?: number }) => JSX.Element;
  tickerMessages: string[];
}[] = [
  {
    ringGradient: "conic-gradient(from 0deg, #6366f1, #a855f7, #6366f1)",
    runningIcon: ({ size = 15 }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-pulse-dot">
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.3-4.3" />
      </svg>
    ),
    tickerMessages: [
      "Searching Semantic Scholar",
      "Ranking relevance",
      "Filtering catalog"
    ]
  },
  {
    ringGradient: "conic-gradient(from 0deg, #10b981, #34d399, #10b981)",
    runningIcon: ({ size = 15 }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-breathe">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v8M9 11h6M9 13h6" />
      </svg>
    ),
    tickerMessages: [
      "Requesting x402 receipts",
      "Settling per-paper",
      "Confirming payment"
    ]
  },
  {
    ringGradient: "conic-gradient(from 0deg, #f59e0b, #fbbf24, #f59e0b)",
    runningIcon: ({ size = 15 }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-breathe">
        <path d="M12 2a5 5 0 0 1 5 5c0 3-2 3-2 7h-6c0-4-2-4-2-7a5 5 0 0 1 5-5Z" />
        <path d="M10 17h4M11 21h2" />
      </svg>
    ),
    tickerMessages: [
      "Reading papers",
      "Extracting citations",
      "Drafting summary"
    ]
  },
  {
    ringGradient: "conic-gradient(from 0deg, #ec4899, #f472b6, #ec4899)",
    runningIcon: ({ size = 15 }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-pulse-dot">
        <path d="M9 17H7a5 5 0 0 1 0-10h2M15 7h2a5 5 0 0 1 0 10h-2M8 12h8" />
      </svg>
    ),
    tickerMessages: [
      "Normalizing weights",
      "Resolving ORCID bindings",
      "Routing to escrow"
    ]
  },
  {
    ringGradient: "conic-gradient(from 0deg, #06b6d4, #22d3ee, #06b6d4)",
    runningIcon: ({ size = 15 }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-breathe">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M8 12h8M8 8h8M8 16h4" />
      </svg>
    ),
    tickerMessages: [
      "Approving paymaster",
      "Signing UserOp",
      "Submitting to bundler",
      "Waiting for tx inclusion"
    ]
  }
];

function StepIcon({ state, n }: { state: AgentStep["status"]; n: number }) {
  if (state === "done") {
    return (
      <div className="w-7 h-7 rounded-full flex items-center justify-center bg-emerald-50 text-emerald-700">
        <CheckIcon size={15} />
      </div>
    );
  }
  if (state === "running") {
    const theme = STEP_THEMES[n - 1];
    return (
      <div className="relative w-8 h-8">
        <div
          className="absolute inset-0 rounded-full animate-spin-slow"
          style={{ background: theme.ringGradient }}
        />
        <div className="absolute inset-[2px] rounded-full bg-kite-500 flex items-center justify-center text-white">
          <theme.runningIcon size={14} />
        </div>
      </div>
    );
  }
  if (state === "error") {
    return (
      <div className="w-7 h-7 rounded-full flex items-center justify-center bg-rose-50 text-rose-700">
        <span className="t-mono-sm font-bold">×</span>
      </div>
    );
  }
  return (
    <div
      className="w-7 h-7 rounded-full flex items-center justify-center"
      style={{ border: "1.5px solid var(--border-strong)" }}
    >
      <span className="t-mono-sm ink-3">{n}</span>
    </div>
  );
}

function ResultView({
  result,
  steps,
  expandLog,
  setExpandLog
}: {
  result: ResearchResult;
  steps: AgentStep[];
  expandLog: boolean;
  setExpandLog: (v: boolean) => void;
}) {
  const txShort = result.attestationTx
    ? `${result.attestationTx.slice(0, 10)}…${result.attestationTx.slice(-4)}`
    : null;
  const totalPaid = (result.totalPaidUSDC / 1e18).toFixed(2);
  const citationCount = result.paperDetails.reduce(
    (acc, p) => acc + p.authors.length,
    0
  );
  const authorCount = new Set(
    result.paperDetails.flatMap((p) => p.authors.map((a) => a.wallet))
  ).size;

  return (
    <div className="flex flex-col gap-5">
      <div className="card animate-fade-up flex justify-between items-center p-3 px-4 surface-raised">
        <div className="flex gap-2.5 items-center">
          <div className="w-[22px] h-[22px] rounded-full bg-emerald-500 text-white flex items-center justify-center">
            <CheckIcon size={13} />
          </div>
          <span className="t-small">
            <strong>{Math.min(steps.length, 5)} steps complete</strong> · {result.paperDetails.length}{" "}
            papers · {citationCount} citations
          </span>
        </div>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => setExpandLog(!expandLog)}
        >
          {expandLog ? "Collapse" : "Expand"} log <ChevronDownIcon />
        </button>
      </div>

      {expandLog && (
        <div className="card p-0 overflow-hidden animate-fade-up">
          {steps.map((s, i) => (
            <div
              key={i}
              className="grid items-center gap-3 px-5 py-3 border-b border-token last:border-b-0"
              style={{ gridTemplateColumns: "44px 1fr 70px" }}
            >
              <div className="flex justify-center">
                <StepIcon state={s.status} n={s.step} />
              </div>
              <div>
                <div className="t-small font-semibold">{s.label}</div>
                {s.detail && <div className="t-small ink-3 mt-0.5">{s.detail}</div>}
              </div>
              <div className="t-mono-sm text-right ink-3">{s.status}</div>
            </div>
          ))}
        </div>
      )}

      <div
        className="card animate-fade-up p-7"
        style={{ animationDelay: "60ms" }}
      >
        <div className="t-caption">Summary</div>
        <div
          className="t-serif mt-2 mb-5"
          style={{ fontSize: 24, lineHeight: "32px", color: "var(--ink)" }}
        >
          "{result.query}"
        </div>
        <div className="t-body m-0 max-w-[780px]">
          <RenderWithCitations text={result.summary} />
        </div>
      </div>

      <div
        className="card pattern-grid animate-fade-up p-0 overflow-hidden relative"
        style={{ animationDelay: "120ms" }}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-token surface">
          <div>
            <div className="t-caption text-emerald-700">Attribution receipt</div>
            <div className="t-h2 mt-1">
              {authorCount} author{authorCount === 1 ? "" : "s"} paid ·{" "}
              <span className="t-mono" style={{ fontSize: 28 }}>
                {totalPaid} USDC
              </span>
            </div>
          </div>
          {txShort && result.attestationTx && (
            <a
              href={KITESCAN_TX + result.attestationTx}
              target="_blank"
              rel="noreferrer"
              className="chip chip--success chip--lg animate-pulse-ring rounded-full"
            >
              <CheckIcon size={12} /> Tx {txShort}
            </a>
          )}
          {!txShort && (
            <span className="chip chip--pending chip--lg rounded-full">
              Demo mode · no on-chain tx
            </span>
          )}
        </div>
        <div className="surface">
          {result.paperDetails.flatMap((p, pIdx) =>
            p.authors.map((a, aIdx) => {
              const globalIdx =
                result.paperDetails.slice(0, pIdx).reduce((acc, pp) => acc + pp.authors.length, 0) +
                aIdx;
              const top = globalIdx === 0;
              const amount = (
                (result.totalPaidUSDC * 0.4 * (a.share / 10000)) /
                1e18
              ).toFixed(4);
              return (
                <PayoutRow
                  key={`${p.id}-${a.wallet}-${aIdx}`}
                  index={globalIdx}
                  top={top}
                  name={a.name}
                  affiliation={`Paper ${p.id} · ${p.journalYear}`}
                  wallet={`${a.wallet.slice(0, 6)}…${a.wallet.slice(-4)}`}
                  walletFull={a.wallet}
                  walletHref={KITESCAN_ADDR + a.wallet}
                  amount={`${amount} USDC`}
                  tx={txShort ?? "demo"}
                  txHref={result.attestationTx ? KITESCAN_TX + result.attestationTx : undefined}
                />
              );
            })
          )}
          <div className="flex justify-between items-center px-5 py-3.5 border-t border-token surface-raised">
            <span className="t-small ink-2">Authors share (40%)</span>
            <span className="t-mono font-bold text-[15px]">
              {(result.totalPaidUSDC * 0.4 / 1e18).toFixed(4)} USDC
            </span>
          </div>
          {result.sessionId && (
            <div className="flex justify-between items-center px-5 py-3 border-t border-token">
              <div>
                <div className="t-small ink-2">Authorized under session</div>
                <div className="t-mono-sm ink-3 mt-0.5 break-all">
                  {result.sessionId} · delegator {result.sessionDelegator ?? "—"}
                </div>
              </div>
              <span className="chip chip--success" style={{ padding: "2px 10px", fontSize: 10 }}>
                Passport ✓
              </span>
            </div>
          )}
          {result.mirrorTx && result.mirrorExplorer && (
            <div className="flex justify-between items-center px-5 py-3 border-t border-token">
              <div className="min-w-0">
                <div className="t-small ink-2">
                  Mirrored on Avalanche Fuji
                </div>
                <a
                  href={result.mirrorExplorer}
                  target="_blank"
                  rel="noreferrer"
                  className="t-mono-sm text-kite-700 hover:text-kite-500 mt-0.5 break-all block"
                >
                  {result.mirrorTx}
                </a>
              </div>
              <span
                className="chip"
                style={{
                  padding: "2px 10px",
                  fontSize: 10,
                  background: "#e84142",
                  color: "#fff",
                  border: "1px solid #e84142"
                }}
              >
                LayerZero-pattern
              </span>
            </div>
          )}
          {result.subAgentAddress && result.subAgentFeeUSDC && (
            <div className="flex justify-between items-center px-5 py-3.5 border-t border-token">
              <div>
                <div className="t-small ink-2">Sub-agent fee → Summarizer</div>
                <div className="t-mono-sm ink-3 mt-0.5">
                  {result.subAgentAddress.slice(0, 6)}…{result.subAgentAddress.slice(-4)} (AA)
                </div>
              </div>
              <span className="t-mono font-semibold text-[15px] text-kite-700">
                + {result.subAgentFeeUSDC} USDC
              </span>
            </div>
          )}
        </div>
      </div>

      <div
        className="card animate-fade-up flex items-center justify-between px-5 py-4"
        style={{ animationDelay: "180ms" }}
      >
        <div>
          <div className="t-small">
            <strong>Full bibliography</strong> · {result.paperDetails.length} papers cited
          </div>
          <div className="t-small ink-3 mt-0.5">DOI · per-paper weight · per-author split</div>
        </div>
        <details className="cursor-pointer">
          <summary className="btn btn--ghost btn--sm list-none">
            Expand <ChevronDownIcon />
          </summary>
          <ul className="mt-3 space-y-2 text-sm">
            {result.paperDetails.map((p) => (
              <li key={p.id} className="pl-3 border-l-2 border-kite-200">
                <div className="t-serif text-[15px]">{p.title}</div>
                <div className="t-small ink-3">{p.journalYear}</div>
                <div className="t-mono-sm ink-3">
                  {p.id} · {p.authors.map((a) => a.name).join(" · ")}
                </div>
              </li>
            ))}
          </ul>
        </details>
      </div>

      <div
        className="card animate-fade-up flex items-center justify-between px-5 py-4"
        style={{
          animationDelay: "220ms",
          background:
            "linear-gradient(90deg, color-mix(in srgb, var(--kite-500) 7%, transparent), transparent)"
        }}
      >
        <div>
          <div className="t-small">
            <strong>Are you one of these authors?</strong>
          </div>
          <div className="t-small ink-3 mt-0.5">
            Bind your ORCID to claim the earnings above — unclaimed shares accrue 5% APY in escrow.
          </div>
        </div>
        <a href="/claim" className="btn btn--ghost btn--sm whitespace-nowrap">
          Claim via ORCID <ArrowRightIcon />
        </a>
      </div>

      <div className="flex justify-end items-center pt-2">
        <a
          href={`/verify/${result.queryId}`}
          target="_blank"
          rel="noreferrer"
          className="btn btn--primary btn--sm"
        >
          View on-chain proof ↗
        </a>
      </div>
    </div>
  );
}

function RenderWithCitations({ text }: { text: string }) {
  const parts = useMemo(() => {
    const segments: Array<{ type: "text" | "cite"; value: string }> = [];
    const regex = /\[(\d+)\]/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        segments.push({ type: "text", value: text.slice(lastIndex, match.index) });
      }
      segments.push({ type: "cite", value: match[1] });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
      segments.push({ type: "text", value: text.slice(lastIndex) });
    }
    return segments;
  }, [text]);

  return (
    <>
      {parts.map((part, i) =>
        part.type === "cite" ? (
          <Cite key={i} n={Number(part.value)} />
        ) : (
          <Fragment key={i}>{part.value}</Fragment>
        )
      )}
    </>
  );
}
