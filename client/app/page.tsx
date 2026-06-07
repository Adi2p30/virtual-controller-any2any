"use client";

import { useSender } from "@/lib/sender";
import {
    Settings,
    shapeStick,
    shapeTrigger,
    useSettings,
} from "@/lib/settings";
import { ButtonName } from "@/lib/types";
import { APP_VERSION } from "@/lib/version";
import { useCallback, useEffect, useRef, useState } from "react";
import { SettingsPanel } from "./SettingsPanel";

type Layout = "pad" | "drive";

export default function Page() {
  const { send, serverUrl, setServerUrl, status, transport, setTransport, room, setRoom } =
    useSender();
  const { settings, update, reset } = useSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [barHidden, setBarHidden] = useState(false);
  const [layout, setLayout] = useState<Layout>("pad");
  const { isFullscreen, supported: fsSupported, toggle: toggleFs } =
    useFullscreen();
  const [iosHint, setIosHint] = useState(false);

  // One button → immersive: go fullscreen (where supported) AND hide the bar.
  const goImmersive = useCallback(() => {
    setBarHidden(true);
    if (fsSupported) {
      toggleFs();
    } else {
      // iOS Safari has no element fullscreen  point users at Add to Home Screen.
      setIosHint(true);
    }
  }, [fsSupported, toggleFs]);

  const buzz = useCallback(() => {
    if (settings.vibrate && typeof navigator !== "undefined") {
      navigator.vibrate?.(12);
    }
  }, [settings.vibrate]);

  const press = useCallback(
    (name: ButtonName, down: boolean) => {
      if (down) buzz();
      send({ buttons: { [name]: down } });
    },
    [send, buzz],
  );

  const { show } = settings;

  return (
    <div className="screen">
      {iosHint && (
        <div className="ioshint" onClick={() => setIosHint(false)}>
          For true fullscreen on iPhone: tap the Share button, then{" "}
          <b>Add to Home Screen</b>, and open it from there. (tap to dismiss)
        </div>
      )}
      {barHidden ? (
        <button
          className={`peek dot ${status === "ok" ? "ok" : status === "err" ? "err" : ""}`}
          onClick={() => {
            setBarHidden(false);
            if (isFullscreen) toggleFs();
          }}
          aria-label="Show top bar"
        />
      ) : (
        <div className="bar">
          <div className="brand">
            VIRTUAL <span>XBOX</span> CONTROLLER
            <span className="ver">v{APP_VERSION}</span>
          </div>
          <div className="conn">
            <span
              className={`dot ${status === "ok" ? "ok" : status === "err" ? "err" : ""}`}
            />
            <span>
              {status === "ok"
                ? "sending"
                : status === "err"
                  ? "server unreachable"
                  : "idle"}
            </span>
            <input
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              spellCheck={false}
              inputMode="url"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              placeholder="http://server-ip:3000"
            />
            <button
              className="iconbtn"
              onClick={() => setLayout((l) => l === "pad" ? "drive" : "pad")}
              aria-label="Toggle layout"
              title={layout === "pad" ? "Switch to Driving layout" : "Switch to Pad layout"}
              style={{ fontSize: 12, width: "auto", padding: "0 8px" }}
            >
              {layout === "pad" ? "🚗" : "🎮"}
            </button>
            <button className="iconbtn" onClick={() => setSettingsOpen(true)} aria-label="Settings">
              ⚙
            </button>
            <button
              className="iconbtn"
              onClick={goImmersive}
              aria-label="Fullscreen"
              title="Fullscreen (hide everything)"
            >
              ⛶
            </button>
            <button className="iconbtn" onClick={() => setBarHidden(true)} aria-label="Hide bar">
              ▢
            </button>
          </div>
        </div>
      )}

      <div className="stage">
        {layout === "drive" ? (
          <DriveLayout send={send} press={press} settings={settings} buzz={buzz} />
        ) : (
        <div className="pad">
          {/* shoulders + triggers (left) */}
          {(show.bumpers || show.triggers) && (
            <div className="sec shL">
              {show.bumpers && (
                <HoldButton className="sb" name="LB" onPress={press}>
                  LB
                </HoldButton>
              )}
              {show.triggers && (
                <Trigger
                  label="LT"
                  onChange={(v) => send({ triggers: { LT: shapeTrigger(v, settings) } })}
                  onStart={buzz}
                />
              )}
            </div>
          )}

          {/* system buttons */}
          {show.system && (
            <div className="sec sys">
              <HoldButton className="mini" name="Back" onPress={press}>
                ❐
              </HoldButton>
              <HoldButton className="guide" name="Guide" onPress={press}>
                ⊗
              </HoldButton>
              <HoldButton className="mini" name="Start" onPress=  {press}>
                ☰
              </HoldButton>
            </div>
          )}

          {/* shoulders + triggers (right) */}
          {(show.bumpers || show.triggers) && (
            <div className="sec shR">
              {show.bumpers && (
                <HoldButton className="sb" name="RB" onPress={press}>
                  RB
                </HoldButton>
              )}
              {show.triggers && (
                <Trigger
                  label="RT"
                  onChange={(v) => send({ triggers: { RT: shapeTrigger(v, settings) } })}
                  onStart={buzz}
                />
              )}
            </div>
          )}

          {/* left stick */}
          {show.sticks && (
            <div className="sec lstick">
              <Joystick
                settings={settings}
                onMove={(x, y) => send({ leftStick: { x, y } })}
                onClick={(d) => press("LS", d)}
              />
              <span className="cap">Left stick</span>
            </div>
          )}

          {/* face buttons */}
          {show.faces && (
            <div className="sec faces">
              <HoldButton className="face Y" name="Y" onPress={press}>
                Y
              </HoldButton>
              <HoldButton className="face X" name="X" onPress={press}>
                X
              </HoldButton>
              <HoldButton className="face B" name="B" onPress={press}>
                B
              </HoldButton>
              <HoldButton className="face A" name="A" onPress={press}>
                A
              </HoldButton>
            </div>
          )}

          {/* d-pad */}
          {show.dpad && (
            <div className="sec dpad">
              <HoldButton className="dbtn up" name="DPadUp" onPress={press}>
                ▲
              </HoldButton>
              <HoldButton className="dbtn down" name="DPadDown" onPress={press}>
                ▼
              </HoldButton>
              <HoldButton className="dbtn left" name="DPadLeft" onPress={press}>
                ◀
              </HoldButton>
              <HoldButton className="dbtn right" name="DPadRight" onPress={press}>
                ▶
              </HoldButton>
            </div>
          )}

          {/* right stick */}
          {show.sticks && (
            <div className="sec rstick">
              <Joystick
                settings={settings}
                onMove={(x, y) => send({ rightStick: { x, y } })}
                onClick={(d) => press("RS", d)}
              />
              <span className="cap">Right stick</span>
            </div>
          )}

          <div className="sec hint">Drag sticks · hold buttons · drag triggers up</div>
        </div>
        )}
      </div>

      {settingsOpen && (
        <SettingsPanel
          settings={settings}
          update={update}
          reset={reset}
          transport={transport}
          setTransport={setTransport}
          room={room}
          setRoom={setRoom}
          serverUrl={serverUrl}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}

/* ---------- a press-and-hold button ---------- */
// Fullscreen via the Fullscreen API (Android Chrome / desktop). On iOS Safari
// requestFullscreen is undefined for page elements, so `supported` is false and
// the UI falls back to the Add-to-Home-Screen hint.
function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const supported =
    typeof document !== "undefined" &&
    !!document.documentElement.requestFullscreen;

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggle = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  return { isFullscreen, supported, toggle };
}

function HoldButton({
  name,
  onPress,
  className,
  children,
  style,
}: {
  name: ButtonName;
  onPress: (n: ButtonName, down: boolean) => void;
  className?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const [on, setOn] = useState(false);
  const set = (down: boolean) => {
    setOn(down);
    onPress(name, down);
  };
  return (
    <div
      className={`${className ?? ""} ${on ? "on" : ""}`}
      style={style}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        set(true);
      }}
      onPointerUp={() => set(false)}
      onPointerCancel={() => set(false)}
    >
      {children}
    </div>
  );
}

/* ---------- draggable analog stick ---------- */
function Joystick({
  settings,
  onMove,
  onClick,
}: {
  settings: Settings;
  onMove: (x: number, y: number) => void;
  onClick: (down: boolean) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const tapMoved = useRef(false);

  const setKnob = (px: number, py: number, active: boolean) => {
    const k = knob.current;
    if (k) {
      k.style.transform = `translate(${px}px, ${py}px)`;
      k.classList.toggle("active", active);
    }
  };

  const handle = (clientX: number, clientY: number) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const radius = r.width / 2 - 16;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > radius) {
      dx = (dx / dist) * radius;
      dy = (dy / dist) * radius;
    }
    if (dist > 6) tapMoved.current = true;
    setKnob(dx, dy, true);
    const shaped = shapeStick(dx / radius, dy / radius, settings);
    onMove(shaped.x, shaped.y);
  };

  const end = () => {
    dragging.current = false;
    setKnob(0, 0, false);
    onMove(0, 0);
  };

  return (
    <div
      ref={ref}
      className="stick"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        dragging.current = true;
        tapMoved.current = false;
        handle(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (dragging.current) handle(e.clientX, e.clientY);
      }}
      onPointerUp={() => {
        if (!tapMoved.current) {
          onClick(true);
          setTimeout(() => onClick(false), 120);
        }
        end();
      }}
      onPointerCancel={end}
    >
      <div ref={knob} className="knob" />
    </div>
  );
}

