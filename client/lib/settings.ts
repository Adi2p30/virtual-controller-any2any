// User-tunable controller settings, persisted to localStorage. Covers which
// control groups are visible plus how the analog inputs are shaped.

import { useCallback, useEffect, useState } from "react";

export interface Settings {
  stickSensitivity: number; // multiplier on stick magnitude (0.4–2.0)
  triggerSensitivity: number; // multiplier on trigger value (0.4–2.0)
  deadzone: number; // ignore stick magnitude below this (0–0.4)
  vibrate: boolean; // haptic tick on press (if the device supports it)
  show: {
    sticks: boolean;
    dpad: boolean;
    faces: boolean;
    bumpers: boolean;
    triggers: boolean;
    system: boolean; // Back / Guide / Start
  };
}

export const DEFAULT_SETTINGS: Settings = {
  stickSensitivity: 1,
  triggerSensitivity: 1,
  deadzone: 0.05,
  vibrate: true,
  show: {
    sticks: true,
    dpad: true,
    faces: true,
    bumpers: true,
    triggers: true,
    system: true,
  },
};

const KEY = "controllerSettings";

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setSettings({
          ...DEFAULT_SETTINGS,
          ...parsed,
          show: { ...DEFAULT_SETTINGS.show, ...(parsed.show ?? {}) },
        });
      }
    } catch {
      /* ignore corrupt storage */
    }
  }, []);

  const update = useCallback((partial: Partial<Settings>) => {
    setSettings((prev) => {
      const next = {
        ...prev,
        ...partial,
        show: { ...prev.show, ...(partial.show ?? {}) },
      };
      localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    localStorage.setItem(KEY, JSON.stringify(DEFAULT_SETTINGS));
    setSettings(DEFAULT_SETTINGS);
  }, []);

  return { settings, update, reset };
}

/** Apply deadzone + sensitivity to a raw stick vector, clamped to the unit disk. */
export function shapeStick(
  x: number,
  y: number,
  s: Settings,
): { x: number; y: number } {
  const mag = Math.hypot(x, y);
  if (mag <= s.deadzone) return { x: 0, y: 0 };
  // rescale so the edge of the deadzone maps to 0
  const adj = (mag - s.deadzone) / (1 - s.deadzone);
  const k = ((adj / mag) * s.stickSensitivity);
  let nx = x * k;
  let ny = y * k;
  const m2 = Math.hypot(nx, ny);
  if (m2 > 1) {
    nx /= m2;
    ny /= m2;
  }
  return { x: +nx.toFixed(3), y: +ny.toFixed(3) };
}

/** Apply sensitivity to a trigger value, clamped to [0, 1]. */
export function shapeTrigger(v: number, s: Settings): number {
  return +Math.max(0, Math.min(1, v * s.triggerSensitivity)).toFixed(2);
}
