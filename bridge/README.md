# bridge  virtual controller → OS input

Subscribes to the server's SSE stream (`/api/stream`) and injects real
keyboard/mouse events. No driver, no SIP change. Two platform backends:

- **macOS** via Quartz `CGEvent` (needs an Accessibility grant).
- **Windows** via `ctypes` `SendInput` with keyboard scancodes (no extra deps).

One shared loop (`bridge.py`) selects the backend with a `--platform` flag
(`auto` by default). `mac_bridge.py` and `win_bridge.py` are thin wrappers that
fix the platform; `start.sh` (mac) and `start.bat` (Windows) set up the venv and
launch it for you.

> **Why not a real virtual gamepad?** On Apple Silicon + recent macOS with SIP
> on, a true HID gamepad needs a signed **DriverKit** system extension and
> reduced security (Recovery reboot). The `foohid`-based repos (`rii`,
> `SerialGamepad`) are kexts and won't load. This bridge avoids all that by
> translating controller state into OS input events instead. Tradeoff: the Mac
> sees keyboard/mouse, not a "gamepad"  fine for most games/apps.

## Quick start

Start the `server/` app (port 3000) and the `client/` on your phone first, then
run the launcher for your OS (it creates the venv, installs deps, and runs):

**macOS**
```bash
cd bridge
./start.sh --server http://localhost:3000 --verbose
```

**Windows**
```bat
cd bridge
start.bat --server http://localhost:3000 --verbose
```

## Manual run

```bash
cd bridge
python3 -m venv .venv
./.venv/bin/pip install -r requirements.txt          # pyobjc on macOS only
./.venv/bin/python bridge.py --platform mac --server http://localhost:3000 --verbose
```

`--platform` is `auto` | `mac` | `windows` (auto-detects from the OS). The
per-OS wrappers `mac_bridge.py` / `win_bridge.py` are shortcuts for
`bridge.py --platform mac|windows`.

### Windows notes

- No dependencies to install  `SendInput` is reached via `ctypes` from the
  stdlib. `requirements.txt` only installs pyobjc on macOS.
- Arrow keys and right-hand modifiers are sent as extended scancodes.
- Some kernel-level anti-cheat games block injected input; ordinary games and
  apps work.

### macOS: grant Accessibility permission (required, one-time)

Injecting input needs permission. The **first** time you run it, macOS will
either silently drop events or prompt you. Go to:

**System Settings → Privacy & Security → Accessibility**

and enable the app that runs the script (your **Terminal** / **iTerm** /
**VS Code**). Then restart the bridge. If events still don't land, toggle the
entry off/on, or remove and re-add it.

## Customize the mapping

Edit `mapping.py`:

- `BUTTON_MAP`  each button → a key name (see `keycodes.py`) or
  `"mouse:left"` / `"mouse:right"`.
- `LEFT_STICK_KEYS` + `LSTICK_DEADZONE`  left stick → WASD-style digital keys.
- `RSTICK_DEADZONE`, `MOUSE_SENSITIVITY`, `MOUSE_TICK_HZ`  right stick → mouse.
- `TRIGGER_MAP` + `TRIGGER_THRESHOLD`  LT/RT → key or mouse button.

Add more keys in `keycodes.py` (macOS virtual key codes).

## How it works

- One thread reads the SSE stream and keeps the latest `ControllerState`.
- A second thread (`MOUSE_TICK_HZ`, default 120 Hz) applies that state:
  edge-detects button/key presses (down/up only on change) and moves the mouse
  continuously from the right stick.
- On Ctrl+C it releases every key/mouse button it was holding.
