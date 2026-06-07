"use client";

import { Settings } from "@/lib/settings";
import { Transport } from "@/lib/sender";
import { Mapping, StickMode, KEY_OPTIONS } from "@/lib/mapping-types";
import { useCallback, useEffect, useState } from "react";

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
  transport,
  setTransport,
  room,
  setRoom,
  serverUrl,
  onClose,
}: {
  settings: Settings;
  update: (p: Partial<Settings>) => void;
  reset: () => void;
  transport: Transport;
  setTransport: (t: Transport) => void;
  room: string;
  setRoom: (r: string) => void;
  serverUrl: string;
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
            <h3>Connection</h3>
            <label className="toggle">
              <span>Direct (WebRTC, binary)</span>
              <input
                type="checkbox"
                checked={transport === "webrtc"}
                onChange={(e) => setTransport(e.target.checked ? "webrtc" : "http")}
              />
            </label>
            {transport === "webrtc" && (
              <label className="slider">
                <div className="slider-top">
                  <span>Room code</span>
                </div>
                <input
                  type="text"
                  value={room}
                  onChange={(e) => setRoom(e.target.value)}
                  placeholder="e.g. living-room"
                  spellCheck={false}
                  autoCapitalize="off"
                  autoCorrect="off"
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    background: "#15181d",
                    border: "1px solid #2a2f37",
                    borderRadius: 8,
                    color: "inherit",
                  }}
                />
              </label>
            )}
            <p style={{ fontSize: 12, opacity: 0.6, margin: "6px 0 0" }}>
              Direct sends 12-byte binary frames peer-to-peer. Open{" "}
              <b>/receive</b> on the target Mac and enter the same room code.
            </p>
          </section>

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

          <MappingSection serverUrl={serverUrl} />

          <button className="reset" onClick={reset}>
            Reset to defaults
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Mapping config (talks to server /api/mapping) ─────────────────────── */

const BUTTON_ORDER = ["A","B","X","Y","LB","RB","LS","RS","Back","Start","Guide","DPadUp","DPadDown","DPadLeft","DPadRight"] as const;

