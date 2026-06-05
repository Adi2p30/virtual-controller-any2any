# virtual-controller-any-any

Turn your **phone into a game controller** that drives **any computer**. Drag the
sticks and hold the buttons on a phone web app; a live dashboard visualizes every
input; and a Python bridge injects the inputs into your Mac as real keyboard/mouse
events — with a UI to remap what every control does.

```
 phone (client UI)                server (Next.js)                 your Mac
┌────────────────┐  POST        ┌──────────────────┐  SSE       ┌──────────────┐
│  touch gamepad │ ───────────▶ │  hub (live state)│ ─────────▶ │   bridge     │
│  sticks/buttons│ /api/input   │  + monitor UI    │ /api/stream│  CGEvent →   │
│  fullscreen    │              │  + mapping editor│            │  keys/mouse  │
└────────────────┘              └──────────────────┘            └──────────────┘
                                   ▲ /api/mapping  (bridge polls for remaps)
```

Three independent pieces:

| Folder | What it is | Port | Stack |
|--------|-----------|------|-------|
| **`client/`** | On-phone touch controller (Xbox-style pad) | 3001 | Next.js |
| **`server/`** | Live monitor dashboard + ingest API + mapping editor | 3000 | Next.js |
| **`bridge/`** | Translates controller state into real macOS input | — | Python (Quartz) |

---

## Quick start

You need [Node.js](https://nodejs.org) 18+ and Python 3.10+. The phone and the
computer must be on the **same WiFi**.

### 1. Start the server (monitor + API) — port 3000

```bash
cd server
npm install
npm run dev        # or: npm run build && npm run start  for production
```

### 2. Start the client (phone controller) — port 3001

```bash
cd client
npm install
npm run dev
```

Both bind `0.0.0.0`, so your phone can reach them by your computer's LAN IP.
Find it with `ipconfig getifaddr en0` (macOS).

### 3. Open the apps

- **Monitor**: on your computer, open <http://localhost:3000>.
- **Controller**: on your phone, open `http://<your-computer-ip>:3001`, and in the
  top bar set the server URL to `http://<your-computer-ip>:3000`.

No phone handy? Click **Run demo input** on the monitor to fire a scripted sequence.

### 4. Start the bridge (drive your Mac) — see [`bridge/README.md`](bridge/README.md)

```bash
cd bridge
python3 -m venv .venv
./.venv/bin/pip install -r requirements.txt
./.venv/bin/python mac_bridge.py --server http://localhost:3000 --verbose
```

Then grant **Accessibility** permission (one-time) so the injected events land —
see the macOS section below.

---

## Using it

1. With all three running, open the controller on your phone and the monitor on
   your computer.
2. Press a button / drag a stick on the phone → the monitor lights up → the bridge
   types into whatever app is focused on your Mac.
3. **Remap controls** live in the monitor's **Input Mapping** panel (see below).
4. **Go fullscreen** on the phone with the ⛶ button so only the controls show.

### Input Mapping (the monitor's editor)

Scroll to the **Input Mapping** panel on the monitor (<http://localhost:3000>):

- Every **button / trigger** has a dropdown — pick a key, `Mouse: left/right click`,
  or *none*.
- Each **stick** can be **Keys** (digital, e.g. WASD), **Mouse**, or **Off**, with
  its own deadzone and (for mouse) sensitivity.
- **Quick presets**: D-pad → Arrows / WASD, L-stick → WASD / Arrows.

Changes save instantly to disk (`server/data/mapping.json`) and the bridge picks
them up within ~1 second — no restart.

**Default mapping:** A→Space, B→Shift, X→E, Y→F, LB→Q, RB→R, LS→C, RS→right-click,
Back→Tab, Start→Esc, Guide→G, D-pad→Arrows, Left stick→WASD, Right stick→Mouse,
LT→right-click, RT→left-click.

### Fullscreen on the phone

- Tap the **⛶** button in the controller's top bar. On Android/desktop Chrome it
  goes true fullscreen and hides the bar — only the controls remain.
- **On iPhone**, Safari can't fullscreen a web page, so the app is a **PWA**: tap
  **Share → Add to Home Screen**, then launch it from the home-screen icon for a
  chromeless, fullscreen, landscape controller.

---

## Running the bridge on macOS (important)

The bridge does **not** create a virtual gamepad device. On Apple Silicon + recent
macOS with SIP enabled, a true HID gamepad needs a signed **DriverKit** system
extension and a security downgrade (the popular `foohid`-based projects are kernel
extensions that no longer load). Instead, the bridge translates controller state
into real **keyboard/mouse** events via Quartz `CGEvent` — no driver, no reboot.

**You must grant Accessibility permission** for the events to reach other apps:

1. Run the bridge once.
2. Open **System Settings → Privacy & Security → Accessibility**.
3. Enable the app that runs the script — usually your **Terminal**, **iTerm**, or
   **VS Code** (whichever app your shell lives in). If unsure which, the bridge's
   events are attributed to the *app that owns the terminal process*.
4. Restart the bridge.

Quick test: focus a text editor and push the left stick up — `w` should start typing.

> Want a real virtual gamepad (for games that only accept actual controllers)?
> That's the DriverKit path — heavier, requires reduced security. Not included here.

---

## Architecture notes

### Wire format (`POST /api/input`)
Partial or full JSON; the hub shallow-merges, so clients send only what changed.
Sticks `[-1, 1]`, triggers `[0, 1]`.

```jsonc
{
  "leftStick":  { "x": 0.5, "y": -0.5 },
  "triggers":   { "RT": 0.8 },
  "buttons":    { "A": true }
}
```

Clients also stamp `_seq` (monotonic) and `_t`; the server uses `_seq` to drop
out-of-order packets and to count missed inputs.

### Real-time transport
- `GET /api/stream` — **Server-Sent Events**. Emits a `snapshot` on connect, then
  `update` events. The monitor and the bridge both subscribe here.
- `GET /api/mapping` / `POST /api/mapping` — read/update the input mapping.
- `GET /api/input` — current state (debug). `POST /api/ping`, `/api/reset` — utility.

### Low-latency design
- **Client**: up to 4 concurrent fire-and-forget POSTs so input rate isn't tied to
  WiFi round-trip; the server drops any stale `_seq`.
- **Bridge**: discrete inputs fire the instant an SSE update arrives (no polling
  delay); a dedicated 250 Hz loop handles continuous stick→mouse motion.

### State is in-memory
The hub (`server/lib/hub.ts`) is a global singleton on an `EventEmitter`. State
lives in one Node process; it is not multi-instance safe.

---

## Commands cheat-sheet

```bash
# in server/ or client/
npm install        # once
npm run dev        # dev server with HMR
npm run build      # production build + typecheck + lint (the verification gate)
npm run start      # serve the production build
npm run lint       # eslint only
```

**Gotcha:** never run `npm run build` while a `dev`/`start` for the *same* app is
live — concurrent writes corrupt `.next`. Kill it first
(`lsof -ti tcp:3000 | xargs kill -9`), and `rm -rf .next` if it's already broken.

```bash
# bridge/
./.venv/bin/python mac_bridge.py --server http://<server-ip>:3000 [--verbose]
```

---

## Repo layout

```
client/   Next.js phone controller (touch UI, sender, settings, fullscreen/PWA)
server/   Next.js monitor + API (hub, SSE, mapping editor, persistence)
bridge/   Python → macOS input bridge (Quartz CGEvent, live remapping)
```

## License

MIT — see [LICENSE](LICENSE).
