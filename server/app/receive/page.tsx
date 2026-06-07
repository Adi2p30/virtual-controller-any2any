"use client";

import { connectPeer, PeerStatus } from "@/lib/webrtc";
import { BUTTON_ORDER, WireState } from "@/lib/wire";
import { Mapping, StickMode, KEY_OPTIONS } from "@/lib/mapping-types";
import { useCallback, useEffect, useRef, useState } from "react";

// ─── types ───────────────────────────────────────────────────────────────────

type Tab = "monitor" | "config";

// ─── helpers ─────────────────────────────────────────────────────────────────

function btnStyle(bg: string, fg: string, extra?: React.CSSProperties): React.CSSProperties {
  return { padding: "10px 16px", background: bg, border: "none", borderRadius: 8, color: fg, fontSize: 16, cursor: "pointer", ...extra };
}

function Caption({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, letterSpacing: 1, color: "#8a94a0", textTransform: "uppercase", marginBottom: 6 }}>
      {children}
    </div>
  );
}

// ─── receive page ─────────────────────────────────────────────────────────────

export default function ReceivePage() {
  const [room, setRoom] = useState("");
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState<PeerStatus>("closed");
  const [count, setCount] = useState(0);
  const [view, setView] = useState<WireState | null>(null);
  const [tab, setTab] = useState<Tab>("monitor");
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [keyOptions, setKeyOptions] = useState<string[]>(KEY_OPTIONS ?? []);
  const [saving, setSaving] = useState(false);

  const frame = useRef<WireState | null>(null);
  const dirty = useRef(false);
  const maxSeq = useRef(-1);
  const inflight = useRef(false);
  const peerRef = useRef<ReturnType<typeof connectPeer> | null>(null);
  const received = useRef(0);

  // load mapping on mount
  useEffect(() => {
    fetch("/api/mapping")
      .then((r) => r.json())
      .then(({ mapping, keyOptions: ko }) => {
        setMapping(mapping);
        if (ko?.length) setKeyOptions(ko);
      })
      .catch(() => {});
  }, []);

  const saveMapping = useCallback(async (patch: Partial<Mapping>) => {
    setSaving(true);
    try {
      const res = await fetch("/api/mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const { mapping: updated } = await res.json();
      setMapping(updated);
    } catch {
      /* non-fatal */
    } finally {
      setSaving(false);
    }
  }, []);

  const forward = useCallback(async () => {
    if (inflight.current || !dirty.current || !frame.current) return;
    dirty.current = false;
    const state = frame.current;
    inflight.current = true;
    try {
      await fetch("/api/input", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state),
      });
    } catch {
      /* keep running */
    } finally {
      inflight.current = false;
    }
  }, []);

  useEffect(() => {
    if (!connected) return;
    let raf = 0;
    const tick = () => { forward(); setView(frame.current); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [connected, forward]);

  useEffect(() => {
    if (!connected) return;
    const id = setInterval(() => setCount(received.current), 250);
    return () => clearInterval(id);
  }, [connected]);

  const connect = useCallback(() => {
    if (!room.trim()) return;
    peerRef.current?.close();
    received.current = 0;
    maxSeq.current = -1;
    dirty.current = false;
    frame.current = null;
    peerRef.current = connectPeer({
      signalBase: window.location.origin,
      room: room.trim(),
      role: "receiver",
      onStatus: setStatus,
      onState: (state, seq) => {
        if (seq <= maxSeq.current) return;
        maxSeq.current = seq;
        received.current += 1;
        frame.current = state;
        dirty.current = true;
      },
    });
    setConnected(true);
  }, [room]);

  const disconnect = useCallback(() => {
    peerRef.current?.close();
    peerRef.current = null;
    setConnected(false);
    setStatus("closed");
    setView(null);
  }, []);

  useEffect(() => () => peerRef.current?.close(), []);

  const dotColor = status === "open" ? "#3ddc84" : status === "error" ? "#ff5252" : "#888";

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", gap: 18, fontFamily: "ui-monospace, monospace", background: "#0b0d10", color: "#e6e6e6", padding: 24 }}>
      <h1 style={{ fontSize: 20, letterSpacing: 1, margin: "12px 0 0" }}>DIRECT RECEIVER</h1>
      <p style={{ maxWidth: 440, textAlign: "center", color: "#9aa", margin: 0 }}>
        Enter the same room code as the controller. Frames arrive peer-to-peer and are fed to this machine&apos;s bridge.
      </p>

      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={room}
          onChange={(e) => setRoom(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !connected && connect()}
          placeholder="room code"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          disabled={connected}
          style={{ padding: "10px 12px", background: "#15181d", border: "1px solid #2a2f37", borderRadius: 8, color: "#e6e6e6", fontSize: 16, minWidth: 180 }}
        />
        {connected
          ? <button onClick={disconnect} style={btnStyle("#3a2126", "#ff8a8a")}>Stop</button>
          : <button onClick={connect} style={btnStyle("#16302a", "#7fffd0")}>Connect</button>
        }
      </div>

      {connected && (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: dotColor }} />
          <span style={{ color: "#9aa" }}>{status} · {count} frames</span>
        </div>
      )}

      {/* tab bar */}
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid #1e232b", width: "100%", maxWidth: 700 }}>
        {(["monitor", "config"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "8px 18px", background: "none", border: "none", borderBottom: tab === t ? "2px solid #3ddc84" : "2px solid transparent",
            color: tab === t ? "#3ddc84" : "#6b7480", cursor: "pointer", fontSize: 13, letterSpacing: 1, textTransform: "uppercase",
          }}>{t}</button>
        ))}
        {saving && <span style={{ marginLeft: "auto", alignSelf: "center", fontSize: 11, color: "#6b7480" }}>saving…</span>}
      </div>

      {tab === "monitor" && <InputView state={view} />}
      {tab === "config" && mapping && (
        <ConfigPanel mapping={mapping} keyOptions={keyOptions} onSave={saveMapping} />
      )}
      {tab === "config" && !mapping && (
        <div style={{ color: "#6b7480", fontSize: 13 }}>Loading mapping…</div>
      )}
    </div>
  );
}

