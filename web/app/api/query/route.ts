import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runResearchAgent } from "@/lib/agent";
import type { AgentEvent } from "@/lib/types";

export const runtime = "nodejs";
// p95 observed during stress test was ~58s (cold start + LLM + bundler).
// Bumped to 120s so a slow OpenRouter response doesn't get guillotined by
// Vercel's default 60s cap. Hobby tier currently allows up to 300s.
export const maxDuration = 120;

const QuerySchema = z.object({
  query: z.string().min(5).max(500),
  budgetUSDC: z.number().min(0.1).max(20),
  sessionId: z.string().optional()
});

export async function POST(req: NextRequest) {
  const parsed = QuerySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const emit = (event: AgentEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        const result = await runResearchAgent({ ...parsed.data, emit });
        emit({ type: "result", result });
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
