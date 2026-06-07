#!/usr/bin/env python3
"""
bridge.py  turn the virtual controller into real OS input.

Subscribes to the server's SSE stream (/api/stream), reads the live
ControllerState, and injects keyboard/mouse events through a platform backend
(macOS Quartz or Windows SendInput). No driver, no SIP changes.

Usage:
    python3 bridge.py --server http://localhost:3000
    python3 bridge.py --platform windows --server http://localhost:3000
    python3 bridge.py --platform mac --verbose

--platform defaults to "auto" (windows on win32, mac otherwise). The thin
mac_bridge.py / win_bridge.py wrappers just call this with the platform fixed.

Mapping lives in bridge/mapping.py (edit freely). Platform key codes are in
keycodes.py (macOS) and win_keycodes.py (Windows).
"""

import argparse
import json
import threading
import time
import urllib.request

import mapping as M  # static defaults / fallback when the server is unreachable
from input_backends import make_backend

# ---- shared state updated by the SSE thread, read by the apply loop ----
_lock = threading.Lock()
_latest = {
    "leftStick": {"x": 0.0, "y": 0.0},
    "rightStick": {"x": 0.0, "y": 0.0},
    "triggers": {"LT": 0.0, "RT": 0.0},
    "buttons": {},
}

# Live mapping (same schema as the server's /api/mapping). Seeded from the
# static mapping.py so the bridge still works offline, then overwritten by
# whatever the server returns. Updated by atomic reference swap so readers
# never need a lock (and never see a half-written dict).


def _default_cfg():
    return {
        "buttons": dict(M.BUTTON_MAP),
        "leftStick": {
            "mode": "keys",
            "keys": dict(M.LEFT_STICK_KEYS),
            "deadzone": M.LSTICK_DEADZONE,
            "sensitivity": M.MOUSE_SENSITIVITY,
        },
        "rightStick": {
            "mode": "mouse",
            "keys": {"up": "up", "down": "down", "left": "left", "right": "right"},
            "deadzone": M.RSTICK_DEADZONE,
            "sensitivity": M.MOUSE_SENSITIVITY,
        },
        "triggers": dict(M.TRIGGER_MAP),
        "triggerThreshold": M.TRIGGER_THRESHOLD,
    }


_cfg = _default_cfg()
BACKEND = None  # set in main()


# --------------------------- dispatch ---------------------------
# Discrete inputs (buttons, triggers, stick-in-keys-mode) are applied the
# instant an SSE update arrives  no polling delay. Only continuous stick→mouse
# motion needs a steady tick, handled by mouse_loop.
def apply_discrete(cfg, btn, ls, rs, tr):
    for b, target in cfg["buttons"].items():
        BACKEND.apply_target(target, bool(btn.get(b)))

    thr = cfg.get("triggerThreshold", 0.5)
    for t, target in cfg["triggers"].items():
        BACKEND.apply_target(target, tr.get(t, 0.0) >= thr)

    for stick, (x, y) in (
        (cfg["leftStick"], (ls["x"], ls["y"])),
        (cfg["rightStick"], (rs["x"], rs["y"])),
    ):
        if stick.get("mode") == "keys":
            dz = stick.get("deadzone", 0.5)
            k = stick["keys"]
            BACKEND.set_key(k["up"], y < -dz)
            BACKEND.set_key(k["down"], y > dz)
            BACKEND.set_key(k["left"], x < -dz)
            BACKEND.set_key(k["right"], x > dz)


def dispatch_now():
    """Apply discrete inputs from the latest state immediately (SSE thread)."""
    cfg = _cfg
    with _lock:
        ls = dict(_latest["leftStick"])
        rs = dict(_latest["rightStick"])
        tr = dict(_latest["triggers"])
        btn = dict(_latest["buttons"])
    apply_discrete(cfg, btn, ls, rs, tr)