// ─── live input readout ───────────────────────────────────────────────────────

function InputView({ state }: { state: WireState | null }) {
  const s: WireState = state ?? { leftStick: { x: 0, y: 0 }, rightStick: { x: 0, y: 0 }, triggers: { LT: 0, RT: 0 }, buttons: {} };
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 28, justifyContent: "center", alignItems: "flex-start", marginTop: 8, padding: 18, border: "1px solid #20242b", borderRadius: 12, background: "#0e1116", width: "100%", maxWidth: 700 }}>
      <Stick label="Left stick" x={s.leftStick.x} y={s.leftStick.y} />
      <Stick label="Right stick" x={s.rightStick.x} y={s.rightStick.y} />
      <div style={{ display: "flex", gap: 16 }}>
        <TriggerBar label="LT" v={s.triggers.LT} />
        <TriggerBar label="RT" v={s.triggers.RT} />
      </div>
      <div style={{ maxWidth: 260 }}>
        <Caption>Buttons</Caption>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
          {BUTTON_ORDER.map((b) => {
            const on = !!s.buttons[b];
            return (
              <span key={b} style={{
                textAlign: "center", padding: "6px 4px", fontSize: 11, borderRadius: 6, border: "1px solid",
                borderColor: on ? "#3ddc84" : "#262b33", background: on ? "#173a2a" : "#14171d",
                color: on ? "#7fffd0" : "#6b7480", transition: "all 60ms",
              }}>{b}</span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── config panel ─────────────────────────────────────────────────────────────

function ConfigPanel({ mapping, keyOptions, onSave }: {
  mapping: Mapping;
  keyOptions: string[];
  onSave: (patch: Partial<Mapping>) => void;
}) {
  const [draft, setDraft] = useState<Mapping>(() => JSON.parse(JSON.stringify(mapping)));

  // sync when parent mapping changes (e.g. after a save response)
  useEffect(() => { setDraft(JSON.parse(JSON.stringify(mapping))); }, [mapping]);

  const save = () => onSave(draft);

  const setButton = (btn: string, val: string) =>
    setDraft((d) => ({ ...d, buttons: { ...d.buttons, [btn]: val } }));

  const setStickMode = (stick: "leftStick" | "rightStick", mode: StickMode) =>
    setDraft((d) => ({ ...d, [stick]: { ...d[stick], mode } }));

  const setStickKey = (stick: "leftStick" | "rightStick", dir: string, val: string) =>
    setDraft((d) => ({ ...d, [stick]: { ...d[stick], keys: { ...d[stick].keys, [dir]: val } } }));

  const setStickNum = (stick: "leftStick" | "rightStick", field: "deadzone" | "sensitivity", val: number) =>
    setDraft((d) => ({ ...d, [stick]: { ...d[stick], [field]: val } }));

  const setTrigger = (t: "LT" | "RT", val: string) =>
    setDraft((d) => ({ ...d, triggers: { ...d.triggers, [t]: val } }));

  const row: React.CSSProperties = { display: "flex", alignItems: "center", gap: 12, marginBottom: 10 };
  const label: React.CSSProperties = { width: 110, color: "#8a94a0", fontSize: 12, flexShrink: 0 };

  return (
    <div style={{ width: "100%", maxWidth: 700, display: "flex", flexDirection: "column", gap: 24 }}>

      {/* ── Sticks ── */}
      {(["leftStick", "rightStick"] as const).map((stick) => {
        const s = draft[stick];
        const label_name = stick === "leftStick" ? "Left Stick" : "Right Stick";
        return (
          <section key={stick} style={{ background: "#0e1116", border: "1px solid #20242b", borderRadius: 12, padding: 18 }}>
            <Caption>{label_name}</Caption>

            {/* mode */}
            <div style={row}>
              <span style={label}>Mode</span>
              <div style={{ display: "flex", gap: 6 }}>
                {(["keys", "mouse", "none"] as StickMode[]).map((m) => (
                  <button key={m} onClick={() => setStickMode(stick, m)} style={{
                    padding: "5px 12px", borderRadius: 6, border: "1px solid",
                    borderColor: s.mode === m ? "#3ddc84" : "#2a2f37",
                    background: s.mode === m ? "#173a2a" : "#14171d",
                    color: s.mode === m ? "#7fffd0" : "#6b7480",
                    cursor: "pointer", fontSize: 12,
                  }}>{m}</button>
                ))}
              </div>
            </div>

            {/* deadzone */}
            <div style={row}>
              <span style={label}>Deadzone</span>
              <input type="range" min={0} max={0.9} step={0.01} value={s.deadzone}
                onChange={(e) => setStickNum(stick, "deadzone", parseFloat(e.target.value))}
                style={{ flex: 1 }} />
              <span style={{ width: 38, fontSize: 12, color: "#9aa", textAlign: "right" }}>{s.deadzone.toFixed(2)}</span>
              <DeadzoneCircle deadzone={s.deadzone} />
            </div>

            {/* sensitivity (only meaningful for mouse mode but shown always for awareness) */}
            <div style={row}>
              <span style={label}>Sensitivity</span>
              <input type="range" min={1} max={100} step={0.5} value={s.sensitivity}
                onChange={(e) => setStickNum(stick, "sensitivity", parseFloat(e.target.value))}
                style={{ flex: 1 }} />
              <span style={{ width: 38, fontSize: 12, color: "#9aa", textAlign: "right" }}>{s.sensitivity.toFixed(1)}</span>
            </div>

            {/* direction key mapping (shown when mode=keys) */}
            {s.mode === "keys" && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 11, color: "#8a94a0", letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Direction keys</div>
                <DPadKeyMap keys={s.keys} keyOptions={keyOptions}
                  onChange={(dir, val) => setStickKey(stick, dir, val)} />
              </div>
            )}
          </section>
        );
      })}

      {/* ── Triggers ── */}
      <section style={{ background: "#0e1116", border: "1px solid #20242b", borderRadius: 12, padding: 18 }}>
        <Caption>Triggers</Caption>
        <div style={row}>
          <span style={label}>Threshold</span>
          <input type="range" min={0.05} max={0.95} step={0.05} value={draft.triggerThreshold}
            onChange={(e) => setDraft((d) => ({ ...d, triggerThreshold: parseFloat(e.target.value) }))}
            style={{ flex: 1 }} />
          <span style={{ width: 38, fontSize: 12, color: "#9aa", textAlign: "right" }}>{Math.round(draft.triggerThreshold * 100)}%</span>
        </div>
        {(["LT", "RT"] as const).map((t) => (
          <div key={t} style={row}>
            <span style={label}>{t}</span>
            <KeySelect value={draft.triggers[t]} options={keyOptions} onChange={(v) => setTrigger(t, v)} />
          </div>
        ))}
      </section>

      {/* ── Buttons ── */}
      <section style={{ background: "#0e1116", border: "1px solid #20242b", borderRadius: 12, padding: 18 }}>
        <Caption>Buttons</Caption>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 24px" }}>
          {BUTTON_ORDER.map((b) => (
            <div key={b} style={row}>
              <span style={{ ...label, width: 80 }}>{b}</span>
              <KeySelect value={draft.buttons[b] ?? "none"} options={keyOptions} onChange={(v) => setButton(b, v)} />
            </div>
          ))}
        </div>
      </section>

      <button onClick={save} style={btnStyle("#16302a", "#7fffd0", { alignSelf: "flex-end", marginBottom: 32 })}>
        Save mapping
      </button>
    </div>
  );
}

// ─── sub-components ───────────────────────────────────────────────────────────

function DPadKeyMap({ keys, keyOptions, onChange }: {
  keys: { up: string; down: string; left: string; right: string };
  keyOptions: string[];
  onChange: (dir: string, val: string) => void;
}) {
  const cell: React.CSSProperties = { display: "flex", flexDirection: "column", alignItems: "center", gap: 4 };
  const lbl: React.CSSProperties = { fontSize: 10, color: "#6b7480", letterSpacing: 0.5 };
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gridTemplateRows: "auto auto", gap: 6, maxWidth: 260 }}>
      <div />
      <div style={cell}>
        <span style={lbl}>UP</span>
        <KeySelect value={keys.up} options={keyOptions} onChange={(v) => onChange("up", v)} small />
      </div>
      <div />
      <div style={cell}>
        <span style={lbl}>LEFT</span>
        <KeySelect value={keys.left} options={keyOptions} onChange={(v) => onChange("left", v)} small />
      </div>
      <div style={cell}>
        <span style={lbl}>DOWN</span>
        <KeySelect value={keys.down} options={keyOptions} onChange={(v) => onChange("down", v)} small />
      </div>
      <div style={cell}>
        <span style={lbl}>RIGHT</span>
        <KeySelect value={keys.right} options={keyOptions} onChange={(v) => onChange("right", v)} small />
      </div>
    </div>
  );
}

