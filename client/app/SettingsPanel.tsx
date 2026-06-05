"use client";

import { Settings } from "@/lib/settings";

const SHOW_LABELS: { key: keyof Settings["show"]; label: string }[] = [
  { key: "sticks", label: "Analog sticks" },
  { key: "dpad", label: "D-pad" },
  { key: "faces", label: "Face buttons (A/B/X/Y)" },
  { key: "bumpers", label: "Bumpers (LB/RB)" },
  { key: "triggers", label: "Triggers (LT/RT)" },
  { key: "system", label: "Back / Guide / Start" },
];

export function SettingsPanel({
  settings,
  update,
  reset,
  onClose,
}: {
  settings: Settings;
  update: (p: Partial<Settings>) => void;
  reset: () => void;
  onClose: () => void;
}) {
  return (
    <div className="sheet-overlay" onPointerDown={onClose}>
      <div className="sheet" onPointerDown={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <span>Settings</span>
          <button className="x" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="sheet-body">
          <section>
            <h3>Visible controls</h3>
            {SHOW_LABELS.map(({ key, label }) => (
              <label className="toggle" key={key}>
                <span>{label}</span>
                <input
                  type="checkbox"
                  checked={settings.show[key]}
                  onChange={(e) =>
                    update({ show: { [key]: e.target.checked } as never })
                  }
                />
              </label>
            ))}
          </section>

          <section>
            <h3>Feel</h3>
            <Slider
              label="Stick sensitivity"
              min={0.4}
              max={2}
              step={0.05}
              value={settings.stickSensitivity}
              suffix={`${settings.stickSensitivity.toFixed(2)}×`}
              onChange={(v) => update({ stickSensitivity: v })}
            />
            <Slider
              label="Trigger sensitivity"
              min={0.4}
              max={2}
              step={0.05}
              value={settings.triggerSensitivity}
              suffix={`${settings.triggerSensitivity.toFixed(2)}×`}
              onChange={(v) => update({ triggerSensitivity: v })}
            />
            <Slider
              label="Stick deadzone"
              min={0}
              max={0.4}
              step={0.01}
              value={settings.deadzone}
              suffix={`${Math.round(settings.deadzone * 100)}%`}
              onChange={(v) => update({ deadzone: v })}
            />
            <label className="toggle">
              <span>Haptic feedback</span>
              <input
                type="checkbox"
                checked={settings.vibrate}
                onChange={(e) => update({ vibrate: e.target.checked })}
              />
            </label>
          </section>

          <button className="reset" onClick={reset}>
            Reset to defaults
          </button>
        </div>
      </div>
    </div>
  );
}

function Slider({
  label,
  min,
  max,
  step,
  value,
  suffix,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  suffix: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="slider">
      <div className="slider-top">
        <span>{label}</span>
        <b>{suffix}</b>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </label>
  );
}
