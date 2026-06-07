// In-memory WebRTC signaling relay. The server only brokers the SDP/ICE
// handshake between two peers in a room  the "controller" (phone or Mac browser
// running the UI) and the "receiver" (the Mac browser at /receive that feeds the
// bridge). Once the peer connection is up, controller state flows directly
// device-to-device over a WebRTC data channel and never touches this server.
//
// A room has exactly two roles. A message posted by one role is delivered to the
// other. If the other side hasn't connected its SSE stream yet, the message is
// buffered (capped) and flushed when it does, so a slightly-early offer/ICE
// isn't lost. Single global instance so the POST and SSE routes share it across
// hot reloads in dev.

import { EventEmitter } from "events";

export type SignalRole = "controller" | "receiver";

export interface SignalMessage {
  from: SignalRole;
  data: unknown;
}

const MAX_QUEUE = 64; // cap buffered messages per role so a dead peer can't grow it unbounded

interface Room {
  emitter: EventEmitter;
  queues: Record<SignalRole, SignalMessage[]>;
  listeners: Record<SignalRole, number>;
}

const other = (role: SignalRole): SignalRole =>
  role === "controller" ? "receiver" : "controller";

class SignalHub {
  private rooms = new Map<string, Room>();

  private get(room: string): Room {
    let r = this.rooms.get(room);
    if (!r) {
      const emitter = new EventEmitter();
      emitter.setMaxListeners(0);
      r = {
        emitter,
        queues: { controller: [], receiver: [] },
        listeners: { controller: 0, receiver: 0 },
      };
      this.rooms.set(room, r);
    }
    return r;
  }

  /** Relay a message from `from` to the other role in the room. */
  post(room: string, from: SignalRole, data: unknown) {
    const r = this.get(room);
    const target = other(from);
    const msg: SignalMessage = { from, data };
    if (r.listeners[target] > 0) {
      r.emitter.emit(target, msg);
    } else {
      const q = r.queues[target];
      q.push(msg);
      if (q.length > MAX_QUEUE) q.splice(0, q.length - MAX_QUEUE);
    }
  }

  /**
   * Subscribe `role` to messages addressed to it. Drains anything buffered while
   * it was away, then forwards live messages. Node's EventEmitter is synchronous
   * and post()/subscribe() run without awaits, so no message can slip in between
   * the drain and the listener registration.
   */
  subscribe(room: string, role: SignalRole, fn: (m: SignalMessage) => void) {
    const r = this.get(room);
    const buffered = r.queues[role];
    r.queues[role] = [];
    for (const m of buffered) fn(m);

    r.listeners[role] += 1;
    r.emitter.on(role, fn);

    return () => {
      r.emitter.off(role, fn);
      r.listeners[role] = Math.max(0, r.listeners[role] - 1);
      // drop empty idle rooms so the map doesn't grow forever
      if (
        r.listeners.controller === 0 &&
        r.listeners.receiver === 0 &&
        r.queues.controller.length === 0 &&
        r.queues.receiver.length === 0
      ) {
        this.rooms.delete(room);
      }
    };
  }
}

const globalForSignal = globalThis as unknown as { __signal?: SignalHub };

export const signal: SignalHub = globalForSignal.__signal ?? new SignalHub();
if (!globalForSignal.__signal) globalForSignal.__signal = signal;
