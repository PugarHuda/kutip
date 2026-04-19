import { NextRequest, NextResponse } from "next/server";

export function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || !/^0x[a-fA-F0-9]{64}$/.test(q)) {
    return NextResponse.redirect(new URL("/verify", req.url));
  }
  return NextResponse.redirect(new URL(`/verify/${q.toLowerCase()}`, req.url));
}