function KeySelect({ value, options, onChange, small }: { value: string; options: string[]; onChange: (v: string) => void; small?: boolean }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={{
      background: "#14171d", border: "1px solid #2a2f37", borderRadius: 6,
      color: value === "none" ? "#6b7480" : "#e6e6e6",
      fontSize: small ? 11 : 13, padding: small ? "3px 6px" : "5px 8px", cursor: "pointer", minWidth: small ? 60 : 100,
    }}>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

/** Visual deadzone indicator: a small circle showing the inactive centre radius. */
function DeadzoneCircle({ deadzone }: { deadzone: number }) {
  const size = 44;
  const r = size / 2;
  const dz = deadzone * r;
  return (
    <div style={{ position: "relative", width: size, height: size, borderRadius: "50%", border: "1px solid #2a2f37", background: "#14171d", flexShrink: 0, overflow: "hidden" }}>
      {/* deadzone shaded region */}
      <div style={{
        position: "absolute",
        left: "50%", top: "50%",
        width: dz * 2, height: dz * 2,
        transform: "translate(-50%,-50%)",
        borderRadius: "50%",
        background: "rgba(255,82,82,0.18)",
        border: "1px solid rgba(255,82,82,0.4)",
      }} />
      {/* crosshair */}
      <div style={{ position: "absolute", left: "50%", top: 0, width: 1, height: "100%", background: "#1f242c", transform: "translateX(-50%)" }} />
      <div style={{ position: "absolute", top: "50%", left: 0, height: 1, width: "100%", background: "#1f242c", transform: "translateY(-50%)" }} />
    </div>
  );
}

// ─── stick / trigger visuals (monitor tab) ────────────────────────────────────

function Stick({ label, x, y }: { label: string; x: number; y: number }) {
  const size = 100;
  const r = size / 2;
  const dot = 14;
  const px = r + x * (r - dot / 2) - dot / 2;
  const py = r + y * (r - dot / 2) - dot / 2;
  const active = Math.hypot(x, y) > 0.01;
  return (
    <div>
      <Caption>{label}</Caption>
      <div style={{ position: "relative", width: size, height: size, borderRadius: "50%", border: "1px solid #2a2f37", background: "#14171d" }}>
        <div style={{ position: "absolute", left: "50%", top: "50%", width: 1, height: "100%", transform: "translateX(-50%)", background: "#1f242c" }} />
        <div style={{ position: "absolute", top: "50%", left: "0", height: 1, width: "100%", transform: "translateY(-50%)", background: "#1f242c" }} />
        <div style={{ position: "absolute", width: dot, height: dot, borderRadius: "50%", left: px, top: py, background: active ? "#7fffd0" : "#3a4250", boxShadow: active ? "0 0 8px #3ddc84" : "none" }} />
      </div>
      <div style={{ fontSize: 11, color: "#6b7480", marginTop: 4 }}>x {x.toFixed(2)}  y {y.toFixed(2)}</div>
    </div>
  );
}

function TriggerBar({ label, v }: { label: string; v: number }) {
  return (
    <div style={{ textAlign: "center" }}>
      <Caption>{label}</Caption>
      <div style={{ position: "relative", width: 26, height: 100, borderRadius: 6, border: "1px solid #2a2f37", background: "#14171d", overflow: "hidden" }}>
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: `${Math.round(v * 100)}%`, background: "linear-gradient(#3ddc84, #1c6b48)" }} />
      </div>
      <div style={{ fontSize: 11, color: "#6b7480", marginTop: 4 }}>{Math.round(v * 100)}%</div>
    </div>
  );
}
