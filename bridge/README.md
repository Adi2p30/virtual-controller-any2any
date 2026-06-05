# bridge — virtual controller → macOS input

Subscribes to the server's SSE stream (`/api/stream`) and injects real
keyboard/mouse events on macOS via Quartz `CGEvent`. No driver, no SIP change.

> **Why not a real virtual gamepad?** On Apple Silicon + recent macOS with SIP
> on, a true HID gamepad needs a signed **DriverKit** system extension and
> reduced security (Recovery reboot). The `foohid`-based repos (`rii`,
> `SerialGamepad`) are kexts and won't load. This bridge avoids all that by
> translating controller state into OS input events instead. Tradeoff: the Mac
> sees keyboard/mouse, not a "gamepad" — fine for most games/apps.

## Setup

```bash
cd bridge
python3 -m venv .venv
./.venv/bin/pip install -r requirements.txt
```

## Run

Start the `server/` app (port 3000) and the `client/` on your phone first, then:

```bash
./.venv/bin/python mac_bridge.py --server http://localhost:3000 --verbose
```

### Grant Accessibility permission (required, one-time)

Injecting input needs permission. The **first** time you run it, macOS will
either silently drop events or prompt you. Go to:

**System Settings → Privacy & Security → Accessibility**

and enable the app that runs the script (your **Terminal** / **iTerm** /
**VS Code**). Then restart the bridge. If events still don't land, toggle the
entry off/on, or remove and re-add it.

## Customize the mapping

Edit `mapping.py`:

- `BUTTON_MAP` — each button → a key name (see `keycodes.py`) or
  `"mouse:left"` / `"mouse:right"`.
- `LEFT_STICK_KEYS` + `LSTICK_DEADZONE` — left stick → WASD-style digital keys.
- `RSTICK_DEADZONE`, `MOUSE_SENSITIVITY`, `MOUSE_TICK_HZ` — right stick → mouse.
- `TRIGGER_MAP` + `TRIGGER_THRESHOLD` — LT/RT → key or mouse button.

Add more keys in `keycodes.py` (macOS virtual key codes).

## How it works

- One thread reads the SSE stream and keeps the latest `ControllerState`.
- A second thread (`MOUSE_TICK_HZ`, default 120 Hz) applies that state:
  edge-detects button/key presses (down/up only on change) and moves the mouse
  continuously from the right stick.
- On Ctrl+C it releases every key/mouse button it was holding.
