// Shared controller state model  the canonical shape the phone sends and the
// server reflects. Sticks are normalized to [-1, 1]; triggers to [0, 1].

export type ButtonName =
  | "A"
  | "B"
  | "X"
  | "Y"
  | "LB"
  | "RB"
  | "LS" // left stick click
  | "RS" // right stick click
  | "Back"
  | "Start"
  | "Guide"
  | "DPadUp"
  | "DPadDown"
  | "DPadLeft"
  | "DPadRight";

export const BUTTON_NAMES: ButtonName[] = [
  "A",
  "B",
  "X",
  "Y",
  "LB",
  "RB",
  "LS",
  "RS",
  "Back",
  "Start",
  "Guide",
  "DPadUp",
  "DPadDown",
  "DPadLeft",
  "DPadRight",
];

export interface ControllerState {
  leftStick: { x: number; y: number };
  rightStick: { x: number; y: number };
  triggers: { LT: number; RT: number };
  buttons: Record<ButtonName, boolean>;
  // monotonically-increasing timestamp of the last received packet (ms epoch)
  updatedAt: number;
}

export function emptyState(): ControllerState {
  return {
    leftStick: { x: 0, y: 0 },
    rightStick: { x: 0, y: 0 },
    triggers: { LT: 0, RT: 0 },
    buttons: BUTTON_NAMES.reduce(
      (acc, b) => ((acc[b] = false), acc),
      {} as Record<ButtonName, boolean>,
    ),
    updatedAt: 0,
  };
}

export interface LogEntry {
  id: number;
  ts: number;
  kind: "button" | "stick" | "trigger" | "system";
  message: string;
}

export interface Metrics {
  received: number; // total input packets accepted
  missed: number; // packets the sequence numbers say we never got
  errors: number; // rejected/invalid packets
  inputHz: number; // packets/sec over the last second
  lastInputAt: number; // ms epoch of the most recent packet
}

export function emptyMetrics(): Metrics {
  return { received: 0, missed: 0, errors: 0, inputHz: 0, lastInputAt: 0 };
}
