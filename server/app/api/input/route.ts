// Endpoint the phone (or any client) POSTs controller state to. Accepts a full
// or partial ControllerState; the hub diffs it and broadcasts to browsers.

import { hub } from "@/lib/hub";
import { ControllerState } from "@/lib/types";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: Partial<ControllerState> & { _seq?: number; _t?: number };
  try {
    body = await req.json();
  } catch {
    hub.recordError();
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  // pull metadata off before applying the controller state
  const { _seq, _t, ...state } = body;
  void _t;
  const fresh = hub.recordPacket(typeof _seq === "number" ? _seq : undefined);
  if (!fresh) {
    // stale/out-of-order packet  count it but don't clobber newer state
    return NextResponse.json(
      { ok: true, stale: true, state: hub.state },
      { headers: { "Access-Control-Allow-Origin": "*" } },
    );
  }
  const event = hub.apply(state);
  return NextResponse.json(
    { ok: true, state: event.state, logged: event.logs.length },
    { headers: { "Access-Control-Allow-Origin": "*" } },
  );
}

export async function GET() {
  // convenience: report current state for debugging
  return NextResponse.json(hub.state);
}

export async function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
