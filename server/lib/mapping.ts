// Input mapping: the user-editable contract for what each control on the pad
// does on the target machine. Edited in the monitor UI, persisted to disk, and
// fetched by the bridge (which translates it into real OS input).
//
// A "target" is what a digital control fires: a key name (see KEY_OPTIONS),
// "mouse:left" / "mouse:right", or "none".

import { promises as fs } from "fs";
import path from "path";
import { BUTTON_NAMES } from "./types";
export type { StickMode, StickMapping, Mapping } from "./mapping-types";
export { KEY_OPTIONS } from "./mapping-types";
import type { Mapping, StickMapping } from "./mapping-types";

export function defaultMapping(): Mapping {
  return {
    buttons: {
      A: "space",
      B: "shift",
      X: "e",
      Y: "f",
      LB: "q",
      RB: "r",
      LS: "c",
      RS: "mouse:right",
      Back: "tab",
      Start: "escape",
      Guide: "g",
      DPadUp: "up",
      DPadDown: "down",
      DPadLeft: "left",
      DPadRight: "right",
    },
    leftStick: {
      mode: "keys",
      keys: { up: "w", down: "s", left: "a", right: "d" },
      deadzone: 0.5,
      sensitivity: 18,
    },
    rightStick: {
      mode: "mouse",
      keys: { up: "up", down: "down", left: "left", right: "right" },
      deadzone: 0.12,
      sensitivity: 18,
    },
    triggers: { LT: "mouse:right", RT: "mouse:left" },
    triggerThreshold: 0.5,
  };
}

// Merge an incoming partial onto the current mapping so the UI can PATCH just
// one field. Validates button names and clamps numeric ranges.
export function mergeMapping(base: Mapping, patch: Partial<Mapping>): Mapping {
  const out: Mapping = JSON.parse(JSON.stringify(base));
  if (patch.buttons) {
    for (const b of BUTTON_NAMES) {
      if (typeof patch.buttons[b] === "string") out.buttons[b] = patch.buttons[b];
    }
  }
  const mergeStick = (dst: StickMapping, src?: Partial<StickMapping>) => {
    if (!src) return;
    if (src.mode) dst.mode = src.mode;
    if (src.keys) dst.keys = { ...dst.keys, ...src.keys };
    if (typeof src.deadzone === "number")
      dst.deadzone = Math.max(0, Math.min(1, src.deadzone));
    if (typeof src.sensitivity === "number")
      dst.sensitivity = Math.max(0, Math.min(200, src.sensitivity));
  };
  mergeStick(out.leftStick, patch.leftStick);
  mergeStick(out.rightStick, patch.rightStick);
  if (patch.triggers) {
    if (typeof patch.triggers.LT === "string") out.triggers.LT = patch.triggers.LT;
    if (typeof patch.triggers.RT === "string") out.triggers.RT = patch.triggers.RT;
  }
  if (typeof patch.triggerThreshold === "number")
    out.triggerThreshold = Math.max(0, Math.min(1, patch.triggerThreshold));
  return out;
}

// --- persistence (survives restarts; the bridge reads via /api/mapping) ---
const FILE = path.join(process.cwd(), "data", "mapping.json");
const globalForMapping = globalThis as unknown as { __mapping?: Mapping };

export async function getMapping(): Promise<Mapping> {
  if (globalForMapping.__mapping) return globalForMapping.__mapping;
  try {
    const raw = await fs.readFile(FILE, "utf8");
    globalForMapping.__mapping = mergeMapping(defaultMapping(), JSON.parse(raw));
  } catch {
    globalForMapping.__mapping = defaultMapping();
  }
  return globalForMapping.__mapping;
}

export async function saveMapping(patch: Partial<Mapping>): Promise<Mapping> {
  const next = mergeMapping(await getMapping(), patch);
  globalForMapping.__mapping = next;
  try {
    await fs.mkdir(path.dirname(FILE), { recursive: true });
    await fs.writeFile(FILE, JSON.stringify(next, null, 2), "utf8");
  } catch {
    // non-fatal: keep the in-memory copy even if disk write fails
  }
  return next;
}
