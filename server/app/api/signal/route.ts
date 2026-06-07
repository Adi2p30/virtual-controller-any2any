// WebRTC signaling relay. Brokers the SDP/ICE handshake between the two peers in
// a room  nothing else. Controller frames go peer-to-peer once connected.
//
//   GET  /api/signal?room=<id>&role=controller|receiver   -> SSE of {from,data}
//   POST /api/signal?room=<id>&role=controller|receiver    -> relay to the peer
//
// CORS is wide open so the client app (a different origin) can reach it.

import { signal, SignalRole } from "@/lib/signal";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function parse(req: NextRequest): { room: string; role: SignalRole } | null {
  const room = req.nextUrl.searchParams.get("room");
  const role = req.nextUrl.searchParams.get("role");
  if (!room || (role !== "controller" && role !== "receiver")) return null;
  return { room, role };
}

export function GET(req: NextRequest) {
  const p = parse(req);
  if (!p) {
    return NextResponse.json({ error: "room and role required" }, { status: 400 });
  }
  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream({
    start(controller) {
      const unsubscribe = signal.subscribe(p.room, p.role, (m) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(m)}\n\n`));
      });
      const ping = setInterval(() => {
        controller.enqueue(encoder.encode(`: ping\n\n`));
      }, 15000);
      cleanup = () => {
        clearInterval(ping);
        unsubscribe();
      };
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      ...CORS,
    },
  });
}

export async function POST(req: NextRequest) {
  const p = parse(req);
  if (!p) {
    return NextResponse.json(
      { error: "room and role required" },
      { status: 400, headers: CORS },
    );
  }
  let data: unknown;
  try {
    data = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400, headers: CORS });
  }
  signal.post(p.room, p.role, data);
  return NextResponse.json({ ok: true }, { headers: CORS });
}

export function OPTIONS() {
  return new NextResponse(null, { headers: CORS });
}
