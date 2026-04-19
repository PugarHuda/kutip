import { NextResponse } from "next/server";
import { facilitatorHandshake } from "@/lib/pieverse";

export const runtime = "nodejs";
export const maxDuration = 15;

export async function GET() {
  const status = await facilitatorHandshake();
  return NextResponse.json(status);
}
