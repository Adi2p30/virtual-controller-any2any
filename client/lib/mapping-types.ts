// Pure types and constants shared between server (mapping.ts) and client
// components. No Node.js imports — safe to use in "use client" files.

import { ButtonName } from "./types";

export type StickMode = "keys" | "mouse" | "none";

export interface StickMapping {
  mode: StickMode;
  keys: { up: string; down: string; left: string; right: string };
  deadzone: number;
  sensitivity: number;
}

export interface Mapping {
  buttons: Record<ButtonName, string>;
  leftStick: StickMapping;
  rightStick: StickMapping;
  triggers: { LT: string; RT: string };
  triggerThreshold: number;
}

export const KEY_OPTIONS: string[] = [
  "none",
  "mouse:left",
  "mouse:right",
  "space",
  "shift",
  "control",
  "option",
  "command",
  "tab",
  "return",
  "escape",
  "up",
  "down",
  "left",
  "right",
  ..."abcdefghijklmnopqrstuvwxyz".split(""),
  ..."0123456789".split(""),
];
