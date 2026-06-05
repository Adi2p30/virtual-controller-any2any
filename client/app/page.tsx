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

export default function Page() {
  const { send, serverUrl, setServerUrl, status } = useSender();
  const { settings, update, reset } = useSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [barHidden, setBarHidden] = useState(false);
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
              <HoldButton className="mini" name="Start" onPress={press}>
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
      </div>

      {settingsOpen && (
        <SettingsPanel
          settings={settings}
          update={update}
          reset={reset}
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
}: {
  name: ButtonName;
  onPress: (n: ButtonName, down: boolean) => void;
  className?: string;
  children: React.ReactNode;
}) {
  const [on, setOn] = useState(false);
  const set = (down: boolean) => {
    setOn(down);
    onPress(name, down);
  };
  return (
    <div
      className={`${className ?? ""} ${on ? "on" : ""}`}
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