/* ---------- driving layout ---------- */
function DriveLayout({
  send,
  press,
  settings,
  buzz,
}: {
  send: ReturnType<typeof useSender>["send"];
  press: (name: ButtonName, down: boolean) => void;
  settings: Settings;
  buzz: () => void;
}) {
  // Keep the screen awake while the driving layout is active.
  useEffect(() => {
    if (!("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let released = false;
    const acquire = () => {
      (navigator as Navigator & { wakeLock: { request: (t: string) => Promise<WakeLockSentinel> } })
        .wakeLock.request("screen")
        .then((l) => { if (!released) lock = l; })
        .catch(() => {});
    };
    acquire();
    const onVisible = () => { if (document.visibilityState === "visible") acquire(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      released = true;
      document.removeEventListener("visibilitychange", onVisible);
      lock?.release().catch(() => {});
    };
  }, []);

  return (
    <div style={{
      width: "100%",
      height: "100%",
      display: "grid",
      gridTemplateRows: "1fr auto auto",
      gridTemplateColumns: "1fr 1fr 1fr 1fr",
      gap: 10,
      padding: 12,
      maxWidth: 600,
      maxHeight: 700,
    }}>
      {/* steering wheel — spans full width, top row */}
      <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6 }}>
        <SteeringWheel onTurn={(x) => send({ leftStick: { x, y: 0 } })} />
        <span style={{ fontSize: 10, letterSpacing: 1, color: "var(--muted)", textTransform: "uppercase" }}>Steering</span>
      </div>

      {/* brake (LT) — bottom left 2 cols */}
      <div style={{ gridColumn: "1 / 3", display: "flex", flexDirection: "column", gap: 4 }}>
        <DrivePedal
          label="BRAKE"
          color="#e0473a"
          onChange={(v) => send({ triggers: { LT: v } })}
          onStart={buzz}
        />
      </div>

      {/* gas (RT) — bottom right 2 cols */}
      <div style={{ gridColumn: "3 / 5", display: "flex", flexDirection: "column", gap: 4 }}>
        <DrivePedal
          label="GAS"
          color="#3ddc97"
          onChange={(v) => send({ triggers: { RT: v } })}
          onStart={buzz}
        />
      </div>

      {/* action buttons row */}
      <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, justifyContent: "center", paddingBottom: 4 }}>
        {(["A", "B", "X", "Y"] as ButtonName[]).map((b) => (
          <HoldButton key={b} className={`face ${b}`} name={b} onPress={press}>
            {b}
          </HoldButton>
        ))}
        <HoldButton className="sb" name="LB" onPress={press} style={{ width: 52, height: 40, borderRadius: 8, fontSize: 12 }}>LB</HoldButton>
        <HoldButton className="sb" name="RB" onPress={press} style={{ width: 52, height: 40, borderRadius: 8, fontSize: 12 }}>RB</HoldButton>
      </div>
    </div>
  );
}

