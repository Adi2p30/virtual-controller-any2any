import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Tiny endpoint the monitor hits on a timer to measure round-trip latency.
export async function GET() {
  return NextResponse.json(
    { t: Date.now() },
    { headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" } },
  );
}
