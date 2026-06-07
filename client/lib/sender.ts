// Client transport. Two modes, chosen by `transport`:
//
//   "http"   - POST the same compact 12-byte binary frame (see lib/wire.ts) to
//              the server's /api/input as application/octet-stream. Changes
//              coalesce into the next frame; a few concurrent in-flight POSTs
//              decouple input latency from RTT, and the frame's seq lets the
//              server drop out-of-order packets.
//
//   "webrtc" - "Direct" mode. A peer connection to the receiver carries the same
//              12-byte frame per update over an unreliable data channel  no
//              server in the data path. The server only brokers the handshake.
//
// Both transports send the identical binary frame; `send(partial)` merges into a
// full-state mirror so the encoder always has a complete frame.

import { useCallback, useEffect, useRef, useState } from "react";
import { connectPeer, PeerHandle } from "./webrtc";
import { encodeState, WireButton, WireState } from "./wire";

export type ConnStatus = "idle" | "ok" | "err";
export type Transport = "http" | "webrtc";

// How many POSTs may be in flight at once (http mode). >1 removes the RTT
// coupling; small enough to still apply backpressure on a slow/lossy link.
const MAX_INFLIGHT = 4;

function emptyWire(): WireState {
  return {
    leftStick: { x: 0, y: 0 },
    rightStick: { x: 0, y: 0 },
    triggers: { LT: 0, RT: 0 },
    buttons: {},
  };
}

// Deep-merge a partial controller update into the full WireState mirror.
function mergeWire(dst: WireState, partial: Record<string, unknown>) {
  if (partial.leftStick) Object.assign(dst.leftStick, partial.leftStick);
  if (partial.rightStick) Object.assign(dst.rightStick, partial.rightStick);
  if (partial.triggers) Object.assign(dst.triggers, partial.triggers);
  if (partial.buttons) {
    Object.assign(dst.buttons, partial.buttons as Record<WireButton, boolean>);
  }
}

export function useSender() {
  const [serverUrl, setServerUrl] = useState("");
  const [transport, setTransportState] = useState<Transport>("http");
  const [room, setRoomState] = useState("");
  const [status, setStatus] = useState<ConnStatus>("idle");

  const inflight = useRef(0);
  const dirty = useRef(false); // a fresh frame is waiting to be sent
  const seq = useRef(0);
  const full = useRef<WireState>(emptyWire()); // full state mirror for binary frames
  const peer = useRef<PeerHandle | null>(null);

  // defaults: same hostname, port 3000 (where the server/monitor runs)
  useEffect(() => {
    const fallback = `${window.location.protocol}//${window.location.hostname}:3000`;
    setServerUrl(localStorage.getItem("serverUrl") || fallback);
    setTransportState((localStorage.getItem("transport") as Transport) || "http");
    setRoomState(localStorage.getItem("room") || "");
  }, []);

  const persistServer = useCallback((url: string) => {
    setServerUrl(url);
    localStorage.setItem("serverUrl", url);
  }, []);
  const setTransport = useCallback((t: Transport) => {
    setTransportState(t);
    localStorage.setItem("transport", t);
  }, []);
  const setRoom = useCallback((r: string) => {
    setRoomState(r);
    localStorage.setItem("room", r);
  }, []);

  // ---- http flush: POST the 12-byte binary frame of the full state ----
  const flushHttp = useCallback(async () => {
    if (inflight.current >= MAX_INFLIGHT || !dirty.current || !serverUrl) return;
    dirty.current = false;
    inflight.current += 1;
    seq.current += 1;
    const buf = encodeState(full.current, seq.current);
    try {
      const res = await fetch(`${serverUrl}/api/input`, {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: buf,
        keepalive: true,
      });
      setStatus(res.ok ? "ok" : "err");
    } catch {
      setStatus("err");
    } finally {
      inflight.current -= 1;
      if (dirty.current) flushHttp();
    }
  }, [serverUrl]);

  // ---- webrtc flush: one 12-byte binary frame of the full state ----
  const flushWebrtc = useCallback(() => {
    const p = peer.current;
    if (!p) return;
    seq.current += 1;
    p.send(encodeState(full.current, seq.current));
  }, []);

  // keep a ref to the active flusher so the peer's onStatus can fire it on open
  const flushWebrtcRef = useRef(flushWebrtc);
  flushWebrtcRef.current = flushWebrtc;

  // ---- (re)establish the peer when Direct mode is active ----
  useEffect(() => {
    if (transport !== "webrtc" || !serverUrl || !room) {
      peer.current?.close();
      peer.current = null;
      return;
    }
    setStatus("idle");
    const handle = connectPeer({
      signalBase: serverUrl,
      room,
      role: "controller",
      onStatus: (s) => {
        setStatus(s === "open" ? "ok" : s === "error" ? "err" : "idle");
        if (s === "open") flushWebrtcRef.current(); // push current state immediately
      },
    });
    peer.current = handle;
    return () => {
      handle.close();
      peer.current = null;
    };
  }, [transport, serverUrl, room]);

  // ---- WebRTC heartbeat: re-send current state at 20 Hz even when nothing
  // changes, so held buttons/triggers stay active if the phone screen dims or
  // the connection briefly drops. setInterval keeps firing in background tabs
  // better than rAF does. ----
  useEffect(() => {
    if (transport !== "webrtc") return;
    const id = setInterval(() => flushWebrtcRef.current(), 50);
    return () => clearInterval(id);
  }, [transport]);

  // merge a partial update into the full-state mirror, then flush a binary frame
  const send = useCallback(
    (partial: Record<string, unknown>) => {
      mergeWire(full.current, partial);
      dirty.current = true;
      if (transport === "webrtc") flushWebrtc();
      else flushHttp();
    },
    [transport, flushHttp, flushWebrtc],
  );

  return {
    send,
    serverUrl,
    setServerUrl: persistServer,
    status,
    transport,
    setTransport,
    room,
    setRoom,
  };
}