/* ---------- steering wheel (rotates left/right, sends leftStick.x) ---------- */
function SteeringWheel({ onTurn }: { onTurn: (x: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const startAngle = useRef(0);
  const currentAngle = useRef(0);
  const knobRef = useRef<HTMLDivElement>(null);
  const MAX_DEG = 135; // full deflection at 135° rotation

  const getAngle = (cx: number, cy: number, px: number, py: number) =>
    (Math.atan2(py - cy, px - cx) * 180) / Math.PI;

  const apply = (deg: number) => {
    const clamped = Math.max(-MAX_DEG, Math.min(MAX_DEG, deg));
    currentAngle.current = clamped;
    if (knobRef.current) knobRef.current.style.transform = `rotate(${clamped}deg)`;
    onTurn(parseFloat((clamped / MAX_DEG).toFixed(3)));
  };

  const getCenter = () => {
    const el = ref.current;
    if (!el) return { cx: 0, cy: 0 };
    const r = el.getBoundingClientRect();
    return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
  };

  return (
    <div
      ref={ref}
      style={{
        position: "relative",
        width: 200,
        height: 200,
        borderRadius: "50%",
        background: "radial-gradient(circle at center, #1e2530 0%, #0c1016 100%)",
        border: "3px solid var(--border)",
        touchAction: "none",
        userSelect: "none",
        cursor: "grab",
      }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        dragging.current = true;
        const { cx, cy } = getCenter();
        startAngle.current = getAngle(cx, cy, e.clientX, e.clientY) - currentAngle.current;
      }}
      onPointerMove={(e) => {
        if (!dragging.current) return;
        const { cx, cy } = getCenter();
        const a = getAngle(cx, cy, e.clientX, e.clientY) - startAngle.current;
        apply(a);
      }}
      onPointerUp={() => {
        dragging.current = false;
        apply(0);
      }}
      onPointerCancel={() => {
        dragging.current = false;
        apply(0);
      }}
    >
      {/* wheel spokes overlay */}
      <div ref={knobRef} style={{ position: "absolute", inset: 0, borderRadius: "50%", transition: "none" }}>
        {/* horizontal spoke */}
        <div style={{ position: "absolute", top: "50%", left: "10%", right: "10%", height: 3, background: "var(--border)", transform: "translateY(-50%)", borderRadius: 2 }} />
        {/* vertical spoke */}
        <div style={{ position: "absolute", left: "50%", top: "10%", bottom: "10%", width: 3, background: "var(--border)", transform: "translateX(-50%)", borderRadius: 2 }} />
        {/* centre hub */}
        <div style={{ position: "absolute", top: "50%", left: "50%", width: 44, height: 44, borderRadius: "50%", background: "#1b2029", border: "2px solid var(--accent)", transform: "translate(-50%,-50%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
          🎮
        </div>
      </div>
      {/* left/right indicators */}
      <div style={{ position: "absolute", left: 6, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "var(--muted)" }}>◀</div>
      <div style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "var(--muted)" }}>▶</div>
    </div>
  );
}

/* ---------- drive pedal (tap/hold fills up) ---------- */
function DrivePedal({
  label,
  color,
  onChange,
  onStart,
}: {
  label: string;
  color: string;
  onChange: (v: number) => void;
  onStart?: () => void;
}) {
  const fill = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const ref = useRef<HTMLDivElement>(null);

  const set = (v: number) => {
    const c = Math.max(0, Math.min(1, v));
    if (fill.current) fill.current.style.height = `${c * 100}%`;
    onChange(parseFloat(c.toFixed(2)));
  };

  const fromPointer = (clientY: number) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    set((r.bottom - clientY) / r.height);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flex: 1 }}>
      <div
        ref={ref}
        style={{
          width: "100%",
          height: 120,
          borderRadius: 14,
          background: "var(--body-2)",
          border: `2px solid ${color}44`,
          position: "relative",
          overflow: "hidden",
          touchAction: "none",
          cursor: "pointer",
        }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          dragging.current = true;
          onStart?.();
          fromPointer(e.clientY);
        }}
        onPointerMove={(e) => { if (dragging.current) fromPointer(e.clientY); }}
        onPointerUp={() => { dragging.current = false; set(0); }}
        onPointerCancel={() => { dragging.current = false; set(0); }}
      >
        <div
          ref={fill}
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 0,
            background: `linear-gradient(0deg, ${color}, ${color}66)`,
            transition: "none",
          }}
        />
        <span style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: 11, letterSpacing: 1, color: "var(--muted)", textTransform: "uppercase" }}>{label}</span>
      </div>
    </div>
  );
}

/* ---------- analog trigger (drag up to fill) ---------- */
function Trigger({
  label,
  onChange,
  onStart,
}: {
  label: string;
  onChange: (v: number) => void;
  onStart?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const fill = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const set = (v: number) => {
    const c = Math.max(0, Math.min(1, v));
    if (fill.current) fill.current.style.height = `${c * 100}%`;
    onChange(+c.toFixed(2));
  };

  const fromPointer = (clientY: number) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    set((r.bottom - clientY) / r.height);
  };

  return (
    <div
      ref={ref}
      className="trig"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        dragging.current = true;
        onStart?.();
        fromPointer(e.clientY);
      }}
      onPointerMove={(e) => {
        if (dragging.current) fromPointer(e.clientY);
      }}
      onPointerUp={() => {
        dragging.current = false;
        set(0);
      }}
      onPointerCancel={() => {
        dragging.current = false;
        set(0);
      }}
    >
      <div ref={fill} className="fill" style={{ height: 0 }} />
      <span className="lbl">{label}</span>
    </div>
  );
}
