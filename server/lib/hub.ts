// In-memory hub: holds the latest controller state, diffs incoming packets into
// human-readable log entries, and fans out updates to all connected browsers
// via an EventEmitter. Lives as a global singleton so the SSE route and the
// input route share the same instance across hot reloads in dev.

import { EventEmitter } from "events";
import {
  BUTTON_NAMES,
  ControllerState,
  LogEntry,
  Metrics,
  emptyMetrics,
  emptyState,
} from "./types";

const DEAD_ZONE = 0.08; // ignore tiny stick jitter when logging
const TRIGGER_STEP = 0.1; // only log trigger changes bigger than this
const MAX_LOG = 200;
const SESSION_IDLE_MS = 1500; // silence longer than this = a new client session

export interface HubEvent {
  state: ControllerState;
  logs: LogEntry[]; // new entries produced by this update
  metrics: Metrics;
}

class ControllerHub {
  state: ControllerState = emptyState();
  log: LogEntry[] = [];
  metrics: Metrics = emptyMetrics();
  emitter = new EventEmitter();
  private logSeq = 0;
  private lastSeq: number | null = null;
  private recentTs: number[] = []; // packet arrival times for the Hz window

  constructor() {
    this.emitter.setMaxListeners(0);
  }

  /**
   * Record an inbound packet for the metrics: count, sequence gaps, rate.
   * Returns false if the packet is stale (an older _seq than one already
   * applied), so the caller can drop it  this lets the client fire packets
   * concurrently without a late one clobbering newer state.
   */
  recordPacket(seq?: number): boolean {
    const now = Date.now();
    // A new client/session always starts after a pause, and its _seq counter
    // restarts low. Genuine reordering only happens within milliseconds, so an
    // idle gap means "new session": resync to whatever seq arrives instead of
    // rejecting every low packet against a stale lastSeq forever.
    const prevTs = this.metrics.lastInputAt;
    const newSession = prevTs === 0 || now - prevTs > SESSION_IDLE_MS;
    this.metrics.received++;
    this.metrics.lastInputAt = now;
    let stale = false;
    if (typeof seq === "number") {
      if (!newSession && this.lastSeq !== null && seq <= this.lastSeq) {
        stale = true; // out-of-order/duplicate within an active stream: drop it
      } else {
        if (!newSession && this.lastSeq !== null && seq > this.lastSeq + 1) {
          this.metrics.missed += seq - this.lastSeq - 1;
        }
        this.lastSeq = seq;
      }
    }
    this.recentTs.push(now);
    while (this.recentTs.length && now - this.recentTs[0] > 1000) {
      this.recentTs.shift();
    }
    this.metrics.inputHz = this.recentTs.length;
    return !stale;
  }

  recordError() {
    this.metrics.errors++;
    this.emitter.emit("update", {
      state: this.state,
      logs: [],
      metrics: this.metrics,
    } as HubEvent);
  }

  private push(
    out: LogEntry[],
    kind: LogEntry["kind"],
    message: string,
  ) {
    const entry: LogEntry = {
      id: ++this.logSeq,
      ts: Date.now(),
      kind,
      message,
    };
    out.push(entry);
    this.log.push(entry);
    if (this.log.length > MAX_LOG) this.log.splice(0, this.log.length - MAX_LOG);
  }

  /** Apply a partial controller update, generating log entries for changes. */
  apply(partial: Partial<ControllerState>): HubEvent {
    const prev = this.state;
    const next: ControllerState = {
      leftStick: { ...prev.leftStick, ...(partial.leftStick ?? {}) },
      rightStick: { ...prev.rightStick, ...(partial.rightStick ?? {}) },
      triggers: { ...prev.triggers, ...(partial.triggers ?? {}) },
      buttons: { ...prev.buttons, ...(partial.buttons ?? {}) },
      updatedAt: Date.now(),
    };

    const newLogs: LogEntry[] = [];

    // Buttons  log press / release transitions.
    for (const b of BUTTON_NAMES) {
      if (next.buttons[b] !== prev.buttons[b]) {
        this.push(
          newLogs,
          "button",
          `${b} ${next.buttons[b] ? "pressed" : "released"}`,
        );
      }
    }

    // Sticks  log meaningful movement.
    const stickMoved = (
      label: string,
      a: { x: number; y: number },
      b: { x: number; y: number },
    ) => {
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d > DEAD_ZONE) {
        const mag = Math.hypot(b.x, b.y);
        const angle = (Math.atan2(b.y, b.x) * 180) / Math.PI;
        this.push(
          newLogs,
          "stick",
          `${label} → x:${b.x.toFixed(2)} y:${b.y.toFixed(2)} (mag ${mag.toFixed(
            2,
          )}, ${angle.toFixed(0)}°)`,
        );
      }
    };
    stickMoved("Left stick", prev.leftStick, next.leftStick);
    stickMoved("Right stick", prev.rightStick, next.rightStick);

    // Triggers.
    if (Math.abs(next.triggers.LT - prev.triggers.LT) > TRIGGER_STEP) {
      this.push(newLogs, "trigger", `LT ${(next.triggers.LT * 100).toFixed(0)}%`);
    }
    if (Math.abs(next.triggers.RT - prev.triggers.RT) > TRIGGER_STEP) {
      this.push(newLogs, "trigger", `RT ${(next.triggers.RT * 100).toFixed(0)}%`);
    }

    this.state = next;
    const event: HubEvent = { state: next, logs: newLogs, metrics: this.metrics };
    this.emitter.emit("update", event);
    return event;
  }

  system(message: string) {
    const newLogs: LogEntry[] = [];
    this.push(newLogs, "system", message);
    const event: HubEvent = {
      state: this.state,
      logs: newLogs,
      metrics: this.metrics,
    };
    this.emitter.emit("update", event);
    return event;
  }

  reset() {
    this.state = emptyState();
    this.lastSeq = null; // next packet (any seq) starts a fresh stream
    return this.system("Controller state reset");
  }

  subscribe(fn: (e: HubEvent) => void) {
    this.emitter.on("update", fn);
    return () => this.emitter.off("update", fn);
  }
}

const globalForHub = globalThis as unknown as { __hub?: ControllerHub };

export const hub: ControllerHub = globalForHub.__hub ?? new ControllerHub();
if (!globalForHub.__hub) globalForHub.__hub = hub;