def mouse_loop(stop):
    """Continuous stick→mouse motion only; runs at a high steady rate."""
    period = 1.0 / M.MOUSE_TICK_HZ
    while not stop.is_set():
        cfg = _cfg
        with _lock:
            ls = dict(_latest["leftStick"])
            rs = dict(_latest["rightStick"])
        for stick, (x, y) in (
            (cfg["leftStick"], (ls["x"], ls["y"])),
            (cfg["rightStick"], (rs["x"], rs["y"])),
        ):
            if stick.get("mode") == "mouse":
                dz = stick.get("deadzone", 0.12)
                if abs(x) > dz or abs(y) > dz:
                    sens = stick.get("sensitivity", 18.0)
                    BACKEND.mouse_move(x * sens, y * sens)
        time.sleep(period)


# --------------------------- SSE reader ---------------------------
def update_state(state):
    with _lock:
        for k in ("leftStick", "rightStick", "triggers"):
            if isinstance(state.get(k), dict):
                _latest[k].update(state[k])
        if isinstance(state.get("buttons"), dict):
            _latest["buttons"].update(state["buttons"])


def sse_loop(server, stop):
    url = server.rstrip("/") + "/api/stream"
    while not stop.is_set():
        try:
            BACKEND.log("connecting", url)
            req = urllib.request.Request(url, headers={"Accept": "text/event-stream"})
            with urllib.request.urlopen(req, timeout=30) as resp:
                print(f"connected to {url}", flush=True)
                data_buf = []
                for raw in resp:
                    if stop.is_set():
                        break
                    line = raw.decode("utf-8", "replace").rstrip("\n").rstrip("\r")
                    if line == "":
                        if data_buf:
                            payload = "".join(data_buf)
                            data_buf = []
                            try:
                                obj = json.loads(payload)
                            except json.JSONDecodeError:
                                continue
                            st = obj.get("state")
                            if isinstance(st, dict):
                                update_state(st)
                                dispatch_now()  # fire discrete inputs at once
                        continue
                    if line.startswith(":"):
                        continue  # keep-alive ping
                    if line.startswith("data:"):
                        data_buf.append(line[5:].lstrip())
                    # event: lines ignored  both snapshot/update carry .state
        except Exception as e:  # noqa: BLE001
            if not stop.is_set():
                print(f"stream error: {e}  retrying in 1s", flush=True)
                time.sleep(1.0)


def mapping_loop(server, stop):
    """Poll the server's /api/mapping so UI edits take effect live."""
    global _cfg
    url = server.rstrip("/") + "/api/mapping"
    last = None
    while not stop.is_set():
        try:
            req = urllib.request.Request(url, headers={"Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=10) as resp:
                obj = json.loads(resp.read().decode("utf-8"))
            m = obj.get("mapping")
            if isinstance(m, dict):
                snap = json.dumps(m, sort_keys=True)
                if snap != last:
                    last = snap
                    _cfg = m  # atomic reference swap; readers are lock-free
                    print("mapping updated from server", flush=True)
        except Exception as e:  # noqa: BLE001
            BACKEND.log("mapping fetch failed:", e)
        stop.wait(1.0)


def main(argv=None, default_platform="auto"):
    global BACKEND
    ap = argparse.ArgumentParser(description="Virtual controller -> OS input bridge")
    ap.add_argument("--server", default="http://localhost:3000",
                    help="server base URL (default http://localhost:3000)")
    ap.add_argument("--platform", default=default_platform,
                    choices=["auto", "mac", "windows"],
                    help="input backend to use (default: auto-detect)")
    ap.add_argument("--verbose", action="store_true")
    args = ap.parse_args(argv)

    BACKEND = make_backend(args.platform, verbose=args.verbose)

    stop = threading.Event()
    sse = threading.Thread(target=sse_loop, args=(args.server, stop), daemon=True)
    mouser = threading.Thread(target=mouse_loop, args=(stop,), daemon=True)
    mapper = threading.Thread(target=mapping_loop, args=(args.server, stop), daemon=True)
    sse.start()
    mouser.start()
    mapper.start()
    print("bridge running  press Ctrl+C to stop", flush=True)
    try:
        while True:
            time.sleep(0.5)
    except KeyboardInterrupt:
        print("\nstopping…", flush=True)
    finally:
        stop.set()
        time.sleep(0.05)
        BACKEND.release_all()


if __name__ == "__main__":
    main()
