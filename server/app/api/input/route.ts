// Endpoint the phone (or any client) POSTs controller state to. Two body formats:
//
//   application/octet-stream  a compact 12-byte binary frame (see lib/wire.ts).
//                             This is what the phone client sends  smallest and
//                             fastest. Carries the full state + seq.
//   application/json          a full or partial ControllerState (back-compat:
//                             the monitor's demo input, the /receive relay, curl).
//
// Either way the hub diffs it and broadcasts to browsers + the bridge.

import { hub } from "@/lib/hub";
import { ControllerState } from "@/lib/types";
import { decodeState, PACKET_BYTES } from "@/lib/wire";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let state: Partial<ControllerState>;
  let seq: number | undefined;

  if ((req.headers.get("content-type") || "").includes("application/octet-stream")) {
    const buf = await req.arrayBuffer();
    if (buf.byteLength < PACKET_BYTES) {
      hub.recordError();
      return NextResponse.json({ error: "short frame" }, { status: 400 });
    }
    const decoded = decodeState(buf);
    state = decoded.state as Partial<ControllerState>;
    seq = decoded.seq;
  } else {
    let body: Partial<ControllerState> & { _seq?: number; _t?: number };
    try {
      body = await req.json();
    } catch {
      hub.recordError();
      return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
    }
    const { _seq, _t, ...rest } = body;
    void _t;
    state = rest;
    seq = typeof _seq === "number" ? _seq : undefined;
  }

  const fresh = hub.recordPacket(seq);
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
