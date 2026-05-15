import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runResearchAgent } from "@/lib/agent";
import { checkSpendStateless, type SessionEnvelope } from "@/lib/session";
import { parseUSDC } from "@/lib/kite";
import type { AgentEvent } from "@/lib/types";
import type { Address } from "viem";

export const runtime = "nodejs";
export const maxDuration = 120;

const SessionBody = z.object({
  intent: z.object({
    user: z.string(),
    agent: z.string(),
    maxPerQueryUSDC: z.string(),
    dailyCapUSDC: z.string(),
    validUntil: z.string(),
    nonce: z.string(),
    purpose: z.string()
  }),
  signature: z.string(),
  spentToday: z.string()
});

const QuerySchema = z.object({
  query: z.string().min(5).max(500),
  budgetUSDC: z.number().min(0.1).max(20),
  session: SessionBody.optional()
});

function toEnvelope(raw: z.infer<typeof SessionBody>): SessionEnvelope {
  return {
    intent: {
      user: raw.intent.user as Address,
      agent: raw.intent.agent as Address,
      maxPerQueryUSDC: BigInt(raw.intent.maxPerQueryUSDC),
      dailyCapUSDC: BigInt(raw.intent.dailyCapUSDC),
      validUntil: BigInt(raw.intent.validUntil),
      nonce: BigInt(raw.intent.nonce),
      purpose: raw.intent.purpose
    },
    signature: raw.signature as `0x${string}`,
    spentToday: BigInt(raw.spentToday)
  };
}

// Anonymous (no session) queries are convenient for the landing AutoDemo
// + first-visit judges, but a hard cap stops a botnet from draining the
// agent AA via the unauthenticated path. Session-bound queries respect
// the user's signed daily/per-query caps instead.
const ANON_MAX_BUDGET_USDC = 0.5;

function originAllowed(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // server-to-server, MCP, curl — let through
  const allowList = [
    process.env.NEXT_PUBLIC_SITE_URL,
    "http://localhost:3000",
    "http://localhost:3010",
    "http://localhost:3011"
  ].filter(Boolean) as string[];
  return allowList.some((u) => origin === u);
}

export async function POST(req: NextRequest) {
  if (!originAllowed(req)) {
    return NextResponse.json(
      { error: "Origin not allowed", hint: "Browser CORS calls must come from kutip-zeta.vercel.app." },
      { status: 403 }
    );
  }

  const parsed = QuerySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { query, budgetUSDC, session } = parsed.data;
  const envelope = session ? toEnvelope(session) : null;

  // Anonymous abuse fence: without a signed delegation, cap the budget
  // hard regardless of what Zod allowed. Session path stays at full
  // bounds because the user signed for the cap themselves.
  if (!envelope && budgetUSDC > ANON_MAX_BUDGET_USDC) {
    return NextResponse.json(
      {
        error: "Anonymous queries are capped at 0.5 USDC.",
        hint: "Connect a wallet and sign a session delegation to use the full per-query budget."
      },
      { status: 402 }
    );
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const emit = (event: AgentEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        let sessionInfo:
          | { sessionId: string; userLabel: string; newSpentToday: string }
          | null = null;

        if (envelope) {
          const amount = parseUSDC(budgetUSDC);
          const { session: delegation, newSpentToday } = await checkSpendStateless(
            envelope,
            amount
          );
          sessionInfo = {
            sessionId: delegation.id,
            userLabel: `${delegation.intent.user.slice(0, 6)}…${delegation.intent.user.slice(-4)}`,
            newSpentToday: newSpentToday.toString()
          };
        }

        const result = await runResearchAgent({
          query,
          budgetUSDC,
          sessionInfo: sessionInfo
            ? { sessionId: sessionInfo.sessionId, userLabel: sessionInfo.userLabel }
            : undefined,
          emit
        });

        emit({
          type: "result",
          result: {
            ...result,
            sessionNewSpentToday: sessionInfo?.newSpentToday
          }
        });
      } catch (err) {
        emit({
          type: "error",
          message: err instanceof Error ? err.message : "unknown error"
        });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive"
    }
  });
}