function MappingSection({ serverUrl }: { serverUrl: string }) {
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [keyOptions, setKeyOptions] = useState<string[]>(KEY_OPTIONS);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  const base = serverUrl.replace(/\/$/, "");

  const load = useCallback(() => {
    if (!base) return;
    fetch(`${base}/api/mapping`)
      .then((r) => r.json())
      .then(({ mapping: m, keyOptions: ko }) => {
        setMapping(m);
        if (ko?.length) setKeyOptions(ko);
      })
      .catch(() => {});
  }, [base]);

  useEffect(() => { if (open) load(); }, [open, load]);

  const save = useCallback(async (patch: Partial<Mapping>) => {
    if (!base) return;
    setSaving(true);
    try {
      const res = await fetch(`${base}/api/mapping`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const { mapping: updated } = await res.json();
      setMapping(updated);
    } catch { /* non-fatal */ } finally { setSaving(false); }
  }, [base]);

  const setButton = (btn: string, val: string) =>
    setMapping((d) => d ? { ...d, buttons: { ...d.buttons, [btn]: val } } : d);

  const setStickMode = (stick: "leftStick" | "rightStick", mode: StickMode) =>
    setMapping((d) => d ? { ...d, [stick]: { ...d[stick], mode } } : d);

  const setStickKey = (stick: "leftStick" | "rightStick", dir: string, val: string) =>
    setMapping((d) => d ? { ...d, [stick]: { ...d[stick], keys: { ...d[stick].keys, [dir]: val } } } : d);

  const setStickNum = (stick: "leftStick" | "rightStick", field: "deadzone" | "sensitivity", val: number) =>
    setMapping((d) => d ? { ...d, [stick]: { ...d[stick], [field]: val } } : d);

  const setTrigger = (t: "LT" | "RT", val: string) =>
    setMapping((d) => d ? { ...d, triggers: { ...d.triggers, [t]: val } } : d);

  const row: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, marginBottom: 8 };
  const lbl: React.CSSProperties = { width: 90, fontSize: 11, color: "#8a94a0", flexShrink: 0 };
  const sel = (value: string, onChange: (v: string) => void) => (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={{
      flex: 1, background: "#14171d", border: "1px solid #2a2f37", borderRadius: 6,
      color: value === "none" ? "#6b7480" : "#e6e6e6", fontSize: 12, padding: "4px 6px",
    }}>
      {keyOptions.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );

  return (
    <section>
      <h3 style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>Mapping config</span>
        <button onClick={() => setOpen((o) => !o)} style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: 13 }}>
          {open ? "▲ hide" : "▼ edit"}
        </button>
      </h3>

      {open && !mapping && (
        <p style={{ fontSize: 12, opacity: 0.6 }}>
          {base ? "Loading…" : "Set server URL above first."}
        </p>
      )}

      {open && mapping && (
        <div>
          {/* Sticks */}
          {(["leftStick", "rightStick"] as const).map((stick) => {
            const s = mapping[stick];
            return (
              <div key={stick} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, letterSpacing: 1, color: "#8a94a0", textTransform: "uppercase", marginBottom: 6 }}>
                  {stick === "leftStick" ? "Left stick" : "Right stick"}
                </div>
                <div style={row}>
                  <span style={lbl}>Mode</span>
                  <div style={{ display: "flex", gap: 4 }}>
                    {(["keys","mouse","none"] as StickMode[]).map((m) => (
                      <button key={m} onClick={() => setStickMode(stick, m)} style={{
                        padding: "3px 8px", borderRadius: 5, border: "1px solid",
                        borderColor: s.mode === m ? "var(--accent)" : "#2a2f37",
                        background: s.mode === m ? "#173a2a" : "#14171d",
                        color: s.mode === m ? "var(--accent)" : "#6b7480",
                        cursor: "pointer", fontSize: 11,
                      }}>{m}</button>
                    ))}
                  </div>
                </div>
                <div style={row}>
                  <span style={lbl}>Deadzone</span>
                  <input type="range" min={0} max={0.9} step={0.01} value={s.deadzone}
                    onChange={(e) => setStickNum(stick, "deadzone", parseFloat(e.target.value))}
                    style={{ flex: 1, accentColor: "var(--accent)" }} />
                  <span style={{ width: 32, fontSize: 11, color: "#9aa", textAlign: "right" }}>{s.deadzone.toFixed(2)}</span>
                </div>
                <div style={row}>
                  <span style={lbl}>Sensitivity</span>
                  <input type="range" min={1} max={100} step={0.5} value={s.sensitivity}
                    onChange={(e) => setStickNum(stick, "sensitivity", parseFloat(e.target.value))}
                    style={{ flex: 1, accentColor: "var(--accent)" }} />
                  <span style={{ width: 32, fontSize: 11, color: "#9aa", textAlign: "right" }}>{s.sensitivity.toFixed(0)}</span>
                </div>
                {s.mode === "keys" && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginTop: 4 }}>
                    {(["up","down","left","right"] as const).map((dir) => (
                      <div key={dir} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ width: 32, fontSize: 10, color: "#6b7480", textTransform: "uppercase" }}>{dir}</span>
                        {sel(s.keys[dir], (v) => setStickKey(stick, dir, v))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Triggers */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, letterSpacing: 1, color: "#8a94a0", textTransform: "uppercase", marginBottom: 6 }}>Triggers</div>
            <div style={row}>
              <span style={lbl}>Threshold</span>
              <input type="range" min={0.05} max={0.95} step={0.05} value={mapping.triggerThreshold}
                onChange={(e) => setMapping((d) => d ? { ...d, triggerThreshold: parseFloat(e.target.value) } : d)}
                style={{ flex: 1, accentColor: "var(--accent)" }} />
              <span style={{ width: 32, fontSize: 11, color: "#9aa", textAlign: "right" }}>{Math.round(mapping.triggerThreshold * 100)}%</span>
            </div>
            {(["LT","RT"] as const).map((t) => (
              <div key={t} style={row}>
                <span style={lbl}>{t}</span>
                {sel(mapping.triggers[t], (v) => setTrigger(t, v))}
              </div>
            ))}
          </div>

          {/* Buttons */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, letterSpacing: 1, color: "#8a94a0", textTransform: "uppercase", marginBottom: 6 }}>Buttons</div>
            {BUTTON_ORDER.map((b) => (
              <div key={b} style={row}>
                <span style={lbl}>{b}</span>
                {sel(mapping.buttons[b] ?? "none", (v) => setButton(b, v))}
              </div>
            ))}
          </div>

          <button
            onClick={() => save(mapping)}
            disabled={saving}
            style={{ width: "100%", padding: "10px", background: "#16302a", border: "1px solid var(--accent)", color: "var(--accent)", borderRadius: 9, fontFamily: "inherit", fontSize: 13, cursor: "pointer", marginBottom: 8 }}
          >
            {saving ? "Saving…" : "Save mapping"}
          </button>
        </div>
      )}
    </section>
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
