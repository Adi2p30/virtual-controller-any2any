// Browser-side WebRTC peer helper for the "Direct" transport. Two peers join a
// room through the server's /api/signal relay (used only for the SDP/ICE
// handshake); after that, controller frames flow peer-to-peer over a data
// channel and the server is out of the loop.
//
// Roles:
//   controller - creates the data channel + offer, calls handle.send(frame).
//   receiver   - answers, receives frames via opts.onState(state, seq).
//
// The data channel is unreliable + unordered (maxRetransmits 0): controller
// state is "latest wins", so dropping a late packet is better than head-of-line
// blocking. The receiver uses the per-frame seq to discard anything stale.
//
// Keep this file identical in client/ and server/.

import { decodeState, WireState } from "./wire";

export type PeerRole = "controller" | "receiver";
export type PeerStatus = "connecting" | "open" | "closed" | "error";

export interface PeerOptions {
  signalBase: string; // server base URL, e.g. http://192.168.1.20:3000
  room: string;
  role: PeerRole;
  onStatus?: (s: PeerStatus) => void;
  onState?: (state: WireState, seq: number) => void; // receiver only
}

export interface PeerHandle {
  send: (frame: ArrayBuffer) => void; // controller only; no-op until channel open
  close: () => void;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
];

export function connectPeer(opts: PeerOptions): PeerHandle {
  const base = opts.signalBase.replace(/\/$/, "");
  const signalUrl = `${base}/api/signal?room=${encodeURIComponent(
    opts.room,
  )}&role=${opts.role}`;

  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  let channel: RTCDataChannel | null = null;
  let closed = false;

  const post = (data: unknown) =>
    fetch(signalUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      keepalive: true,
    }).catch(() => {});

  const wireChannel = (ch: RTCDataChannel) => {
    channel = ch;
    ch.binaryType = "arraybuffer";
    ch.onopen = () => opts.onStatus?.("open");
    ch.onclose = () => opts.onStatus?.("closed");
    ch.onmessage = (ev) => {
      if (!opts.onState) return;
      try {
        if (typeof ev.data === "string") {
          // tolerate a JSON frame too (e.g. a debugging client)
          const o = JSON.parse(ev.data);
          opts.onState(o, typeof o._seq === "number" ? o._seq : 0);
        } else {
          const { state, seq } = decodeState(ev.data as ArrayBuffer);
          opts.onState(state, seq);
        }
      } catch {
        /* ignore malformed frame */
      }
    };
  };

  pc.onicecandidate = (e) => {
    if (e.candidate) post({ kind: "ice", candidate: e.candidate });
  };
  pc.onconnectionstatechange = () => {
    if (closed) return;
    const st = pc.connectionState;
    if (st === "connected") opts.onStatus?.("open");
    else if (st === "failed") opts.onStatus?.("error");
    else if (st === "disconnected") opts.onStatus?.("closed");
  };

  if (opts.role === "controller") {
    wireChannel(pc.createDataChannel("input", { ordered: false, maxRetransmits: 0 }));
    pc.createOffer()
      .then((o) => pc.setLocalDescription(o))
      .then(() => post({ kind: "offer", sdp: pc.localDescription }))
      .catch(() => opts.onStatus?.("error"));
  } else {
    pc.ondatachannel = (e) => wireChannel(e.channel);
  }

  opts.onStatus?.("connecting");
  const es = new EventSource(signalUrl);
  es.onmessage = async (ev) => {
    let msg: { from?: string; data?: unknown };
    try {
      msg = JSON.parse(ev.data);
    } catch {
      return;
    }
    const data = (msg.data ?? msg) as {
      kind?: string;
      sdp?: RTCSessionDescriptionInit;
      candidate?: RTCIceCandidateInit;
    };
    try {
      if (data.kind === "offer" && data.sdp) {
        await pc.setRemoteDescription(data.sdp);
        const ans = await pc.createAnswer();
        await pc.setLocalDescription(ans);
        post({ kind: "answer", sdp: pc.localDescription });
      } else if (data.kind === "answer" && data.sdp) {
        await pc.setRemoteDescription(data.sdp);
      } else if (data.kind === "ice" && data.candidate) {
        await pc.addIceCandidate(data.candidate);
      }
    } catch {
      /* ignore out-of-order signaling; the peer will retry/restart */
    }
  };

  const send = (frame: ArrayBuffer) => {
    if (channel && channel.readyState === "open") channel.send(frame);
  };

  const close = () => {
    if (closed) return;
    closed = true;
    es.close();
    try {
      channel?.close();
    } catch {
      /* noop */
    }
    pc.close();
    opts.onStatus?.("closed");
  };

  return { send, close };
}
