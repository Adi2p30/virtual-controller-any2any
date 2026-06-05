"use client";

// Input-mapping editor shown in the monitor. Lets you choose what each control
// does on the target machine (e.g. D-pad → arrows vs WASD). Saves to
// /api/mapping; the bridge picks the change up on its next poll.

import type { Mapping, StickMapping, StickMode } from "@/lib/mapping";
import { ButtonName } from "@/lib/types";
import { useCallback, useEffect, useState } from "react";

const BUTTON_GROUPS: { title: string; items: ButtonName[] }[] = [
  { title: "Face", items: ["A", "B", "X", "Y"] },
  { title: "Shoulders / sticks", items: ["LB", "RB", "LS", "RS"] },
  { title: "System", items: ["Back", "Start", "Guide"] },
  { title: "D-pad", items: ["DPadUp", "DPadDown", "DPadLeft", "DPadRight"] },
];

export default function MappingPanel() {
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [keyOptions, setKeyOptions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/mapping")
      .then((r) => r.json())
      .then((d) => {
        setMapping(d.mapping);
        setKeyOptions(d.keyOptions);
      })
      .catch(() => {});
  }, []);

  // Send a partial patch; the server merges + persists, returns the full mapping.
  const patch = useCallback(async (body: Partial<Mapping>) => {
    setSaving(true);
    try {
      const res = await fetch("/api/mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (d.mapping) setMapping(d.mapping);
      setSavedAt(Date.now());
    } finally {
      setSaving(false);
    }
  }, []);

  if (!mapping) {
    return (
      <div className="panel">
        <h2>Input Mapping</h2>
        <div className="log-empty">Loading mapping…</div>
      </div>
    );
  }

  const setButton = (b: ButtonName, target: string) =>
    patch({ buttons: { ...mapping.buttons, [b]: target } });

  const setStick = (which: "leftStick" | "rightStick", s: Partial<StickMapping>) =>
    patch({ [which]: s } as Partial<Mapping>);

  return (
    <div className="panel">
      <h2>
        Input Mapping
        <span className="save-state">
          {saving ? " saving…" : savedAt ? " saved ✓" : ""}
        </span>
      </h2>

      <div className="map-presets">
        <span>Quick presets:</span>
        <button
          className="tbtn"
          onClick={() =>
            patch({
              buttons: {
                ...mapping.buttons,
                DPadUp: "up",
                DPadDown: "down",
                DPadLeft: "left",
                DPadRight: "right",
              },
            })
          }
        >
          D-pad → Arrows
        </button>
        <button
          className="tbtn"
          onClick={() =>
            patch({
              buttons: {
                ...mapping.buttons,
                DPadUp: "w",
                DPadDown: "s",
                DPadLeft: "a",
                DPadRight: "d",
              },
            })
          }
        >
          D-pad → WASD
        </button>
        <button
          className="tbtn"
          onClick={() =>
            setStick("leftStick", {
              mode: "keys",
              keys: { up: "w", down: "s", left: "a", right: "d" },
            })
          }
        >
          L-stick → WASD
        </button>
        <button
          className="tbtn"
          onClick={() =>
            setStick("leftStick", {
              mode: "keys",
              keys: { up: "up", down: "down", left: "left", right: "right" },
            })
          }
        >
          L-stick → Arrows
        </button>
      </div>

      <div className="map-grid">
        {BUTTON_GROUPS.map((g) => (
          <div className="map-group" key={g.title}>
            <div className="map-group-title">{g.title}</div>
            {g.items.map((b) => (
              <Row key={b} label={b}>
                <KeySelect
                  value={mapping.buttons[b]}
                  options={keyOptions}
                  onChange={(v) => setButton(b, v)}
                />
              </Row>
            ))}
          </div>
        ))}

        <div className="map-group">
          <div className="map-group-title">Triggers</div>
          <Row label="LT">
            <KeySelect
              value={mapping.triggers.LT}
              options={keyOptions}
              onChange={(v) => patch({ triggers: { ...mapping.triggers, LT: v } })}
            />
          </Row>
          <Row label="RT">
            <KeySelect
              value={mapping.triggers.RT}
              options={keyOptions}
              onChange={(v) => patch({ triggers: { ...mapping.triggers, RT: v } })}
            />
          </Row>
          <Row label="Fire at">
            <input
              className="map-num"
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={mapping.triggerThreshold}
              onChange={(e) =>
                patch({ triggerThreshold: parseFloat(e.target.value) })
              }
            />
          </Row>
        </div>

        <StickEditor
          title="Left stick"
          stick={mapping.leftStick}
          options={keyOptions}
          onChange={(s) => setStick("leftStick", s)}
        />
        <StickEditor
          title="Right stick"
          stick={mapping.rightStick}
          options={keyOptions}
          onChange={(s) => setStick("rightStick", s)}
        />
      </div>
    </div>
  );
}

function StickEditor({
  title,
  stick,
  options,
  onChange,
}: {
  title: string;
  stick: StickMapping;
  options: string[];
  onChange: (s: Partial<StickMapping>) => void;
}) {
  return (
    <div className="map-group">
      <div className="map-group-title">{title}</div>
      <Row label="Mode">
        <select
          className="map-select"
          value={stick.mode}
          onChange={(e) => onChange({ mode: e.target.value as StickMode })}
        >
          <option value="keys">Keys (digital)</option>
          <option value="mouse">Mouse</option>
          <option value="none">Off</option>
        </select>
      </Row>
      {stick.mode === "keys" && (
        <>
          {(["up", "down", "left", "right"] as const).map((dir) => (
            <Row key={dir} label={dir}>
              <KeySelect
                value={stick.keys[dir]}
                options={options}
                onChange={(v) => onChange({ keys: { ...stick.keys, [dir]: v } })}
              />
            </Row>
          ))}
        </>
      )}
      <Row label="Deadzone">
        <input
          className="map-num"
          type="number"
          min={0}
          max={1}
          step={0.02}
          value={stick.deadzone}
          onChange={(e) => onChange({ deadzone: parseFloat(e.target.value) })}
        />
      </Row>
      {stick.mode === "mouse" && (
        <Row label="Sensitivity">
          <input
            className="map-num"
            type="number"
            min={0}
            max={200}
            step={1}
            value={stick.sensitivity}
            onChange={(e) => onChange({ sensitivity: parseFloat(e.target.value) })}
          />
        </Row>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="map-row">
      <span className="map-label">{label}</span>
      {children}
    </div>
  );
}

function KeySelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <select
      className="map-select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {label(o)}
        </option>
      ))}
    </select>
  );
}

function label(o: string) {
  if (o === "none") return " none ";
  if (o === "mouse:left") return "Mouse: left click";
  if (o === "mouse:right") return "Mouse: right click";
  return o.length === 1 ? o.toUpperCase() : o;
}
